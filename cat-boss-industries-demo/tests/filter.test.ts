import { describe, expect, it } from "vitest";
import { mapStatusParam } from "../src/lib/filter";

describe("status query mapping", () => {
  it("keeps blocked stable across refresh-like parsing", () => {
    expect(mapStatusParam("blocked")).toBe("blocked");
  });

  it("supports legacy on_hold alias", () => {
    expect(mapStatusParam("on_hold")).toBe("blocked");
  });

  it("returns undefined for unknown status", () => {
    expect(mapStatusParam("mystery")).toBeUndefined();
  });
});
