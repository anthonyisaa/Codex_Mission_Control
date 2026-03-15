#!/usr/bin/env node
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import {
  attachMissionControl,
  focusAgent,
  hasTmux,
  initRepo,
  listAgents,
  pingAgent,
  startMissionDay,
  startAgent,
} from "../core/index.js";
import { renderAgentsTable } from "../cli/table.js";
import { DashboardApp } from "../tui/DashboardApp.js";

const program = new Command();
program.name("mc").description("Codex Mission Control").version("0.1.0");

program
  .command("init")
  .description("Initialize .codex directory")
  .action(async () => {
    await initRepo();
    console.log("Initialized .codex/");
  });

program
  .command("day")
  .description("Mission day commands")
  .command("start")
  .requiredOption("--goals <goals>", "Semicolon-separated goals")
  .action(async (opts: { goals: string }) => {
    const out = await startMissionDay(opts.goals);
    console.log(`Mission day created: ${out.missionPath}`);
    console.log(`Goals: ${out.goals.join(" | ")}`);
  });

program
  .command("start")
  .description("Start an agent")
  .argument("<agent>")
  .option("--goal <goal>", "Optional starting goal (agent can define from context)")
  .option("--worktree <name>", "Optional git worktree suffix")
  .action(async (agent: string, opts: { goal?: string; worktree?: string }) => {
    const out = await startAgent({ agent, goal: opts.goal, worktree: opts.worktree });
    console.log(`Agent started: ${agent}`);
    console.log(`Status: ${out.statusPath}`);
    if (hasTmux()) {
      console.log(`Open session: mc focus ${agent}`);
    } else {
      console.log("tmux not found; agent bootstrap instruction:");
      console.log(out.bootstrap);
    }
  });

program
  .command("dashboard")
  .description("Open the dashboard")
  .action(() => {
    render(React.createElement(DashboardApp));
  });

program
  .command("focus")
  .description("Focus an agent tmux window")
  .argument("<agent>")
  .option("--switch", "Switch tmux client to mission-control session")
  .action((agent: string, opts: { switch?: boolean }) => {
    focusAgent(agent, { switchClient: Boolean(opts.switch) });
    console.log(`Focused ${agent}`);
  });

program
  .command("attach")
  .description("Attach to the mission-control tmux session")
  .action(() => {
    attachMissionControl();
  });

program
  .command("list")
  .description("List agent statuses")
  .action(async () => {
    const agents = await listAgents();
    console.log(renderAgentsTable(agents));
  });

program
  .command("ping")
  .description("Ping agent(s) to refresh status")
  .argument("[agent]")
  .option("--all", "Ping all agents")
  .action(async (agentArg: string | undefined, opts: { all?: boolean }) => {
    if (opts.all) {
      await pingAgent("all");
      console.log("Pinged all agents.");
      return;
    }
    if (!agentArg) {
      throw new Error("Provide an agent name or --all");
    }
    await pingAgent(agentArg);
    console.log(`Pinged ${agentArg}.`);
  });

if (process.argv.length <= 2) {
  render(React.createElement(DashboardApp));
} else {
  program.parseAsync(process.argv).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exitCode = 1;
  });
}
