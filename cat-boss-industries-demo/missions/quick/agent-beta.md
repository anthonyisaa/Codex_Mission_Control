# Agent Beta Quick Script

```bash
mc-status set --agent agent-beta --state running --summary "Investigating synthetic bug" --next "Request missing logs"
sleep 10
mc-status need-input --agent agent-beta --question "Need access to prod-like logs" --summary "Missing evidence"
sleep 15
mc-status set --agent agent-beta --state running --clear-needs-input --summary "Logs received" --next "Patch + verify"
sleep 20
mc-status done --agent agent-beta --last-done "Regression simulated and closed" --summary "Done"
```
