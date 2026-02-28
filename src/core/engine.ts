import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { canonicalAgentKey, normalizeAgentName } from "./agentName.js";
import { ensureAgentsMdContract } from "./agentsMd.js";
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
import {
  attachSession,
  currentSessionName,
  ensureSession,
  ensureWindow,
  focusWindow,
  hasTmux,
  listWindowAlerts,
  listWindowApprovalPrompts,
  paneCurrentCommand,
  sendKeys,
  switchClient,
} from "./tmux.js";
import type { AgentStatus, AgentStatusPatch, AgentSummary } from "./types.js";

function run(cmd: string, args: string[], cwd: string): void {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr?.trim() || "unknown error"}`);
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export async function initRepo(): Promise<void> {
  await ensureDir(CODEX_DIR);
  await ensureDir(AGENTS_DIR);
  await ensureDir(MISSIONS_DIR);
  await ensureAgentsMdContract();
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
  goal?: string;
  worktree?: string;
  repoRoot?: string;
}): Promise<{ statusPath: string; bootstrap: string; cwd: string }> {
  const agent = normalizeAgentName(input.agent);
  const repoRoot = input.repoRoot ?? process.cwd();
  const goal = input.goal?.trim() || "Agent-defined goal (pending)";
  await initRepo();
  await ensureAgentDir(agent);

  let cwd = repoRoot;
  if (input.worktree) {
    const wtPath = makeWorktreePath(repoRoot, input.worktree);
    const branch = `mc/${agent}`;
    run("git", ["worktree", "add", "-b", branch, wtPath], repoRoot);
    cwd = wtPath;
  }

  const status = makeInitialStatus(agent, goal, repoRoot, cwd);
  const statusPath = await writeStatus(agent, status);
  const bootstrap = bootstrapInstruction(agent, statusPath);

  if (hasTmux()) {
    ensureSession();
    const createdWindow = ensureWindow(agent);
    const paneCmd = paneCurrentCommand(agent).toLowerCase();
    const codexActive = paneCmd === "codex" || paneCmd === "node";
    if (createdWindow || !codexActive) {
      sendKeys(agent, `cd ${cwd}`);
      sendKeys(agent, `export MC_AGENT=${shellQuote(agent)}`);
      sendKeys(agent, `export MC_STATUS_PATH=${shellQuote(statusPath)}`);
      sendKeys(agent, `export MC_AGENT_CWD=${shellQuote(cwd)}`);
      sendKeys(agent, "clear");
      sendKeys(
        agent,
        `echo "MC ready: agent=${agent} cwd=${cwd} status=${statusPath}"`,
      );
      sendKeys(agent, "codex");
    }
  }

  return { statusPath, bootstrap, cwd };
}

export async function listAgents(): Promise<AgentSummary[]> {
  return listStatuses();
}

export function focusAgent(agent: string, opts?: { switchClient?: boolean }): void {
  const normalized = normalizeAgentName(agent);
  if (!hasTmux()) {
    throw new Error("tmux is not installed.");
  }
  ensureSession();
  ensureWindow(normalized);
  const insideTmux = Boolean(process.env.TMUX);
  if (insideTmux) {
    const current = currentSessionName();
    if (current === "codex-mc") {
      focusWindow(normalized);
      return;
    }
    // Default behavior is to switch into mission-control when invoked from another tmux session.
    // Keep --switch option for CLI compatibility, but no longer require it.
    void opts;
    focusWindow(normalized);
    switchClient();
    return;
  }
  focusWindow(normalized);
  attachSession();
}

export function attachMissionControl(): void {
  if (!hasTmux()) {
    throw new Error("tmux is not installed.");
  }
  ensureSession();
  if (process.env.TMUX) {
    switchClient();
    return;
  }
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
  sendKeys(normalizeAgentName(agent), `echo \"Please refresh status: ${instruction}\"`);
}

export async function setStatus(agent: string, patch: AgentStatusPatch): Promise<AgentStatus> {
  return updateStatus(normalizeAgentName(agent), patch);
}

export async function getDashboardState(): Promise<{
  agents: AgentSummary[];
  mission: Awaited<ReturnType<typeof readActiveMission>>;
}> {
  const [agents, mission] = await Promise.all([listStatuses(), readActiveMission()]);
  const tmuxAvailable = hasTmux();
  const alerts = tmuxAvailable ? listWindowAlerts() : [];
  const prompts = tmuxAvailable ? listWindowApprovalPrompts() : [];
  const alertMap = new Map(alerts.map((a) => [canonicalAgentKey(a.window), a]));
  const promptSet = new Set(
    prompts.filter((p) => p.approval_prompt).map((p) => canonicalAgentKey(p.window)),
  );
  const withAttention = agents.map((a) => {
    const key = canonicalAgentKey(a.status.agent);
    const attention = alertMap.get(key);
    const bell = attention?.bell ?? false;
    const activity = attention?.activity ?? false;
    const silence = attention?.silence ?? false;
    const approval_prompt = promptSet.has(key);
    if (!bell && !activity && !silence && !approval_prompt) return a;
    return { ...a, attention: { bell, activity, silence, approval_prompt } };
  });
  return { agents: withAttention, mission };
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
  return getStatusPath(normalizeAgentName(agent));
}
