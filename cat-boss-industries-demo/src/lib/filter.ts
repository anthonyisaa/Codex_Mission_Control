import type { IncidentStatus } from "../domain/types";

const allowedStatuses = new Set<IncidentStatus>(["open", "in_progress", "blocked", "resolved"]);

export function mapStatusParam(status: string | null): IncidentStatus | undefined {
  if (!status) {
    return undefined;
  }

  const normalized = status.trim().toLowerCase();

  if (normalized === "on_hold") {
    return "blocked";
  }

  if (allowedStatuses.has(normalized as IncidentStatus)) {
    return normalized as IncidentStatus;
  }

  return undefined;
}
