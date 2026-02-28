# Full Demo Launch (Artifact-Driven)

## Mission kickoff
```bash
mc init
mc day start --goals "Implement PRD-004 escalation flow;Resolve GH-128 blocked-filter regression;Ship DR-011 console redesign"
mc start agent-feature --goal "Implement PRD-004 from docs/prd/PRD-004-incident-escalation.md with tests"
mc start agent-bugfix --goal "Fix GH-128 from docs/issues/GH-128-blocked-filter-refresh.md and add regression coverage"
mc start agent-ui --goal "Execute DR-011 from docs/design/DR-011-ops-console-refresh.md with responsive overhaul"
```

## References
- Feature: `docs/prd/PRD-004-incident-escalation.md`
- Bug: `docs/issues/GH-128-blocked-filter-refresh.md`
- UI: `docs/design/DR-011-ops-console-refresh.md`
- Handoff: `docs/decisions/DEC-002-severity-contract.md`
