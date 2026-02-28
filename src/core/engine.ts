import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { AGENTS_DIR, CODEX_DIR, MISSIONS_DIR, getStatusPath } from "./paths.js";
import { ensureDir } from "./fs.js";
import { parseGoals, readActiveMission, startDay } from "./mission.js";
import {
  bootstrapInstruction,
  ensureAgentDir,
  listStatuses,
  makeInitialStatus,
  updateStatus,
  writeStatus,
} from "./status.js";
import { attachSession, ensureSession, ensureWindow, focusWindow, hasTmux, sendKeys } from "./tmux.js";
import type { AgentStatus, AgentSummary } from "./types.js";

function run(cmd: string, args: string[], cwd: string): void {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr?.trim() || "unknown error"}`);
  }
}

export async function initRepo(): Promise<void> {
  await ensureDir(CODEX_DIR);
  await ensureDir(AGENTS_DIR);
  await ensureDir(MISSIONS_DIR);
  const readmePath = path.join(CODEX_DIR, "README.md");
  try {
    await fs.access(readmePath);
  } catch {
    await fs.writeFile(readmePath, "# Codex Mission Control Data\n\nManaged by mc CLI.\n", "utf8");
  }
}

export async function startMissionDay(goalsInput: string): Promise<{ missionPath: string; goals: string[] }> {
  const goals = parseGoals(goalsInput);
  const { missionPath } = await startDay(goals);
  return { missionPath, goals };
}

function makeWorktreePath(repoRoot: string, name: string): string {
  return path.resolve(repoRoot, "..", `${path.basename(repoRoot)}-${name}`);
}

export async function startAgent(input: {
  agent: string;
  goal: string;
  worktree?: string;
  repoRoot?: string;
}): Promise<{ statusPath: string; bootstrap: string; cwd: string }> {
  const repoRoot = input.repoRoot ?? process.cwd();
  await initRepo();
  await ensureAgentDir(input.agent);

  let cwd = repoRoot;
  if (input.worktree) {
    const wtPath = makeWorktreePath(repoRoot, input.worktree);
    const branch = `mc/${input.agent}`;
    run("git", ["worktree", "add", "-b", branch, wtPath], repoRoot);
    cwd = wtPath;
  }

  const status = makeInitialStatus(input.agent, input.goal, repoRoot, cwd);
  const statusPath = await writeStatus(input.agent, status);
  const bootstrap = bootstrapInstruction(input.agent, statusPath);

  if (hasTmux()) {
    ensureSession();
    ensureWindow(input.agent);
    sendKeys(input.agent, `cd ${cwd}`);
    sendKeys(input.agent, "clear");
    sendKeys(input.agent, "codex");
    sendKeys(input.agent, `echo \"${bootstrap.replaceAll("\"", "\\\\\"")}\"`);
  }

  return { statusPath, bootstrap, cwd };
}

export async function listAgents(): Promise<AgentSummary[]> {
  return listStatuses();
}

export function focusAgent(agent: string): void {
  if (!hasTmux()) {
    throw new Error("tmux is not installed.");
  }
  focusWindow(agent);
}

export function attachMissionControl(): void {
  if (!hasTmux()) {
    throw new Error("tmux is not installed.");
  }
  ensureSession();
  attachSession();
}

export async function pingAgent(agent: string | "all"): Promise<void> {
  const instruction = "mc-status set --agent <name> --summary 'Status refresh'";
  if (agent === "all") {
    const statuses = await listStatuses();
    for (const s of statuses) {
      sendKeys(s.status.agent, `echo \"Please refresh status: ${instruction}\"`);
    }
    return;
  }
  sendKeys(agent, `echo \"Please refresh status: ${instruction}\"`);
}

export async function setStatus(agent: string, patch: Partial<AgentStatus>): Promise<AgentStatus> {
  return updateStatus(agent, patch);
}

export async function getDashboardState(): Promise<{
  agents: AgentSummary[];
  mission: Awaited<ReturnType<typeof readActiveMission>>;
}> {
  const [agents, mission] = await Promise.all([listStatuses(), readActiveMission()]);
  return { agents, mission };
}

export function watchState(onChange: () => void): () => void {
  let timer: NodeJS.Timeout | null = null;
  const bounce = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 120);
  };

  let closed = false;
  const handles: Array<AsyncIterable<unknown>> = [];
  try {
    handles.push(fs.watch(AGENTS_DIR, { recursive: true }));
  } catch {
    // Missing directory before init is expected.
  }
  try {
    handles.push(fs.watch(MISSIONS_DIR, { recursive: true }));
  } catch {
    // Missing directory before init is expected.
  }

  for (const h of handles) {
    (async () => {
      for await (const _ of h) {
        if (closed) break;
        bounce();
      }
    })();
  }

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
  };
}

export function statusPathFor(agent: string): string {
  return getStatusPath(agent);
}
