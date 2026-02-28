import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { focusAgent, getDashboardState, watchState } from "../core/engine.js";
import type { AgentSummary } from "../core/types.js";

type DashState = Awaited<ReturnType<typeof getDashboardState>>;

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
  return flags.join(", ") || "alert";
}

export function DashboardApp(): React.JSX.Element {
  const [state, setState] = useState<DashState>({ agents: [], mission: null });
  const [selected, setSelected] = useState(0);
  const [statusLine, setStatusLine] = useState<string>("");

  const refresh = async () => {
    setState(await getDashboardState());
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
  const selectedAgent = agents[selected]?.status.agent;
  const selectedStatus = agents[selected]?.status;

  useInput((input, key) => {
    if (key.downArrow || input === "j") {
      setSelected((s) => Math.min(s + 1, Math.max(0, agents.length - 1)));
    }
    if (key.upArrow || input === "k") {
      setSelected((s) => Math.max(0, s - 1));
    }
    if (key.return && selectedAgent) {
      try {
        focusAgent(selectedAgent, { switchClient: true });
        setStatusLine(`Focused ${selectedAgent}`);
      } catch {
        setStatusLine(`Focus failed for ${selectedAgent}. Try 'mc focus ${selectedAgent}' in a shell.`);
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
    () => agents.filter((a) => a.status.needs_input || a.status.state === "needs_input"),
    [agents],
  );
  const attentionAgents = useMemo(
    () =>
      agents.filter(
        (a) =>
          Boolean(
            a.attention &&
              (a.attention.bell || a.attention.activity || a.attention.silence || a.attention.approval_prompt),
          ),
      ),
    [agents],
  );
  const running = useMemo(() => agents.filter((a) => a.status.state === "running").length, [agents]);
  const done = useMemo(() => agents.filter((a) => a.status.state === "done").length, [agents]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Codex Mission Control</Text>
      <Text dimColor>j/k move, enter focus, r refresh, q quit</Text>
      <Text>{`Agents ${agents.length} | Running ${running} | Needs input ${needsInput.length} | Attention ${attentionAgents.length} | Done ${done}`}</Text>
      {statusLine ? <Text color="yellow">{statusLine}</Text> : null}

      <Box marginTop={1} flexDirection="column">
        <Text bold>Decision Inbox</Text>
        {needsInput.length === 0 ? <Text dimColor>None.</Text> : null}
        {needsInput.map((agent) => {
          const s = agent.status;
          const objective = s.manager.objective || s.goal;
          const where = s.manager.where || s.next || s.summary;
          const request = s.manager.request || s.question || "Needs attention";
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
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <Text key={`attn-${s.agent}`} color="yellow">
              {`${s.agent}: ${flags || "alert"}`}
            </Text>
          );
        })}
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
              agent.attention.approval_prompt);
          const requestFlag = s.manager.request || s.question ? "?" : "-";
          return (
            <Text key={s.agent} color={colorFor(agent)}>
              {`${prefix} ${s.agent.padEnd(14)} ${s.state.padEnd(11)} ${age(s.updated_at).padEnd(10)} ${attention ? "!" : requestFlag} ${clip(s.summary, 54)}`}
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
            <Text>{`Where: ${clip(selectedStatus.manager.where || selectedStatus.next || selectedStatus.summary)}`}</Text>
            <Text>{`Last done: ${clip(selectedStatus.last_done || "n/a")}`}</Text>
            <Text>{`Next: ${clip(selectedStatus.next || "n/a")}`}</Text>
            <Text>{`Ask: ${clip(selectedStatus.manager.request || selectedStatus.question || "none")}`}</Text>
            <Text>{`Terminal: ${attentionLabel(agents[selected])}`}</Text>
          </Box>
        ) : null}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Daily Goals</Text>
        {!state.mission ? <Text dimColor>No active mission.</Text> : null}
        {state.mission?.goals.map((goal) => (
          <Text key={`goal-${goal.id}`}>{`${goal.id}. ${goal.text}`}</Text>
        ))}
      </Box>
    </Box>
  );
}
