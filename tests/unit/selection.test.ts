import { describe, expect, it } from "vitest";
import {
  clearSelection,
  isSelected,
  subtractSelection,
  toggleSelection,
  unionSelection,
} from "../../src/domain/selection";

describe("toggleSelection()", () => {
  it("adds an id not yet selected", () => {
    const result = toggleSelection(new Set(), "a");
    expect(result).toEqual(new Set(["a"]));
  });

  it("removes an id already selected", () => {
    const result = toggleSelection(new Set(["a", "b"]), "a");
    expect(result).toEqual(new Set(["b"]));
  });

  it("does not mutate the input set", () => {
    const input = new Set(["a"]);
    toggleSelection(input, "b");
    expect(input).toEqual(new Set(["a"]));
  });
});

describe("unionSelection() — select all visible / select all loaded", () => {
  it("adds the given ids without dropping existing selections outside that set", () => {
    const selected = new Set(["hidden-row"]);
    const result = unionSelection(selected, ["visible-1", "visible-2"]);
    expect(result).toEqual(new Set(["hidden-row", "visible-1", "visible-2"]));
  });

  it("selecting all visible under a search filter never touches hidden rows' state", () => {
    // Simulates: user selected 'c' while unfiltered, then searched (hiding a/b are the
    // only visible matches), then clicked "select all visible".
    const selectedBeforeFilter = new Set(["c"]);
    const visibleIdsUnderFilter = ["a", "b"];
    const result = unionSelection(selectedBeforeFilter, visibleIdsUnderFilter);
    expect(result.has("c")).toBe(true);
    expect(result).toEqual(new Set(["c", "a", "b"]));
  });
});

describe("subtractSelection()", () => {
  it("removes only the given ids", () => {
    const result = subtractSelection(new Set(["a", "b", "c"]), ["b"]);
    expect(result).toEqual(new Set(["a", "c"]));
  });
});

describe("clearSelection()", () => {
  it("returns an empty set", () => {
    expect(clearSelection()).toEqual(new Set());
  });
});

describe("isSelected()", () => {
  it("reflects membership", () => {
    const selected = new Set(["a"]);
    expect(isSelected(selected, "a")).toBe(true);
    expect(isSelected(selected, "b")).toBe(false);
  });
});
