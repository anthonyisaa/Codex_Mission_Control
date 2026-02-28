import { z } from "zod";
import { incidentSeverities, incidentStatuses } from "./types";

export const incidentPayloadSchema = z
  .object({
    title: z.string().min(3),
    description: z.string().min(5),
    status: z.enum(incidentStatuses).default("open"),
    severity: z.enum(incidentSeverities).default("medium"),
    escalationOwner: z.string().email().optional().nullable(),
    escalationDueAt: z.string().datetime().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const isCritical = value.severity === "critical";
    if (!isCritical) {
      return;
    }

    if (!value.escalationOwner) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Critical incidents require an escalation owner.",
        path: ["escalationOwner"],
      });
    }

    if (!value.escalationDueAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Critical incidents require an escalation due date.",
        path: ["escalationDueAt"],
      });
    }
  });

export const incidentPatchSchema = incidentPayloadSchema.partial();
