import { spawnSync } from "node:child_process";
import { MC_SESSION } from "./paths.js";

function runTmux(args: string[]): { ok: boolean; output: string } {
  const result = spawnSync("tmux", args, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

export function hasTmux(): boolean {
  const res = spawnSync("tmux", ["-V"], { encoding: "utf8" });
  return res.status === 0;
}

export function ensureSession(session = MC_SESSION): void {
  const has = runTmux(["has-session", "-t", session]);
  if (!has.ok) {
    const created = runTmux(["new-session", "-d", "-s", session, "-n", "mission-control"]);
    if (!created.ok) {
      throw new Error(`Failed to create tmux session ${session}: ${created.output}`);
    }
  }
}

export function ensureWindow(agent: string, session = MC_SESSION): void {
  const target = `${session}:${agent}`;
  const has = runTmux(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!has.ok) {
    throw new Error(`Failed to list tmux windows: ${has.output}`);
  }
  if (has.output.split(/\r?\n/).includes(agent)) {
    return;
  }
  const created = runTmux(["new-window", "-t", session, "-n", agent]);
  if (!created.ok) {
    throw new Error(`Failed to create tmux window ${agent}: ${created.output}`);
  }
}

export function focusWindow(agent: string, session = MC_SESSION): void {
  const selected = runTmux(["select-window", "-t", `${session}:${agent}`]);
  if (!selected.ok) {
    throw new Error(`Failed to focus ${agent}: ${selected.output}`);
  }
}

export function attachSession(session = MC_SESSION): void {
  const attached = runTmux(["attach", "-t", session]);
  if (!attached.ok) {
    throw new Error(`Failed to attach ${session}: ${attached.output}`);
  }
}

export function sendKeys(agent: string, command: string, session = MC_SESSION): void {
  const sent = runTmux(["send-keys", "-t", `${session}:${agent}`, command, "C-m"]);
  if (!sent.ok) {
    throw new Error(`Failed to send keys to ${agent}: ${sent.output}`);
  }
}
