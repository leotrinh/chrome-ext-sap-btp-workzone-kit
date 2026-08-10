import { describe, expect, it } from "vitest";
import { compareAppTitle, compareUi5Version, compareUi5VersionForSort } from "../../src/domain/sorting";

describe("compareAppTitle()", () => {
  it("sorts case-insensitively", () => {
    const titles = ["banana", "Apple", "cherry"];
    expect([...titles].sort(compareAppTitle)).toEqual(["Apple", "banana", "cherry"]);
  });
});

describe("compareUi5Version()", () => {
  it("orders the blueprint's exact example numerically, not lexicographically", () => {
    const versions = ["1.136.17", "1.10.0", "1.100.0", "1.9.0"];
    expect([...versions].sort(compareUi5Version)).toEqual(["1.9.0", "1.10.0", "1.100.0", "1.136.17"]);
  });

  it("plain lexicographic sort would get this wrong (sanity check on the fixture)", () => {
    const versions = ["1.136.17", "1.10.0", "1.100.0", "1.9.0"];
    expect([...versions].sort()).not.toEqual(["1.9.0", "1.10.0", "1.100.0", "1.136.17"]);
  });

  it("sorts null (no version) last in ascending order (this comparator is ascending-only)", () => {
    const versions = ["1.2.0", null, "1.1.0"];
    expect([...versions].sort(compareUi5Version)).toEqual(["1.1.0", "1.2.0", null]);
  });

  it("returns 0 for identical versions", () => {
    expect(compareUi5Version("1.136.17", "1.136.17")).toBe(0);
  });

  it("falls back to string comparison for non-numeric segments (pre-release suffixes)", () => {
    expect(compareUi5Version("1.2.0-beta", "1.2.0-alpha")).toBeGreaterThan(0);
  });

  it("treats a longer version as greater when the shared prefix is equal", () => {
    expect(compareUi5Version("1.2.0.1", "1.2.0")).toBeGreaterThan(0);
  });
});

describe("compareUi5VersionForSort() — direction-aware, null always last", () => {
  it("sorts null last in ascending order", () => {
    const versions: Array<string | null> = ["1.2.0", null, "1.1.0"];
    expect([...versions].sort((a, b) => compareUi5VersionForSort(a, b, "asc"))).toEqual([
      "1.1.0",
      "1.2.0",
      null,
    ]);
  });

  it("still sorts null last in descending order — this is the bug the direction-multiplier approach had", () => {
    const versions: Array<string | null> = ["1.1.0", null, "1.2.0"];
    expect([...versions].sort((a, b) => compareUi5VersionForSort(a, b, "desc"))).toEqual([
      "1.2.0",
      "1.1.0",
      null,
    ]);
  });

  it("reverses the ordering of apps that do have a version when descending", () => {
    const versions = ["1.9.0", "1.100.0", "1.10.0"];
    expect([...versions].sort((a, b) => compareUi5VersionForSort(a, b, "desc"))).toEqual([
      "1.100.0",
      "1.10.0",
      "1.9.0",
    ]);
  });
});
