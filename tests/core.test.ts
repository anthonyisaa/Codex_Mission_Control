import { describe, expect, it } from "vitest";
import { agentStatusSchema } from "../src/core/schema.js";
import { parseGoals } from "../src/core/mission.js";

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
