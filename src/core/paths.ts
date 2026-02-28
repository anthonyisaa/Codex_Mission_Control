import path from "node:path";

export const MC_SESSION = "codex-mc";
export const CODEX_DIR = ".codex";
export const AGENTS_DIR = path.join(CODEX_DIR, "agents");
export const MISSIONS_DIR = path.join(CODEX_DIR, "missions");
export const ACTIVE_MISSION = path.join(MISSIONS_DIR, "active.md");

export const getAgentDir = (agent: string) => path.join(AGENTS_DIR, agent);
export const getStatusPath = (agent: string) => path.join(getAgentDir(agent), "status.json");
export const getMissionPath = (dateIso: string) => path.join(MISSIONS_DIR, `${dateIso}.md`);
