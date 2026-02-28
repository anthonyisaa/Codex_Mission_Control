import { describe, expect, it } from "vitest";
import { agentStatusSchema } from "../src/core/schema.js";
import { upsertMissionControlContract } from "../src/core/agentsMd.js";
import { parseGoals } from "../src/core/mission.js";
import { canonicalAgentKey, normalizeAgentName } from "../src/core/agentName.js";

describe("mission goal parsing", () => {
  it("splits by semicolon and trims to five", () => {
    const goals = parseGoals("A; B ; ; C;D;E;F");
    expect(goals).toEqual(["A", "B", "C", "D", "E"]);
  });
});

describe("status schema", () => {
  it("accepts valid status payload", () => {
    const parsed = agentStatusSchema.parse({
      schema_version: "1",
      agent: "agent-a",
      goal: "Ship feature",
      state: "running",
      last_done: "",
      next: "edit file",
      needs_input: false,
      question: "",
      summary: "working",
      progress: 40,
      manager: {
        objective: "Ship feature",
        where: "Implementing API route",
        request: "",
      },
      updated_at: new Date().toISOString(),
      artifacts: {
        branch: "main",
        worktree_path: "/tmp/repo",
        last_commit: "abc123",
        git_dirty: true,
        tests: "unknown",
      },
    });
    expect(parsed.agent).toBe("agent-a");
  });

  it("hydrates new manager fields for legacy payloads", () => {
    const parsed = agentStatusSchema.parse({
      schema_version: "1",
      agent: "agent-a",
      goal: "Ship feature",
      state: "running",
      last_done: "",
      next: "edit file",
      needs_input: false,
      question: "",
      summary: "working",
      updated_at: new Date().toISOString(),
      artifacts: {
        branch: "main",
        worktree_path: "/tmp/repo",
        last_commit: "abc123",
        git_dirty: true,
        tests: "unknown",
      },
    });
    expect(parsed.progress).toBe(0);
    expect(parsed.manager.objective).toBe("");
    expect(parsed.manager.where).toBe("");
    expect(parsed.manager.request).toBe("");
  });

  it("rejects invalid state", () => {
    expect(() =>
      agentStatusSchema.parse({
        schema_version: "1",
        agent: "agent-a",
        goal: "Ship feature",
        state: "bad",
        last_done: "",
        next: "",
        needs_input: false,
        question: "",
        summary: "",
        progress: 10,
        manager: {
          objective: "Ship feature",
          where: "",
          request: "",
        },
        updated_at: new Date().toISOString(),
        artifacts: {
          branch: "main",
          worktree_path: "/tmp/repo",
          last_commit: "abc123",
          git_dirty: true,
          tests: "unknown",
        },
      }),
    ).toThrow();
  });

  it("rejects progress outside 0-100", () => {
    expect(() =>
      agentStatusSchema.parse({
        schema_version: "1",
        agent: "agent-a",
        goal: "Ship feature",
        state: "running",
        last_done: "",
        next: "",
        needs_input: false,
        question: "",
        summary: "",
        progress: 101,
        manager: {
          objective: "Ship feature",
          where: "",
          request: "",
        },
        updated_at: new Date().toISOString(),
        artifacts: {
          branch: "main",
          worktree_path: "/tmp/repo",
          last_commit: "abc123",
          git_dirty: true,
          tests: "unknown",
        },
      }),
    ).toThrow();
  });
});

describe("agent name normalization", () => {
  it("normalizes smart dash variants to hyphen-minus", () => {
    expect(normalizeAgentName("agent–alpha")).toBe("agent-alpha");
  });

  it("produces stable canonical keys across dash variants", () => {
    expect(canonicalAgentKey("agent-alpha")).toBe(canonicalAgentKey("agent–alpha"));
  });
});

describe("AGENTS.md mission-control contract", () => {
  it("adds mission-control section to empty content", () => {
    const out = upsertMissionControlContract("");
    expect(out).toContain("## Mission Control Status Contract");
    expect(out).toContain("<!-- MC:BEGIN -->");
    expect(out).toContain("<!-- MC:END -->");
  });

  it("appends mission-control section without removing existing content", () => {
    const out = upsertMissionControlContract("# Existing\n\nKeep this.\n");
    expect(out).toContain("# Existing");
    expect(out).toContain("Keep this.");
    expect(out).toContain("## Mission Control Status Contract");
  });

  it("updates existing mission-control section idempotently", () => {
    const once = upsertMissionControlContract("# Existing\n\n<!-- MC:BEGIN -->\nOld\n<!-- MC:END -->\n");
    const twice = upsertMissionControlContract(once);
    expect(twice).toBe(once);
    expect(twice).not.toContain("\nOld\n");
  });
});
