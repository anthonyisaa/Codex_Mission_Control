import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { AGENTS_DIR, getAgentDir, getStatusPath } from "./paths.js";
import { agentStatusSchema, partialStatusSchema } from "./schema.js";
import { atomicWriteJson, ensureDir, exists, readJson } from "./fs.js";
import type { AgentStatus, AgentSummary } from "./types.js";

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
    updated_at: toIsoNow(),
    artifacts: getGitArtifacts(cwd, worktreePath),
  };
}

export async function writeStatus(agent: string, status: AgentStatus): Promise<string> {
  const parsed = agentStatusSchema.parse(status);
  const statusPath = getStatusPath(agent);
  await atomicWriteJson(statusPath, parsed);
  return statusPath;
}

export async function readStatus(agent: string): Promise<AgentStatus> {
  const statusPath = getStatusPath(agent);
  const value = await readJson<unknown>(statusPath);
  return agentStatusSchema.parse(value);
}

export async function updateStatus(agent: string, patch: Partial<AgentStatus>): Promise<AgentStatus> {
  partialStatusSchema.parse(patch);
  const current = await readStatus(agent);
  const merged: AgentStatus = {
    ...current,
    ...patch,
    agent: current.agent,
    updated_at: new Date().toISOString(),
    artifacts: {
      ...current.artifacts,
      ...(patch.artifacts ?? {}),
    },
  };
  if (merged.state === "needs_input") {
    merged.needs_input = true;
  }
  if (merged.needs_input && !merged.question) {
    merged.question = "User input required";
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
      const status = agentStatusSchema.parse(await readJson<unknown>(statusPath));
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
    "Keep summary and question concise. Set needs_input=true when you need user action.",
    "Preferred: run `mc-status` commands instead of manual edits.",
  ].join("\n");
}

export async function ensureAgentDir(agent: string): Promise<string> {
  const dir = getAgentDir(agent);
  await ensureDir(dir);
  return dir;
}
