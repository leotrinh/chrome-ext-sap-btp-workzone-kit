import { describe, expect, it } from "vitest";
import { createUi5VersionUpdatePlan, summarizeUpdatePlans } from "../../src/domain/update-plan";
import type { Ui5VersionDetection } from "../../src/domain/ui5-version";

function detection(overrides: Partial<Ui5VersionDetection>): Ui5VersionDetection {
  return { displayVersion: null, targets: [], consistency: "none", ...overrides };
}

describe("createUi5VersionUpdatePlan()", () => {
  it("produces one change for a single target that differs from the target version", () => {
    const current = detection({
      displayVersion: "1.120.7",
      consistency: "single",
      targets: [{ kind: "targetAppConfig", currentValue: "1.120.7", writable: true }],
    });

    const plan = createUi5VersionUpdatePlan("app-1", "App One", current, "1.136.17");

    expect(plan.noOp).toBe(false);
    expect(plan.changes).toEqual([
      { kind: "targetAppConfig", visualizationKey: undefined, from: "1.120.7", to: "1.136.17", pathDescription: "targetAppConfig" },
    ]);
  });

  it("normalizes multiple differing targets to one uniform target version", () => {
    const current = detection({
      consistency: "mixed",
      targets: [
        { kind: "targetAppConfig", currentValue: "1.120.7", writable: true },
        { kind: "visualization", visualizationKey: "launchTile", currentValue: "1.100.0", writable: true },
      ],
    });

    const plan = createUi5VersionUpdatePlan("app-1", "App One", current, "1.136.17");

    expect(plan.changes).toHaveLength(2);
    expect(plan.changes.every((change) => change.to === "1.136.17")).toBe(true);
    expect(plan.changes.map((change) => change.from)).toEqual(["1.120.7", "1.100.0"]);
  });

  it("is a no-op when every target already matches the target version", () => {
    const current = detection({
      displayVersion: "1.136.17",
      consistency: "consistent",
      targets: [
        { kind: "targetAppConfig", currentValue: "1.136.17", writable: true },
        { kind: "visualization", visualizationKey: "appTile", currentValue: "1.136.17", writable: true },
      ],
    });

    const plan = createUi5VersionUpdatePlan("app-1", "App One", current, "1.136.17");

    expect(plan.noOp).toBe(true);
    expect(plan.changes).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  it("only sends changes for the targets that actually differ (partial mixed update)", () => {
    const current = detection({
      consistency: "mixed",
      targets: [
        { kind: "targetAppConfig", currentValue: "1.136.17", writable: true },
        { kind: "visualization", visualizationKey: "launchTile", currentValue: "1.100.0", writable: true },
      ],
    });

    const plan = createUi5VersionUpdatePlan("app-1", "App One", current, "1.136.17");

    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.visualizationKey).toBe("launchTile");
  });

  it("marks unsupported apps (no targets) as a no-op with a warning, not a crash", () => {
    const current = detection({});

    const plan = createUi5VersionUpdatePlan("app-1", "App One", current, "1.136.17");

    expect(plan.noOp).toBe(true);
    expect(plan.changes).toEqual([]);
    expect(plan.warnings).toEqual(["No supported UI5 version target found."]);
  });

  it("rejects an invalid target version format before building any changes", () => {
    const current = detection({
      consistency: "single",
      targets: [{ kind: "targetAppConfig", currentValue: "1.120.7", writable: true }],
    });

    const plan = createUi5VersionUpdatePlan("app-1", "App One", current, "not-a-version");

    expect(plan.noOp).toBe(true);
    expect(plan.changes).toEqual([]);
    expect(plan.warnings[0]).toMatch(/Invalid target version format/);
  });

  it("never mutates the passed-in detection object", () => {
    const current = detection({
      consistency: "single",
      targets: [{ kind: "targetAppConfig", currentValue: "1.120.7", writable: true }],
    });
    const snapshot = JSON.parse(JSON.stringify(current));

    createUi5VersionUpdatePlan("app-1", "App One", current, "1.136.17");

    expect(current).toEqual(snapshot);
  });
});

describe("summarizeUpdatePlans()", () => {
  it("matches the blueprint §17 confirmation dialog's exact counts", () => {
    const changing1 = createUi5VersionUpdatePlan(
      "a",
      "A",
      detection({ consistency: "single", targets: [{ kind: "targetAppConfig", currentValue: "1.100.0", writable: true }] }),
      "1.136.17",
    );
    const changing2 = createUi5VersionUpdatePlan(
      "b",
      "B",
      detection({ consistency: "single", targets: [{ kind: "targetAppConfig", currentValue: "1.100.0", writable: true }] }),
      "1.120.32",
    );
    const alreadyConfigured = createUi5VersionUpdatePlan(
      "c",
      "C",
      detection({ consistency: "single", targets: [{ kind: "targetAppConfig", currentValue: "1.136.17", writable: true }] }),
      "1.136.17",
    );
    const unsupported = createUi5VersionUpdatePlan("d", "D", detection({}), "1.136.17");

    const summary = summarizeUpdatePlans([changing1, changing2, alreadyConfigured, unsupported]);

    expect(summary).toEqual({
      selectedCount: 4,
      changingCount: 2,
      alreadyConfiguredCount: 1,
      unsupportedCount: 1,
      targetVersionBreakdown: [
        { targetVersion: "1.136.17", appCount: 1 },
        { targetVersion: "1.120.32", appCount: 1 },
      ],
    });
  });

  it("handles an empty plan list", () => {
    expect(summarizeUpdatePlans([])).toEqual({
      selectedCount: 0,
      changingCount: 0,
      alreadyConfiguredCount: 0,
      unsupportedCount: 0,
      targetVersionBreakdown: [],
    });
  });
});
