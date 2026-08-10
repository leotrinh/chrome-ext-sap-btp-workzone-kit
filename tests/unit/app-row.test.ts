import { describe, expect, it } from "vitest";
import { currentVersionText, type AppRowData } from "../../src/domain/app-row";

function row(overrides: Partial<AppRowData>): AppRowData {
  return { id: "a", title: "App", baseId: null, status: "ready", targetVersion: "1.136.17", ...overrides };
}

describe("currentVersionText()", () => {
  it("shows Loading while loading", () => {
    expect(currentVersionText(row({ status: "loading" }))).toBe("Loading");
  });

  it("shows Error on error status", () => {
    expect(currentVersionText(row({ status: "error", errorMessage: "boom" }))).toBe("Error");
  });

  it("shows the display version for a single target", () => {
    const detection = { displayVersion: "1.136.17", targets: [], consistency: "single" as const };
    expect(currentVersionText(row({ detection }))).toBe("1.136.17");
  });

  it("shows Mixed with a count for inconsistent targets", () => {
    const detection = {
      displayVersion: null,
      targets: [
        { kind: "targetAppConfig" as const, currentValue: "1.136.17", writable: true },
        { kind: "visualization" as const, currentValue: "1.120.7", writable: true },
      ],
      consistency: "mixed" as const,
    };
    expect(currentVersionText(row({ detection }))).toBe("Mixed (2 versions)");
  });

  it("shows N/A when no supported target exists", () => {
    const detection = { displayVersion: null, targets: [], consistency: "none" as const };
    expect(currentVersionText(row({ detection }))).toBe("N/A");
  });

  it("shows N/A when detection is entirely absent (not yet loaded but status ready)", () => {
    expect(currentVersionText(row({ detection: undefined }))).toBe("N/A");
  });
});
