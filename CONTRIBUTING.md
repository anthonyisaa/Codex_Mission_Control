# Contributing

Thanks for taking a look at Codex Mission Control.

## Local Setup

```bash
npm install
npm test
npm run build
```

Optional local tools:

- `tmux` for the full dashboard and agent-window workflow
- `codex` on `PATH` if you want `mc start` to launch agent terminals automatically

## Development Notes

- The coordination contract matters as much as the CLI surface.
- If you change status semantics, update both the README and tests.
- Prefer adding or tightening tests when changing worktree logic, dashboard attention behavior, or status hydration.
- The dashboard is intentionally terminal-first; keep new features consistent with that workflow unless there is a strong reason to branch out.

## Pull Requests

Before opening a PR:

1. Run `npm test`.
2. Run `npm run build`.
3. Update docs if the user-facing coordination flow changed.
4. Keep changes focused; coordination logic, packaging, and UI polish are all welcome, but mixed refactors are harder to review.

## Reporting Bugs

Bug reports are most helpful when they include:

- the command you ran
- whether tmux was installed and active
- the relevant `.codex/agents/<agent>/status.json` payload if status handling is involved
- screenshots or terminal output for dashboard issues
