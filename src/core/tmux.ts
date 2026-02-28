import { spawnSync } from "node:child_process";
import { MC_SESSION } from "./paths.js";
import { canonicalAgentKey } from "./agentName.js";

function runTmux(args: string[]): { ok: boolean; output: string } {
  const result = spawnSync("tmux", args, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function runTmuxInteractive(args: string[]): { ok: boolean; output: string } {
  const result = spawnSync("tmux", args, { stdio: "inherit" });
  return {
    ok: result.status === 0,
    output: result.signal ? `signal ${result.signal}` : `exit ${result.status ?? "unknown"}`,
  };
}

function asFlag(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "1" || v === "on" || v === "yes";
}

function hasApprovalPrompt(view: string): boolean {
  const text = view.toLowerCase();
  return (
    text.includes("would you like to run the following command?") &&
    text.includes("press enter to confirm or esc to cancel")
  );
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

export function ensureWindow(agent: string, session = MC_SESSION): boolean {
  const has = runTmux(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!has.ok) {
    throw new Error(`Failed to list tmux windows: ${has.output}`);
  }
  const requested = canonicalAgentKey(agent);
  const names = has.output.split(/\r?\n/).filter(Boolean);
  let target = names.find((name) => canonicalAgentKey(name) === requested);
  let created = false;
  if (!target) {
    const createdWindow = runTmux(["new-window", "-t", session, "-n", agent]);
    if (!createdWindow.ok) {
      throw new Error(`Failed to create tmux window ${agent}: ${createdWindow.output}`);
    }
    target = agent;
    created = true;
  }
  const activity = runTmux(["set-window-option", "-t", `${session}:${target}`, "monitor-activity", "on"]);
  if (!activity.ok) {
    throw new Error(`Failed to enable monitor-activity for ${agent}: ${activity.output}`);
  }
  const bell = runTmux(["set-window-option", "-t", `${session}:${target}`, "monitor-bell", "on"]);
  if (!bell.ok) {
    throw new Error(`Failed to enable monitor-bell for ${agent}: ${bell.output}`);
  }
  return created;
}

export function focusWindow(agent: string, session = MC_SESSION): void {
  const windows = runTmux(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!windows.ok) {
    throw new Error(`Failed to list tmux windows: ${windows.output}`);
  }
  const requested = canonicalAgentKey(agent);
  const names = windows.output.split(/\r?\n/).filter(Boolean);
  const resolved = names.find((name) => canonicalAgentKey(name) === requested) ?? agent;
  const selected = runTmux(["select-window", "-t", `${session}:${resolved}`]);
  if (!selected.ok) {
    throw new Error(`Failed to focus ${agent}: ${selected.output}`);
  }
}

export function attachSession(session = MC_SESSION): void {
  const attached = runTmuxInteractive(["attach-session", "-t", session]);
  if (!attached.ok) {
    throw new Error(`Failed to attach ${session}: ${attached.output}`);
  }
}

export function switchClient(session = MC_SESSION): void {
  const switched = runTmux(["switch-client", "-t", session]);
  if (!switched.ok) {
    throw new Error(`Failed to switch client to ${session}: ${switched.output}`);
  }
}

export function currentSessionName(): string {
  const out = runTmux(["display-message", "-p", "#S"]);
  if (!out.ok) {
    return "";
  }
  return out.output.trim();
}

export function sendKeys(agent: string, command: string, session = MC_SESSION): void {
  const windows = runTmux(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!windows.ok) {
    throw new Error(`Failed to list tmux windows: ${windows.output}`);
  }
  const requested = canonicalAgentKey(agent);
  const names = windows.output.split(/\r?\n/).filter(Boolean);
  const resolved = names.find((name) => canonicalAgentKey(name) === requested) ?? agent;
  const sent = runTmux(["send-keys", "-t", `${session}:${resolved}`, command, "C-m"]);
  if (!sent.ok) {
    throw new Error(`Failed to send keys to ${agent}: ${sent.output}`);
  }
}

export function paneCurrentCommand(agent: string, session = MC_SESSION): string {
  const windows = runTmux(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!windows.ok) {
    return "";
  }
  const requested = canonicalAgentKey(agent);
  const names = windows.output.split(/\r?\n/).filter(Boolean);
  const resolved = names.find((name) => canonicalAgentKey(name) === requested) ?? agent;
  const out = runTmux(["display-message", "-p", "-t", `${session}:${resolved}`, "#{pane_current_command}"]);
  if (!out.ok) {
    return "";
  }
  return out.output.trim();
}

export function listWindowAlerts(session = MC_SESSION): Array<{
  window: string;
  bell: boolean;
  activity: boolean;
  silence: boolean;
}> {
  const out = runTmux([
    "list-windows",
    "-t",
    session,
    "-F",
    "#{window_name}\t#{window_bell_flag}\t#{window_activity_flag}\t#{window_silence_flag}",
  ]);
  if (!out.ok) {
    return [];
  }
  const rows = out.output.split(/\r?\n/).filter(Boolean);
  return rows.map((row) => {
    const [window, bell = "0", activity = "0", silence = "0"] = row.split("\t");
    return {
      window,
      bell: asFlag(bell),
      activity: asFlag(activity),
      silence: asFlag(silence),
    };
  });
}

export function listWindowApprovalPrompts(session = MC_SESSION): Array<{
  window: string;
  approval_prompt: boolean;
}> {
  const out = runTmux(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!out.ok) {
    return [];
  }
  const windows = out.output.split(/\r?\n/).filter(Boolean);
  return windows.map((window) => {
    const pane = runTmux(["capture-pane", "-p", "-t", `${session}:${window}`, "-S", "-120"]);
    return {
      window,
      approval_prompt: pane.ok ? hasApprovalPrompt(pane.output) : false,
    };
  });
}

export function clearWindowAlerts(agent: string, session = MC_SESSION): void {
  const windows = runTmux(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!windows.ok) {
    return;
  }
  const requested = canonicalAgentKey(agent);
  const names = windows.output.split(/\r?\n/).filter(Boolean);
  const resolved = names.find((name) => canonicalAgentKey(name) === requested);
  if (!resolved) {
    return;
  }
  runTmux(["select-window", "-t", `${session}:${resolved}`]);
}
