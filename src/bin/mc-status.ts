#!/usr/bin/env node
import { Command } from "commander";
import { setStatus } from "../core/index.js";
import type { AgentStatusPatch, ManagerView } from "../core/types.js";

const program = new Command();
program.name("mc-status").description("Update agent status safely").version("0.1.0");

function notifyAttention(): void {
  if (process.stdout.isTTY) {
    process.stdout.write("\u0007");
  }
}

program
  .command("set")
  .requiredOption("--agent <agent>", "Agent name")
  .option("--state <state>", "running|blocked|needs_input|done")
  .option("--summary <summary>", "One-line summary")
  .option("--objective <objective>", "What this agent is trying to achieve")
  .option("--where <where>", "Where this agent is in the process")
  .option("--request <request>", "Decision/request for the manager")
  .option("--next <next>", "Next action")
  .option("--last-done <lastDone>", "Last done line")
  .option("--question <question>", "Question for user")
  .option("--needs-input", "Require user input")
  .option("--clear-needs-input", "Clear needs-input state")
  .action(async (opts) => {
    const patch: AgentStatusPatch = {};
    const managerPatch: Partial<ManagerView> = {};
    if (opts.state) patch.state = opts.state;
    if (opts.summary) patch.summary = opts.summary;
    if (opts.objective) managerPatch.objective = opts.objective;
    if (opts.where) managerPatch.where = opts.where;
    if (opts.request) managerPatch.request = opts.request;
    if (opts.next) patch.next = opts.next;
    if (opts.lastDone) patch.last_done = opts.lastDone;
    if (opts.question || opts.request) patch.question = opts.question ?? opts.request;
    if (opts.needsInput) patch.needs_input = true;
    if (opts.clearNeedsInput) {
      patch.needs_input = false;
      patch.question = "";
      managerPatch.request = "";
    }
    if (Object.keys(managerPatch).length > 0) {
      patch.manager = managerPatch;
    }

    const out = await setStatus(opts.agent, patch);
    console.log(`Updated ${out.agent}: ${out.state} (${out.summary})`);
    if (out.needs_input) notifyAttention();
  });

program
  .command("need-input")
  .requiredOption("--agent <agent>", "Agent name")
  .requiredOption("--question <question>", "Question for user")
  .option("--objective <objective>", "What the agent is trying to achieve")
  .option("--where <where>", "Where the agent is in the process")
  .option("--summary <summary>", "Optional summary")
  .action(async (opts) => {
    const manager: Partial<ManagerView> = {
      request: opts.question,
    };
    if (opts.objective) manager.objective = opts.objective;
    if (opts.where) manager.where = opts.where;

    const out = await setStatus(opts.agent, {
      state: "needs_input",
      needs_input: true,
      question: opts.question,
      summary: opts.summary ?? "Decision needed from manager",
      next: opts.where ?? "Waiting on manager decision",
      manager,
    });
    console.log(`Updated ${out.agent}: needs_input`);
    notifyAttention();
  });

program
  .command("decision")
  .requiredOption("--agent <agent>", "Agent name")
  .requiredOption("--request <request>", "Decision needed from manager")
  .requiredOption("--where <where>", "Where the agent is in the process")
  .option("--objective <objective>", "What the agent is trying to achieve")
  .option("--summary <summary>", "Optional summary")
  .action(async (opts) => {
    const out = await setStatus(opts.agent, {
      state: "needs_input",
      needs_input: true,
      question: opts.request,
      summary: opts.summary ?? "Decision needed from manager",
      next: opts.where,
      manager: {
        objective: opts.objective ?? "",
        where: opts.where,
        request: opts.request,
      },
    });
    console.log(`Updated ${out.agent}: needs_input`);
    notifyAttention();
  });

program
  .command("done")
  .requiredOption("--agent <agent>", "Agent name")
  .requiredOption("--last-done <lastDone>", "Completion summary")
  .option("--objective <objective>", "Optional objective override")
  .option("--where <where>", "Where to record completion stage")
  .option("--summary <summary>", "Optional summary")
  .action(async (opts) => {
    const managerPatch: Partial<ManagerView> = { request: "" };
    if (opts.objective) managerPatch.objective = opts.objective;
    if (opts.where) managerPatch.where = opts.where;

    const out = await setStatus(opts.agent, {
      state: "done",
      last_done: opts.lastDone,
      summary: opts.summary ?? "Task completed",
      needs_input: false,
      question: "",
      manager: managerPatch,
    });
    console.log(`Updated ${out.agent}: done`);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${msg}`);
  process.exitCode = 1;
});
