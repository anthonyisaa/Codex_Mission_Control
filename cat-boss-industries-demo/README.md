# Cat Boss Industries Demo

A Mission Control demo repository designed to simulate a realistic day in the life of a dev team.

## Stack
- Next.js + TypeScript
- Prisma + SQLite
- Vitest
- Playwright

## Local setup
```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## Mission Control quick start
```bash
mc init
mc day start --goals "Quick queue demo;Show needs_input routing;Close all agents"
mc start agent-alpha --goal "Simulate feature lifecycle" 
mc start agent-beta --goal "Simulate bug lifecycle"
mc start agent-gamma --goal "Simulate UI lifecycle"
```

See [missions/quick/README.md](missions/quick/README.md) and [missions/full/launch.md](missions/full/launch.md).
