# Agent Alpha Quick Script

```bash
mc-status set --agent agent-alpha --state running --summary "Parsed quick demo brief" --next "Simulate user dependency"
sleep 15
mc-status need-input --agent agent-alpha --question "Need approval on rollout wording" --summary "Blocked on stakeholder copy"
sleep 20
mc-status set --agent agent-alpha --state running --clear-needs-input --summary "Copy approved" --next "Close ticket"
sleep 15
mc-status done --agent agent-alpha --last-done "Feature simulation complete" --summary "Done"
```
