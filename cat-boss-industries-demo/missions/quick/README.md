# Quick 2-Minute Demo

Purpose: demonstrate Mission Control dashboard triage, not code changes.

## Launch
```bash
mc init
mc day start --goals "Quick queue demo;Show needs_input routing;Close all agents"
mc start agent-alpha --goal "Simulate feature lifecycle"
mc start agent-beta --goal "Simulate bug lifecycle"
mc start agent-gamma --goal "Simulate UI lifecycle"
```

## Agent scripts
- [agent-alpha.md](agent-alpha.md)
- [agent-beta.md](agent-beta.md)
- [agent-gamma.md](agent-gamma.md)
