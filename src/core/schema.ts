import { z } from "zod";

export const agentStateSchema = z.enum(["running", "blocked", "needs_input", "done"]);
export const testStateSchema = z.enum(["unknown", "running", "pass", "fail"]);

export const artifactsSchema = z.object({
  branch: z.string(),
  worktree_path: z.string(),
  last_commit: z.string(),
  git_dirty: z.boolean(),
  tests: testStateSchema,
});

export const agentStatusSchema = z.object({
  schema_version: z.literal("1"),
  agent: z.string().min(1),
  goal: z.string().min(1),
  state: agentStateSchema,
  last_done: z.string(),
  next: z.string(),
  needs_input: z.boolean(),
  question: z.string(),
  summary: z.string(),
  updated_at: z.string(),
  artifacts: artifactsSchema,
});

export const partialStatusSchema = agentStatusSchema.partial();
