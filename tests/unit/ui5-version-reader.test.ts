import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readUi5VersionTargets } from "../../src/integrations/sap-workzone/ui5-version-reader";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/cdm", name), "utf-8"));
}

describe("readUi5VersionTargets()", () => {
  it("detects path A (targetAppConfig)", () => {
    const result = readUi5VersionTargets(fixture("target-app-config.json"));
    expect(result.consistency).toBe("single");
    expect(result.displayVersion).toBe("1.120.7");
    expect(result.targets).toEqual([
      { kind: "targetAppConfig", currentValue: "1.120.7", writable: true },
    ]);
  });

  it("detects path B (visualization)", () => {
    const result = readUi5VersionTargets(fixture("visualization.json"));
    expect(result.consistency).toBe("single");
    expect(result.displayVersion).toBe("1.136.17");
    expect(result.targets).toEqual([
      { kind: "visualization", visualizationKey: "viz-1", currentValue: "1.136.17", writable: true },
    ]);
  });

  it("detects multiple targets (both paths, multiple visualizations) with the same value as consistent", () => {
    const result = readUi5VersionTargets(fixture("both-same.json"));
    expect(result.consistency).toBe("consistent");
    expect(result.displayVersion).toBe("1.136.17");
    expect(result.targets).toHaveLength(3);
  });

  it("flags differing values as mixed, never silently picking one", () => {
    const result = readUi5VersionTargets(fixture("mixed.json"));
    expect(result.consistency).toBe("mixed");
    expect(result.displayVersion).toBeNull();
    expect(result.targets).toHaveLength(2);
    expect(result.targets.map((t) => t.currentValue).sort()).toEqual(["1.120.7", "1.136.17"]);
  });

  it("returns consistency 'none' when no supported path exists", () => {
    const result = readUi5VersionTargets(fixture("no-target.json"));
    expect(result).toEqual({ displayVersion: null, targets: [], consistency: "none" });
  });

  it("never throws on malformed CDM and treats it as no targets found", () => {
    expect(() => readUi5VersionTargets(fixture("malformed.json"))).not.toThrow();
    const result = readUi5VersionTargets(fixture("malformed.json"));
    expect(result.consistency).toBe("none");
  });

  it("never throws on entirely absent/primitive CDM", () => {
    expect(readUi5VersionTargets(null).consistency).toBe("none");
    expect(readUi5VersionTargets(undefined).consistency).toBe("none");
    expect(readUi5VersionTargets("a string").consistency).toBe("none");
    expect(readUi5VersionTargets(42).consistency).toBe("none");
    expect(readUi5VersionTargets({}).consistency).toBe("none");
  });
});
