# Codex Mission Control

tmux-first mission control for running multiple Codex agents with structured status, attention routing, and a live dashboard.

Designed for a manager workflow: spin up agents quickly, see agent status across all tasks, and review a decision inbox with clear context.

## Requirements

- Node.js 20+
- tmux (optional but recommended)
- Codex CLI on PATH for `mc start` automation

## Install

```bash
npm install
npm run build
npm link
```

## Quickstart

```bash
mc init
mc day start --goals "Ship feature X;Fix bug Y;Improve UI Z"
mc start agent-a
mc start agent-b
mc dashboard
```

`mc init` now also ensures the project-level `AGENTS.md` contains a Mission Control contract block (idempotent, marker-based) so new Codex sessions follow the standard status-update behavior.

## Commands

- `mc init`
- `mc day start --goals "A;B;C"`
- `mc start <agent> [--goal "..."] [--worktree <name>]`
- `mc dashboard` (or just `mc`)
- `mc list`
- `mc focus <agent>`
- `mc attach`
- `mc ping <agent>` or `mc ping --all`

Status helper:

- `mc-status set --agent <name> --state running --summary "..."`
- `mc-status need-input --agent <name> --question "..." --where "..."`
- `mc-status decision --agent <name> --request "..." --where "..."`
- `mc-status done --agent <name> --last-done "..."`

## Status Contract

Each agent writes `.codex/agents/<agent>/status.json`:

```json
{
  "schema_version": "1",
  "agent": "agent-auth",
  "goal": "Fix login redirect bug",
  "state": "running",
  "last_done": "",
  "next": "Investigate middleware",
  "needs_input": false,
  "question": "",
  "summary": "Tracing auth callback",
  "manager": {
    "objective": "Fix login redirect bug",
    "where": "Validated callback path, comparing cookie behavior",
    "request": ""
  },
  "updated_at": "2026-02-28T10:00:00.000Z",
  "artifacts": {
    "branch": "mc/agent-auth",
    "worktree_path": "/path/to/worktree",
    "last_commit": "abc1234",
    "git_dirty": true,
    "tests": "unknown"
  }
}
```

Manager fields:
- `goal` and `manager.objective`: what we are trying to do
- `manager.where`: where we are in the process right now
- `manager.request`/`question`: explicit request that needs your decision

Dashboard behavior:
- `Decision Inbox` shows only agents blocked on manager input with objective, process location, and request.
- `Terminal Attention` shows tmux `bell`/`activity`/`silence` alerts for agent windows.
- `Agents` gives a compact list with state.
- `Selected Agent` shows full context: objective, where, last done, next, and ask.
- Dashboard refreshes on file changes and also polls every 2 seconds so terminal alerts appear even without status-file writes.

Attention behavior:
- `mc-status need-input`, `mc-status decision`, and `mc-status set --needs-input` ring a terminal bell to mark the agent window as needing attention.
- Dashboard also inspects Codex pane text and marks `approval` attention when it sees the interactive command-approval prompt.
- In the agents list, `!` means terminal attention is active for that agent.

## Demo Loop

1. Start two agents.
2. Run `mc-status decision --agent agent-a --where "Ready to wire provider in login callback" --request "Choose OAuth provider: Auth0 or Clerk?"`.
3. Observe queue in `mc dashboard`.
4. Resolve and run `mc-status set --agent agent-a --state running --clear-needs-input --summary "Resumed with Auth0" --where "Implementing provider wiring"`.
5. Finish with `mc-status done --agent agent-a --last-done "Merged changes"`.
