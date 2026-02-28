# PRD-004: Incident Escalation Workflow

## Goal
Improve response quality by enforcing stricter metadata for high-risk incidents.

## Requirements
1. Add `severity` to incidents with values `low|medium|high|critical`.
2. Critical incidents must include:
- `escalationOwner` (email)
- `escalationDueAt` (ISO datetime)
3. Severity changes must create an activity log entry.
4. API endpoints must validate these rules.

## Acceptance Criteria
- Creating/updating critical incidents without owner or due date fails validation.
- Severity updates append activity records.
- UI displays severity badges and escalation metadata.
