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

function runTmuxInteractive(
  args: string[],
  opts?: { env?: NodeJS.ProcessEnv },
): { ok: boolean; output: string } {
  const result = spawnSync("tmux", args, { stdio: "inherit", env: opts?.env });
  return {
    ok: result.status === 0,
    output: result.signal ? `signal ${result.signal}` : `exit ${result.status ?? "unknown"}`,
  };
}

function asFlag(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "1" || v === "on" || v === "yes";
}

const ANSI_ESCAPE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

function cleanLine(value: string): string {
  return value.replace(ANSI_ESCAPE, "").replace(/\s+/g, " ").trim();
}

export function hasApprovalPrompt(view: string): boolean {
  const text = view.toLowerCase();
  return (
    text.includes("would you like to run the following command?") &&
    text.includes("press enter to confirm or esc to cancel")
  );
}

function isNoiseLine(line: string): boolean {
  if (!line) return true;
  const lower = line.toLowerCase();
  if (lower === "none.") return true;
  if (line.startsWith(">")) return true;
  if (line.startsWith("$")) return true;
  if (line.startsWith("%")) return true;
  if (line.startsWith("|")) return true;
  if (/^[\[\]().,:;!?'"`~|\\/<>=*^_+-]+$/.test(line)) return true;
  if (/^[^\s@]+@[^\s]+\s+.*\s[%$#]$/.test(line)) return true;
  if (/^[~./\w-]+\s[%$#]$/.test(line)) return true;
  if (/^\d+\s+[+-]\s+/.test(line)) return true;
  if (/^(@@|---|\+\+\+)/.test(line)) return true;
  if (lower.includes("esc to interrupt")) return true;
  if (lower.includes("q to quit")) return true;
  if (lower.includes("% left")) return true;
  if (lower.includes("background terminal")) return true;
  if (lower.startsWith("qpt-")) return true;
  return false;
}

function isLikelyCodeLine(line: string): boolean {
  return /^(await|const|let|var|function|import|export|if|for|while|return|class)\b/.test(line);
}

function normalizeLineForDisplay(line: string): string {
  return line.replace(/^[\u2022*-]\s+/, "").trim();
}

function extractFeedbackRequest(lines: string[]): string {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (isNoiseLine(line)) continue;
    if (!line.endsWith("?")) continue;
    if (!/(choose|which|should|do you|can you|would you|approve|confirm|pick|prefer|want me|feedback)/i.test(line)) {
      continue;
    }
    return normalizeLineForDisplay(line);
  }
  return "";
}

function extractLastUpdateLine(lines: string[]): string {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (isNoiseLine(line)) continue;
    if (isLikelyCodeLine(line)) continue;
    if (!/[a-z]/i.test(line)) continue;
    return normalizeLineForDisplay(line);
  }
  return "";
}

export function parsePaneInsights(view: string): {
  approval_prompt: boolean;
  feedback_request: string;
  last_update: string;
} {
  const lines = view.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const approval_prompt = hasApprovalPrompt(view);
  const feedback_request = approval_prompt
    ? "Approve or cancel the pending command in this terminal."
    : extractFeedbackRequest(lines);
  const last_update = extractLastUpdateLine(lines);
  return { approval_prompt, feedback_request, last_update };
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

export function attachSession(
  session = MC_SESSION,
  opts?: { clearTmuxEnv?: boolean },
): void {
  const env = opts?.clearTmuxEnv ? { ...process.env, TMUX: undefined } : undefined;
  const attached = runTmuxInteractive(["attach-session", "-t", session], { env });
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

export function listWindowInsights(session = MC_SESSION): Array<{
  window: string;
  approval_prompt: boolean;
  feedback_request: string;
  last_update: string;
}> {
  const out = runTmux(["list-windows", "-t", session, "-F", "#{window_name}"]);
  if (!out.ok) {
    return [];
  }

  type PaneInsight = {
    pane_id: string;
    pane_active: boolean;
    pane_current_command: string;
    approval_prompt: boolean;
    feedback_request: string;
    last_update: string;
  };

  function parsePaneRow(row: string): { pane_id: string; pane_active: boolean; pane_current_command: string } | null {
    const [pane_id = "", pane_active = "0", pane_current_command = ""] = row.split("\t");
    if (!pane_id) return null;
    return {
      pane_id,
      pane_active: asFlag(pane_active),
      pane_current_command: pane_current_command.trim().toLowerCase(),
    };
  }

  function panePriority(pane: PaneInsight): number {
    let score = 0;
    if (pane.approval_prompt) score += 400;
    if (pane.feedback_request) score += 300;
    if (pane.last_update) score += 200;
    if (pane.pane_active) score += 50;
    if (pane.pane_current_command === "codex" || pane.pane_current_command === "node") score += 40;
    if (!["zsh", "bash", "sh", "fish"].includes(pane.pane_current_command)) score += 10;
    return score;
  }

  function pickBestLine(panes: PaneInsight[], field: "feedback_request" | "last_update"): string {
    const ranked = [...panes].sort((a, b) => panePriority(b) - panePriority(a));
    for (const pane of ranked) {
      const value = pane[field];
      if (value) return value;
    }
    return "";
  }

  const windows = out.output.split(/\r?\n/).filter(Boolean);
  return windows.map((window) => {
    const paneList = runTmux(["list-panes", "-t", `${session}:${window}`, "-F", "#{pane_id}\t#{pane_active}\t#{pane_current_command}"]);
    if (!paneList.ok) {
      return {
        window,
        approval_prompt: false,
        feedback_request: "",
        last_update: "",
      };
    }

    const paneRows = paneList.output.split(/\r?\n/).filter(Boolean);
    const paneInsights: PaneInsight[] = [];
    for (const row of paneRows) {
      const paneMeta = parsePaneRow(row);
      if (!paneMeta) continue;
      const paneView = runTmux(["capture-pane", "-p", "-t", paneMeta.pane_id, "-S", "-200"]);
      if (!paneView.ok) continue;
      const parsed = parsePaneInsights(paneView.output);
      paneInsights.push({
        pane_id: paneMeta.pane_id,
        pane_active: paneMeta.pane_active,
        pane_current_command: paneMeta.pane_current_command,
        approval_prompt: parsed.approval_prompt,
        feedback_request: parsed.feedback_request,
        last_update: parsed.last_update,
      });
    }

    if (paneInsights.length === 0) {
      return {
        window,
        approval_prompt: false,
        feedback_request: "",
        last_update: "",
      };
    }

    return {
      window,
      approval_prompt: paneInsights.some((pane) => pane.approval_prompt),
      feedback_request: pickBestLine(paneInsights, "feedback_request"),
      last_update: pickBestLine(paneInsights, "last_update"),
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
