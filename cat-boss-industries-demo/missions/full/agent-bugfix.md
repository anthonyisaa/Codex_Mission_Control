# Agent Bugfix Brief

## Source artifact
`docs/issues/GH-128-blocked-filter-refresh.md`

## Responsibilities
- Reproduce and patch blocked-filter refresh mismatch.
- Add regression coverage for query param mapping.
- Publish root cause in completion summary.

## Required status cadence
```bash
mc-status set --agent agent-bugfix --state running --summary "Reproducing GH-128" --next "Trace status query mapping"
# If blocked:
mc-status need-input --agent agent-bugfix --question "Need confirmation on legacy alias support" --summary "Decision needed for mapping behavior"
mc-status set --agent agent-bugfix --state running --clear-needs-input --summary "Alias policy confirmed" --next "Finalize regression tests"
mc-status done --agent agent-bugfix --last-done "GH-128 fixed with regression test" --summary "Root cause documented"
```
