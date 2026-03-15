import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { focusAgent, getDashboardState, watchState } from "../core/engine.js";
import type { AgentSummary } from "../core/types.js";

type DashState = Awaited<ReturnType<typeof getDashboardState>>;
type UpdatePing = { id: string; agent: string; text: string; at: string };

function colorFor(agent: AgentSummary): "green" | "yellow" | "red" {
  return agent.color;
}

function age(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return "just now";
  if (min === 1) return "1m ago";
  return `${min}m ago`;
}

function ageMinutes(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function clip(value: string, max = 88): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function attentionLabel(agent?: AgentSummary): string {
  if (!agent?.attention) return "clear";
  const flags: string[] = [];
  if (agent.attention.bell) flags.push("bell");
  if (agent.attention.activity) flags.push("activity");
  if (agent.attention.silence) flags.push("silence");
  if (agent.attention.approval_prompt) flags.push("approval");
  if (agent.attention.feedback_request) flags.push("feedback");
  return flags.join(", ") || "alert";
}

function decisionRequest(agent: AgentSummary): string {
  return (
    agent.status.manager.request ||
    agent.status.question ||
    agent.attention?.feedback_request ||
    (agent.attention?.approval_prompt ? "Approve or cancel the pending command in this terminal." : "")
  );
}

function hasDecision(agent: AgentSummary): boolean {
  return Boolean(
    agent.status.needs_input ||
      agent.status.state === "needs_input" ||
      decisionRequest(agent),
  );
}

function displaySummary(agent: AgentSummary): string {
  return agent.attention?.last_update || agent.status.summary;
}

function isPlaceholderWhere(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "planning approach" || v === "start task" || v === "starting";
}

function preferredWhere(agent: AgentSummary): string {
  const where = agent.status.manager.where || agent.status.next || "";
  const live = agent.attention?.last_update || "";
  const stale = ageMinutes(agent.status.updated_at) >= 10;
  if (live && (stale || !where || isPlaceholderWhere(where))) {
    return live;
  }
  return where || live || agent.status.summary;
}

export function DashboardApp(): React.JSX.Element {
  const [state, setState] = useState<DashState>({ agents: [], mission: null });
  const [selected, setSelected] = useState(0);
  const [statusLine, setStatusLine] = useState<string>("");
  const [pings, setPings] = useState<UpdatePing[]>([]);
  const signalRef = useRef<Map<string, string>>(new Map());
  const primedRef = useRef(false);

  const refresh = async () => {
    const next = await getDashboardState();
    setState(next);
    const nextSignals = new Map<string, string>();
    const nextPings: UpdatePing[] = [];
    const nowIso = new Date().toISOString();

    for (const agent of next.agents) {
      const signal = [
        agent.status.updated_at,
        agent.status.summary,
        agent.status.manager.where,
        agent.attention?.last_update ?? "",
        agent.attention?.feedback_request ?? "",
        agent.attention?.approval_prompt ? "1" : "0",
        agent.attention?.activity ? "1" : "0",
      ].join("|");
      nextSignals.set(agent.status.agent, signal);
      const previous = signalRef.current.get(agent.status.agent);
      if (!primedRef.current || !previous || previous === signal) {
        continue;
      }
      const text = clip(displaySummary(agent), 92);
      if (!text) continue;
      nextPings.push({
        id: `${agent.status.agent}:${nowIso}:${nextPings.length}`,
        agent: agent.status.agent,
        text,
        at: nowIso,
      });
    }

    signalRef.current = nextSignals;
    if (!primedRef.current) {
      primedRef.current = true;
      return;
    }
    if (nextPings.length > 0) {
      setPings((current) => [...nextPings, ...current].slice(0, 8));
      if (process.stdout.isTTY) {
        process.stdout.write("\u0007");
      }
    }
  };

  useEffect(() => {
    void refresh();
    const stop = watchState(() => {
      void refresh();
    });
    const poll = setInterval(() => {
      void refresh();
    }, 2000);
    return () => {
      clearInterval(poll);
      stop();
    };
  }, []);

  const agents = state.agents;
  const selectedSummary = agents[selected];
  const selectedAgent = selectedSummary?.status.agent;
  const selectedStatus = selectedSummary?.status;

  useInput((input, key) => {
    if (key.downArrow || input === "j") {
      setSelected((s) => Math.min(s + 1, Math.max(0, agents.length - 1)));
    }
    if (key.upArrow || input === "k") {
      setSelected((s) => Math.max(0, s - 1));
    }
    if (key.return && selectedAgent) {
      try {
        focusAgent(selectedAgent, { switchClient: false });
        setStatusLine(`Selected ${selectedAgent} (session not switched)`);
      } catch {
        setStatusLine(`Focus failed for ${selectedAgent}. Try 'mc focus ${selectedAgent}' in a shell.`);
      }
    }
    if (input === "s" && selectedAgent) {
      try {
        focusAgent(selectedAgent, { switchClient: true });
        setStatusLine(`Switched to ${selectedAgent}`);
      } catch {
        setStatusLine(`Switch failed for ${selectedAgent}. Try 'mc focus ${selectedAgent} --switch'.`);
      }
    }
    if (input === "r") {
      void refresh();
      setStatusLine("Refreshed");
    }
    if (input === "q") {
      process.exit(0);
    }
  });

  useEffect(() => {
    setSelected((current) => {
      if (agents.length === 0) return 0;
      return Math.min(current, agents.length - 1);
    });
  }, [agents.length]);

  const needsInput = useMemo(
    () => agents.filter((a) => hasDecision(a)),
    [agents],
  );
  const attentionAgents = useMemo(
    () =>
      agents.filter(
        (a) =>
          Boolean(
            a.attention &&
              (
                a.attention.bell ||
                a.attention.activity ||
                a.attention.silence ||
                a.attention.approval_prompt ||
                a.attention.feedback_request
              ),
          ),
      ),
    [agents],
  );
  const running = useMemo(() => agents.filter((a) => a.status.state === "running").length, [agents]);
  const done = useMemo(() => agents.filter((a) => a.status.state === "done").length, [agents]);
  const selectedAsk = selectedSummary
    ? decisionRequest(selectedSummary)
    : (selectedStatus?.manager.request || selectedStatus?.question || "");
  const liveGoals = useMemo(
    () =>
      agents.map((a) => {
        const objective = a.status.manager.objective || a.status.goal;
        const task = preferredWhere(a);
        return `${a.status.agent}: ${objective} -> ${task}`;
      }),
    [agents],
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Codex Mission Control</Text>
      <Text dimColor>j/k move, enter select, s switch, r refresh, q quit</Text>
      <Text>{`Agents ${agents.length} | Running ${running} | Needs input ${needsInput.length} | Attention ${attentionAgents.length} | Done ${done}`}</Text>
      {statusLine ? <Text color="yellow">{statusLine}</Text> : null}

      <Box marginTop={1} flexDirection="column">
        <Text bold>Decision Inbox</Text>
        {needsInput.length === 0 ? <Text dimColor>None.</Text> : null}
        {needsInput.map((agent) => {
          const s = agent.status;
          const objective = s.manager.objective || s.goal;
          const where = preferredWhere(agent);
          const request = decisionRequest(agent) || "Needs attention";
          return (
            <Box key={`ni-${s.agent}`} flexDirection="column" marginBottom={1}>
              <Text color="red">{`${s.agent}: ${clip(request)}`}</Text>
              <Text dimColor>{`  objective: ${clip(objective)}`}</Text>
              <Text dimColor>{`  where: ${clip(where)}`}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Terminal Attention</Text>
        {attentionAgents.length === 0 ? <Text dimColor>None.</Text> : null}
        {attentionAgents.map((agent) => {
          const s = agent.status;
          const flags = [
            agent.attention?.bell ? "bell" : "",
            agent.attention?.activity ? "activity" : "",
            agent.attention?.silence ? "silence" : "",
            agent.attention?.approval_prompt ? "approval" : "",
            agent.attention?.feedback_request ? "feedback" : "",
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <Text key={`attn-${s.agent}`} color="yellow">
              {`${s.agent}: ${flags || "alert"}${agent.attention?.last_update ? ` | ${clip(agent.attention.last_update, 54)}` : ""}`}
            </Text>
          );
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Update Pings</Text>
        {pings.length === 0 ? <Text dimColor>None.</Text> : null}
        {pings.map((ping) => (
          <Text key={ping.id}>{`${age(ping.at).padEnd(8)} ${ping.agent}: ${clip(ping.text, 88)}`}</Text>
        ))}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Agents</Text>
        {agents.length === 0 ? <Text dimColor>No agents yet.</Text> : null}
        {agents.map((agent, idx) => {
          const prefix = idx === selected ? ">" : " ";
          const s = agent.status;
          const attention =
            agent.attention &&
            (agent.attention.bell ||
              agent.attention.activity ||
              agent.attention.silence ||
              agent.attention.approval_prompt ||
              agent.attention.feedback_request);
          const requestFlag = hasDecision(agent) ? "?" : attention ? "!" : "-";
          return (
            <Text key={s.agent} color={colorFor(agent)}>
              {`${prefix} ${s.agent.padEnd(14)} ${s.state.padEnd(11)} ${age(s.updated_at).padEnd(10)} ${requestFlag} ${clip(displaySummary(agent), 54)}`}
            </Text>
          );
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Selected Agent</Text>
        {!selectedStatus ? <Text dimColor>No agent selected.</Text> : null}
        {selectedStatus ? (
          <Box flexDirection="column">
            <Text>{`${selectedStatus.agent} | ${selectedStatus.state}`}</Text>
            <Text>{`Objective: ${clip(selectedStatus.manager.objective || selectedStatus.goal)}`}</Text>
            <Text>{`Where: ${clip(selectedSummary ? preferredWhere(selectedSummary) : selectedStatus.summary)}`}</Text>
            <Text>{`Last done: ${clip(selectedStatus.last_done || "n/a")}`}</Text>
            <Text>{`Next: ${clip(selectedStatus.next || "n/a")}`}</Text>
            <Text>{`Ask: ${clip(selectedAsk || "none")}`}</Text>
            <Text>{`Status age: ${age(selectedStatus.updated_at)}`}</Text>
            {selectedSummary?.attention?.last_update ? (
              <Text>{`Live update: ${clip(selectedSummary.attention.last_update, 120)}`}</Text>
            ) : null}
            <Text>{`Terminal: ${attentionLabel(selectedSummary)}`}</Text>
          </Box>
        ) : null}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Daily Goals</Text>
        {!state.mission && liveGoals.length === 0 ? <Text dimColor>No active mission.</Text> : null}
        {state.mission?.goals.map((goal) => (
          <Text key={`goal-${goal.id}`}>{`${goal.id}. ${goal.text}`}</Text>
        ))}
        {liveGoals.length > 0 ? <Text dimColor>Live Agent Tasks</Text> : null}
        {liveGoals.map((goal, idx) => (
          <Text key={`live-goal-${idx}`}>{`${idx + 1}. ${clip(goal, 120)}`}</Text>
        ))}
      </Box>
    </Box>
  );
}
