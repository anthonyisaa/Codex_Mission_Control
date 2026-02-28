import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { AGENTS_DIR, getAgentDir, getStatusPath } from "./paths.js";
import { agentStatusSchema, partialStatusSchema } from "./schema.js";
import { atomicWriteJson, ensureDir, exists, readJson } from "./fs.js";
import type { AgentStatus, AgentStatusPatch, AgentSummary } from "./types.js";

function shell(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8").trim();
  } catch {
    return "";
  }
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hydrateManager(status: AgentStatus): AgentStatus {
  return {
    ...status,
    progress: clampProgress(status.progress),
    manager: {
      objective: status.manager.objective || status.goal,
      where: status.manager.where || status.next || status.summary,
      request: status.manager.request || status.question || "",
    },
  };
}

function getGitArtifacts(cwd: string, worktreePath: string): AgentStatus["artifacts"] {
  const branch = shell("git rev-parse --abbrev-ref HEAD", cwd) || "unknown";
  const last_commit = shell("git rev-parse --short HEAD", cwd) || "unknown";
  const status = shell("git status --porcelain", cwd);
  return {
    branch,
    worktree_path: worktreePath,
    last_commit,
    git_dirty: status.length > 0,
    tests: "unknown",
  };
}

export function makeInitialStatus(agent: string, goal: string, cwd: string, worktreePath: string): AgentStatus {
  return {
    schema_version: "1",
    agent,
    goal,
    state: "running",
    last_done: "",
    next: "Start task",
    needs_input: false,
    question: "",
    summary: "Starting",
    progress: 0,
    manager: {
      objective: goal,
      where: "Planning approach",
      request: "",
    },
    updated_at: toIsoNow(),
    artifacts: getGitArtifacts(cwd, worktreePath),
  };
}

export async function writeStatus(agent: string, status: AgentStatus): Promise<string> {
  const parsed = hydrateManager(agentStatusSchema.parse(status));
  const statusPath = getStatusPath(agent);
  await atomicWriteJson(statusPath, parsed);
  return statusPath;
}

export async function readStatus(agent: string): Promise<AgentStatus> {
  const statusPath = getStatusPath(agent);
  const value = await readJson<unknown>(statusPath);
  return hydrateManager(agentStatusSchema.parse(value));
}

export async function updateStatus(agent: string, patch: AgentStatusPatch): Promise<AgentStatus> {
  partialStatusSchema.parse(patch);
  const current = await readStatus(agent);
  const merged: AgentStatus = {
    ...current,
    ...patch,
    agent: current.agent,
    updated_at: new Date().toISOString(),
    progress: patch.progress === undefined ? current.progress : clampProgress(patch.progress),
    manager: {
      ...current.manager,
      ...(patch.manager ?? {}),
    },
    artifacts: {
      ...current.artifacts,
      ...(patch.artifacts ?? {}),
    },
  };
  merged.manager.objective = merged.manager.objective || merged.goal;
  merged.manager.where = merged.manager.where || merged.next || merged.summary;
  if (!merged.manager.request && merged.question) {
    merged.manager.request = merged.question;
  }
  if (!merged.question && merged.manager.request) {
    merged.question = merged.manager.request;
  }
  if (merged.state === "needs_input") {
    merged.needs_input = true;
  }
  if (merged.needs_input && merged.manager.request && !merged.question) {
    merged.question = merged.manager.request;
  }
  if (merged.needs_input && !merged.question) {
    merged.question = "User input required";
  }
  if (merged.needs_input && !merged.manager.request) {
    merged.manager.request = merged.question;
  }
  if (!merged.needs_input && merged.state !== "needs_input") {
    if (patch.manager?.request !== undefined) {
      merged.manager.request = patch.manager.request;
    } else if (patch.question !== undefined) {
      merged.manager.request = patch.question;
    } else if (patch.needs_input === false || (patch.state !== undefined && patch.state !== "needs_input")) {
      merged.manager.request = "";
    }
  }
  await writeStatus(agent, merged);
  return merged;
}

export async function listStatuses(staleMinutes = 10): Promise<AgentSummary[]> {
  if (!(await exists(AGENTS_DIR))) {
    return [];
  }
  const entries = await fs.readdir(AGENTS_DIR, { withFileTypes: true });
  const statuses: AgentSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const statusPath = path.join(getAgentDir(entry.name), "status.json");
    if (!(await exists(statusPath))) continue;
    try {
      const status = hydrateManager(agentStatusSchema.parse(await readJson<unknown>(statusPath)));
      const ageMs = Date.now() - new Date(status.updated_at).getTime();
      const stale = Number.isFinite(ageMs) && ageMs > staleMinutes * 60_000;
      const color: AgentSummary["color"] = status.state === "blocked" || status.state === "needs_input"
        ? "red"
        : stale
          ? "yellow"
          : status.state === "done"
            ? "green"
            : "green";
      statuses.push({ status, stale, color });
    } catch {
      continue;
    }
  }
  return statuses.sort((a, b) => Number(b.status.needs_input) - Number(a.status.needs_input));
}

export function bootstrapInstruction(agent: string, statusPath: string): string {
  return [
    `You are agent ${agent}.`,
    `Status file: ${statusPath}`,
    "Update this JSON at start, after meaningful steps, when blocked, before asking for help, and when done.",
    "When asking for a decision, always set manager.objective, manager.where, and manager.request.",
    "Keep summary concise. Set needs_input=true when you need user action.",
    "Preferred: run `mc-status` commands instead of manual edits.",
  ].join("\n");
}

export async function ensureAgentDir(agent: string): Promise<string> {
  const dir = getAgentDir(agent);
  await ensureDir(dir);
  return dir;
}
