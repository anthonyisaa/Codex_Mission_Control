import type { AgentSummary } from "../core/types.js";

function ryg(state: AgentSummary): string {
  if (state.color === "red") return "R";
  if (state.color === "yellow") return "Y";
  return "G";
}

export function renderAgentsTable(agents: AgentSummary[]): string {
  if (agents.length === 0) {
    return "No agents found.";
  }
  const lines = ["RYG  Agent           State        Needs  Updated                  Summary"];
  for (const a of agents) {
    lines.push(
      `${ryg(a).padEnd(4)} ${a.status.agent.padEnd(15)} ${a.status.state.padEnd(12)} ${String(a.status.needs_input).padEnd(6)} ${a.status.updated_at.padEnd(23)} ${a.status.summary}`,
    );
  }
  return lines.join("\n");
}
