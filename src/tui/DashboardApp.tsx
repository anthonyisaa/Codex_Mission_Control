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

export function DashboardApp(): React.JSX.Element {
  const [state, setState] = useState<DashState>({ agents: [], mission: null });
  const [selected, setSelected] = useState(0);

  const refresh = async () => {
    setState(await getDashboardState());
  };

  useEffect(() => {
    void refresh();
    const stop = watchState(() => {
      void refresh();
    });
    return stop;
  }, []);

  const agents = state.agents;
  const selectedAgent = agents[selected]?.status.agent;

  useInput((input, key) => {
    if (key.downArrow || input === "j") {
      setSelected((s) => Math.min(s + 1, Math.max(0, agents.length - 1)));
    }
    if (key.upArrow || input === "k") {
      setSelected((s) => Math.max(0, s - 1));
    }
    if (key.return && selectedAgent) {
      try {
        focusAgent(selectedAgent);
      } catch {
        // Ignore; keep dashboard running.
      }
    }
    if (input === "r") {
      void refresh();
    }
    if (input === "q") {
      process.exit(0);
    }
  });

  const needsInput = useMemo(
    () => agents.filter((a) => a.status.needs_input || a.status.state === "needs_input"),
    [agents],
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Codex Mission Control</Text>
      <Text dimColor>j/k move, enter focus, r refresh, q quit</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Agents</Text>
        {agents.length === 0 ? <Text dimColor>No agents yet.</Text> : null}
        {agents.map((agent, idx) => {
          const prefix = idx === selected ? ">" : " ";
          const s = agent.status;
          return (
            <Text key={s.agent} color={colorFor(agent)}>
              {`${prefix} ${s.agent.padEnd(14)} ${s.state.padEnd(11)} ${age(s.updated_at).padEnd(10)} ${s.summary}`}
            </Text>
          );
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Needs Input</Text>
        {needsInput.length === 0 ? <Text dimColor>None.</Text> : null}
        {needsInput.map((agent) => (
          <Text key={`ni-${agent.status.agent}`} color="red">
            {`${agent.status.agent}: ${agent.status.question || "Needs attention"}`}
          </Text>
        ))}
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
