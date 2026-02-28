export type AgentState = "running" | "blocked" | "needs_input" | "done";

export type TestState = "unknown" | "running" | "pass" | "fail";

export interface ManagerView {
  objective: string;
  where: string;
  request: string;
}

export interface Artifacts {
  branch: string;
  worktree_path: string;
  last_commit: string;
  git_dirty: boolean;
  tests: TestState;
}

export interface AgentStatus {
  schema_version: "1";
  agent: string;
  goal: string;
  state: AgentState;
  last_done: string;
  next: string;
  needs_input: boolean;
  question: string;
  summary: string;
  progress: number;
  manager: ManagerView;
  updated_at: string;
  artifacts: Artifacts;
}

export interface AgentSummary {
  status: AgentStatus;
  stale: boolean;
  color: "red" | "yellow" | "green";
  attention?: {
    bell: boolean;
    activity: boolean;
    silence: boolean;
    approval_prompt: boolean;
  };
}

export type AgentStatusPatch = Partial<Omit<AgentStatus, "artifacts" | "manager">> & {
  artifacts?: Partial<Artifacts>;
  manager?: Partial<ManagerView>;
};

export interface MissionGoal {
  id: number;
  text: string;
  agent?: string;
}
