import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "./fs.js";

const MC_BEGIN = "<!-- MC:BEGIN -->";
const MC_END = "<!-- MC:END -->";

function missionControlSection(): string {
  const lines = [
    MC_BEGIN,
    "## Mission Control Status Contract",
    "",
    "If this repository is being managed through Codex Mission Control:",
    "- In managed sessions, read `MC_AGENT` and `MC_STATUS_PATH` environment variables.",
    "1. Use `mc-status` commands to keep `.codex/agents/<agent>/status.json` updated.",
    "2. At start and after meaningful progress, run:",
    "   `mc-status set --agent <agent> --summary \"...\" --objective \"...\" --where \"...\"`",
    "3. Before asking for manager input, run:",
    "   `mc-status decision --agent <agent> --objective \"...\" --where \"...\" --request \"...\"`",
    "4. When finished, run:",
    "   `mc-status done --agent <agent> --last-done \"...\"`",
    "5. Do not hand-edit status JSON unless `mc-status` is unavailable.",
    MC_END,
    "",
  ];
  return lines.join("\n");
}

export function upsertMissionControlContract(markdown: string): string {
  const block = missionControlSection();
  const hasMarkers = markdown.includes(MC_BEGIN) && markdown.includes(MC_END);
  if (hasMarkers) {
    const replaced = markdown.replace(
      /<!-- MC:BEGIN -->[\s\S]*?<!-- MC:END -->\s*/m,
      block,
    );
    return replaced.endsWith("\n") ? replaced : `${replaced}\n`;
  }

  const trimmed = markdown.trimEnd();
  if (trimmed.length === 0) {
    return block;
  }
  return `${trimmed}\n\n${block}`;
}

export async function ensureAgentsMdContract(repoRoot = process.cwd()): Promise<void> {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const raw = (await exists(agentsPath)) ? await fs.readFile(agentsPath, "utf8") : "";
  const updated = upsertMissionControlContract(raw);
  if (updated !== raw) {
    await fs.writeFile(agentsPath, updated, "utf8");
  }
}
