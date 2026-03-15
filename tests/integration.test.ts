import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initRepo,
  listAgents,
  readActiveMission,
  readStatus,
  setStatus,
  startAgent,
  startMissionDay,
} from "../src/core/index.js";

const originalCwd = process.cwd();
const noTmuxPath = "/usr/bin:/bin:/usr/sbin:/sbin";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllEnvs();
});

describe.sequential("integration flow", () => {
  it("bootstraps a mission day and agent status outside tmux", async () => {
    const repoRoot = await makeTempDir("codex-mc-flow-");
    process.chdir(repoRoot);
    vi.stubEnv("PATH", noTmuxPath);

    await initRepo();
    const missionDay = await startMissionDay("Coordinate agents;Route approvals");
    const started = await startAgent({
      agent: "reviewer",
      goal: "Validate decision inbox",
      repoRoot,
    });

    expect(await fs.readFile(path.join(repoRoot, "AGENTS.md"), "utf8")).toContain(
      "## Mission Control Status Contract",
    );
    expect(started.bootstrap).toContain("heartbeat update");

    await setStatus("reviewer", {
      state: "needs_input",
      needs_input: true,
      summary: "Need release decision",
      question: "Approve release candidate?",
      manager: {
        objective: "Validate decision inbox",
        where: "Smoke-tested the coordination loop",
        request: "Approve release candidate?",
      },
    });

    const mission = await readActiveMission();
    const agents = await listAgents();
    const status = await readStatus("reviewer");

    expect(mission?.path).toBe(missionDay.missionPath);
    expect(mission?.goals.map((goal) => goal.text)).toEqual(["Coordinate agents", "Route approvals"]);
    expect(agents).toHaveLength(1);
    expect(agents[0]?.status.agent).toBe("reviewer");
    expect(agents[0]?.status.needs_input).toBe(true);
    expect(status.manager.request).toBe("Approve release candidate?");
    expect(status.manager.where).toBe("Smoke-tested the coordination loop");
  });

  it("creates and reuses a named git worktree for an agent", async () => {
    const repoRoot = await makeTempDir("codex-mc-worktree-");
    process.chdir(repoRoot);
    vi.stubEnv("PATH", noTmuxPath);

    git(repoRoot, "init");
    git(repoRoot, "config", "user.name", "Codex Mission Control");
    git(repoRoot, "config", "user.email", "codex@example.com");
    await fs.writeFile(path.join(repoRoot, "README.md"), "demo\n", "utf8");
    git(repoRoot, "add", "README.md");
    git(repoRoot, "commit", "-m", "init");

    const first = await startAgent({
      agent: "agent-alpha",
      goal: "Prototype coordination demo",
      worktree: "agent-alpha",
      repoRoot,
    });
    const second = await startAgent({
      agent: "agent-alpha",
      goal: "Prototype coordination demo",
      worktree: "agent-alpha",
      repoRoot,
    });
    const status = await readStatus("agent-alpha");

    expect(first.cwd).toBe(second.cwd);
    expect(status.artifacts.branch).toBe("codex/agent-alpha");
    expect(git(first.cwd, "rev-parse", "--abbrev-ref", "HEAD")).toBe("codex/agent-alpha");
    expect(await fs.readFile(path.join(first.cwd, "README.md"), "utf8")).toContain("demo");
  });
});
