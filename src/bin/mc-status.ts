#!/usr/bin/env node
import { Command } from "commander";
import { setStatus } from "../core/index.js";

const program = new Command();
program.name("mc-status").description("Update agent status safely").version("0.1.0");

program
  .command("set")
  .requiredOption("--agent <agent>", "Agent name")
  .option("--state <state>", "running|blocked|needs_input|done")
  .option("--summary <summary>", "One-line summary")
  .option("--next <next>", "Next action")
  .option("--last-done <lastDone>", "Last done line")
  .option("--question <question>", "Question for user")
  .option("--needs-input", "Require user input")
  .option("--clear-needs-input", "Clear needs-input state")
  .action(async (opts) => {
    const patch: Record<string, unknown> = {};
    if (opts.state) patch.state = opts.state;
    if (opts.summary) patch.summary = opts.summary;
    if (opts.next) patch.next = opts.next;
    if (opts.lastDone) patch.last_done = opts.lastDone;
    if (opts.question) patch.question = opts.question;
    if (opts.needsInput) patch.needs_input = true;
    if (opts.clearNeedsInput) patch.needs_input = false;

    const out = await setStatus(opts.agent, patch);
    console.log(`Updated ${out.agent}: ${out.state} (${out.summary})`);
  });

program
  .command("need-input")
  .requiredOption("--agent <agent>", "Agent name")
  .requiredOption("--question <question>", "Question for user")
  .option("--summary <summary>", "Optional summary")
  .action(async (opts) => {
    const out = await setStatus(opts.agent, {
      state: "needs_input",
      needs_input: true,
      question: opts.question,
      summary: opts.summary ?? "Blocked; waiting for user input",
    });
    console.log(`Updated ${out.agent}: needs_input`);
  });

program
  .command("done")
  .requiredOption("--agent <agent>", "Agent name")
  .requiredOption("--last-done <lastDone>", "Completion summary")
  .option("--summary <summary>", "Optional summary")
  .action(async (opts) => {
    const out = await setStatus(opts.agent, {
      state: "done",
      last_done: opts.lastDone,
      summary: opts.summary ?? "Task completed",
      needs_input: false,
      question: "",
    });
    console.log(`Updated ${out.agent}: done`);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${msg}`);
  process.exitCode = 1;
});
