# Codex Mission Control

tmux-first mission control for running multiple Codex agents with structured status, attention routing, and a live dashboard.

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
mc start agent-a --goal "Ship feature X"
mc start agent-b --goal "Fix bug Y"
mc dashboard
```

## Commands

- `mc init`
- `mc day start --goals "A;B;C"`
- `mc start <agent> --goal "..." [--worktree <name>]`
- `mc dashboard` (or just `mc`)
- `mc list`
- `mc focus <agent>`
- `mc attach`
- `mc ping <agent>` or `mc ping --all`

Status helper:

- `mc-status set --agent <name> --state running --summary "..."`
- `mc-status need-input --agent <name> --question "..."`
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

## Demo Loop

1. Start two agents.
2. Run `mc-status need-input --agent agent-a --question "Need API key"`.
3. Observe queue in `mc dashboard`.
4. Resolve and run `mc-status set --agent agent-a --state running --clear-needs-input --summary "Resumed"`.
5. Finish with `mc-status done --agent agent-a --last-done "Merged changes"`.
