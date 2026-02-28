export const incidentStatuses = ["open", "in_progress", "blocked", "resolved"] as const;
export const incidentSeverities = ["low", "medium", "high", "critical"] as const;

export type IncidentStatus = (typeof incidentStatuses)[number];
export type IncidentSeverity = (typeof incidentSeverities)[number];

export interface IncidentFilter {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
}

export interface IncidentUpdatePayload {
  title?: string;
  description?: string;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  escalationOwner?: string | null;
  escalationDueAt?: string | null;
}
