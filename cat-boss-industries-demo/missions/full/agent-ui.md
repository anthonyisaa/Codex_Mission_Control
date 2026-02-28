# Agent UI Brief

## Source artifact
`docs/design/DR-011-ops-console-refresh.md`

## Responsibilities
- Deliver high-fidelity layout and card redesign.
- Preserve filtering behavior and data semantics.
- Mid-flight handoff check against `docs/decisions/DEC-002-severity-contract.md`.

## Required status cadence
```bash
mc-status set --agent agent-ui --state running --summary "Applying DR-011 layout overhaul" --next "Ship responsive sidebar + cards"
mc-status need-input --agent agent-ui --question "Confirm severity labels from DEC-002 are final" --summary "Waiting on feature contract handoff"
mc-status set --agent agent-ui --state running --clear-needs-input --summary "DEC-002 confirmed" --next "Finalize accessibility checks"
mc-status done --agent agent-ui --last-done "DR-011 redesign merged" --summary "Ready for review"
```
