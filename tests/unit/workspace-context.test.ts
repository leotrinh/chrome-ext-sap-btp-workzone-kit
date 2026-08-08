import { describe, expect, it } from "vitest";
import { getTargetTabIdFromLocationSearch } from "../../src/sidepanel/workspace-context";

describe("getTargetTabIdFromLocationSearch()", () => {
  it("parses a valid sourceTabId", () => {
    expect(getTargetTabIdFromLocationSearch("?sourceTabId=42")).toBe(42);
  });

  it("returns undefined when the param is absent (side-panel mode)", () => {
    expect(getTargetTabIdFromLocationSearch("")).toBeUndefined();
  });

  it("returns undefined for a non-numeric value", () => {
    expect(getTargetTabIdFromLocationSearch("?sourceTabId=not-a-number")).toBeUndefined();
  });

  it("returns undefined for zero or negative values", () => {
    expect(getTargetTabIdFromLocationSearch("?sourceTabId=0")).toBeUndefined();
    expect(getTargetTabIdFromLocationSearch("?sourceTabId=-5")).toBeUndefined();
  });

  it("returns undefined for a non-integer value", () => {
    expect(getTargetTabIdFromLocationSearch("?sourceTabId=1.5")).toBeUndefined();
  });
});
