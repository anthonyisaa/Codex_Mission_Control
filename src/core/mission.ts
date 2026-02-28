import fs from "node:fs/promises";
import path from "node:path";
import { ACTIVE_MISSION, MISSIONS_DIR, getMissionPath } from "./paths.js";
import { ensureDir, exists } from "./fs.js";
import type { MissionGoal } from "./types.js";

export function todayIso(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function parseGoals(input: string): string[] {
  return input
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function missionMarkdown(dateIso: string, goals: string[]): string {
  const lines = [
    `# Mission ${dateIso}`,
    "",
    "## Goals",
    ...goals.map((g, i) => `${i + 1}. ${g}`),
    "",
    "## Agent Mapping",
    "- agent-name -> goal-number",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export async function startDay(goals: string[], date = new Date()): Promise<{ missionPath: string }> {
  if (goals.length < 1) {
    throw new Error("At least one goal is required.");
  }
  await ensureDir(MISSIONS_DIR);
  const dateIso = todayIso(date);
  const missionPath = getMissionPath(dateIso);
  if (!(await exists(missionPath))) {
    await fs.writeFile(missionPath, missionMarkdown(dateIso, goals), "utf8");
  }
  const rel = path.basename(missionPath);
  await fs.writeFile(ACTIVE_MISSION, `./${rel}\n`, "utf8");
  return { missionPath };
}

export async function readActiveMission(): Promise<{ path: string; goals: MissionGoal[] } | null> {
  if (!(await exists(ACTIVE_MISSION))) {
    return null;
  }
  const pointer = (await fs.readFile(ACTIVE_MISSION, "utf8")).trim();
  const missionPath = path.join(MISSIONS_DIR, pointer.replace(/^\.\//, ""));
  const raw = await fs.readFile(missionPath, "utf8");
  const goals: MissionGoal[] = [];
  const goalRe = /^\d+\.\s+(.+)$/;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(goalRe);
    if (m) {
      goals.push({ id: goals.length + 1, text: m[1] });
    }
  }
  return { path: missionPath, goals };
}
