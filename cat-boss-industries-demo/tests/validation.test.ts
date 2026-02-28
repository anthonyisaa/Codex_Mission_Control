import { describe, expect, it } from "vitest";
import { incidentPayloadSchema } from "../src/domain/validation";

describe("critical incident validation", () => {
  it("fails when critical incident misses escalation fields", () => {
    expect(() =>
      incidentPayloadSchema.parse({
        title: "Critical outage",
        description: "Payments failing in prod",
        status: "open",
        severity: "critical",
      }),
    ).toThrowError(/Critical incidents require/);
  });

  it("passes when critical incident includes escalation fields", () => {
    const parsed = incidentPayloadSchema.parse({
      title: "Critical outage",
      description: "Payments failing in prod",
      status: "open",
      severity: "critical",
      escalationOwner: "oncall@catboss.io",
      escalationDueAt: new Date().toISOString(),
    });

    expect(parsed.severity).toBe("critical");
  });
});
