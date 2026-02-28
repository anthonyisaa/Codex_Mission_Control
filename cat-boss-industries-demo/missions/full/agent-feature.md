# Agent Feature Brief

## Source artifact
`docs/prd/PRD-004-incident-escalation.md`

## Responsibilities
- Implement severity workflow and critical constraints.
- Update API behavior and add validation tests.
- Own and maintain `docs/decisions/DEC-002-severity-contract.md`.

## Required status cadence
```bash
mc-status set --agent agent-feature --state running --summary "Parsed PRD-004" --next "Implement schema + validation"
# If blocked:
mc-status need-input --agent agent-feature --question "Need decision on severity label wording" --summary "Pending contract decision"
mc-status set --agent agent-feature --state running --clear-needs-input --summary "Contract resolved" --next "Complete tests"
mc-status done --agent agent-feature --last-done "PRD-004 delivered with tests" --summary "Ready for review"
```
