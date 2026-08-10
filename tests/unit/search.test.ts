import { describe, expect, it } from "vitest";
import { matchesSearch } from "../../src/domain/search";

describe("matchesSearch()", () => {
  it("matches on title, case-insensitive", () => {
    expect(matchesSearch({ title: "Sales Overview" }, "sales")).toBe(true);
    expect(matchesSearch({ title: "Sales Overview" }, "SALES")).toBe(true);
  });

  it("matches on current version text", () => {
    expect(matchesSearch({ title: "App", currentVersionText: "1.136.17" }, "136")).toBe(true);
    expect(matchesSearch({ title: "App", currentVersionText: "Mixed" }, "mixed")).toBe(true);
  });

  it("returns false when neither title nor version matches", () => {
    expect(matchesSearch({ title: "Sales Overview", currentVersionText: "1.136.17" }, "warehouse")).toBe(
      false,
    );
  });

  it("empty/whitespace query matches everything", () => {
    expect(matchesSearch({ title: "Anything" }, "")).toBe(true);
    expect(matchesSearch({ title: "Anything" }, "   ")).toBe(true);
  });

  it("handles a missing currentVersionText safely", () => {
    expect(matchesSearch({ title: "App" }, "N/A")).toBe(false);
    expect(matchesSearch({ title: "App" }, "app")).toBe(true);
  });
});
