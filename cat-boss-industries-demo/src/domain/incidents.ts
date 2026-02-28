import type { Incident, IncidentSeverity } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { mapStatusParam } from "../lib/filter";
import { incidentPatchSchema, incidentPayloadSchema } from "./validation";

export async function listIncidents(query: { status?: string | null; severity?: string | null }) {
  const status = mapStatusParam(query.status ?? null);
  const severity = query.severity ?? undefined;

  return prisma.incident.findMany({
    where: {
      status,
      severity: severity as IncidentSeverity | undefined,
    },
    orderBy: { updatedAt: "desc" },
    include: { activities: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
}

export async function createIncident(payload: unknown): Promise<Incident> {
  const parsed = incidentPayloadSchema.parse(payload);

  return prisma.incident.create({
    data: {
      ...parsed,
      escalationDueAt: parsed.escalationDueAt ? new Date(parsed.escalationDueAt) : null,
    },
  });
}

export async function updateIncident(id: string, patch: unknown): Promise<Incident> {
  const parsed = incidentPatchSchema.parse(patch);
  const current = await prisma.incident.findUnique({ where: { id } });

  if (!current) {
    throw new Error("Incident not found");
  }

  const nextSeverity = parsed.severity ?? current.severity;
  const nextOwner = parsed.escalationOwner === undefined ? current.escalationOwner : parsed.escalationOwner;
  const nextDue = parsed.escalationDueAt === undefined ? current.escalationDueAt : parsed.escalationDueAt;

  if (nextSeverity === "critical" && (!nextOwner || !nextDue)) {
    throw new Error("Critical incidents require escalation owner and due date");
  }

  const updated = await prisma.incident.update({
    where: { id },
    data: {
      ...parsed,
      escalationDueAt: parsed.escalationDueAt ? new Date(parsed.escalationDueAt) : parsed.escalationDueAt,
    },
  });

  if (parsed.severity && parsed.severity !== current.severity) {
    await prisma.activityLog.create({
      data: {
        incidentId: id,
        message: `Severity changed from ${current.severity} to ${parsed.severity}`,
      },
    });
  }

  return updated;
}
