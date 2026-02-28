# Agent Gamma Quick Script

```bash
mc-status set --agent agent-gamma --state running --summary "Reviewing UI mock" --next "Confirm spacing token"
sleep 12
mc-status need-input --agent agent-gamma --question "Choose compact or roomy card density?" --summary "Design decision needed"
sleep 18
mc-status set --agent agent-gamma --state running --clear-needs-input --summary "Density decided" --next "Finalize"
sleep 15
mc-status done --agent agent-gamma --last-done "UI simulation complete" --summary "Done"
```
