import { describe, expect, it } from "vitest";
import { isValidVersionFormat } from "../../src/shared/version-format";

describe("isValidVersionFormat()", () => {
  it.each(["1.136.17", "1.9.0", "1.100.0", "1.2.3-beta.1", "1.2.3+build.5"])("accepts %s", (value) => {
    expect(isValidVersionFormat(value)).toBe(true);
  });

  it.each(["1.136", "1", "abc", "1.136.17.", ""])("rejects %j", (value) => {
    expect(isValidVersionFormat(value)).toBe(false);
  });

  it("rejects a version missing the patch segment", () => {
    expect(isValidVersionFormat("1.136")).toBe(false);
  });

  it("rejects non-numeric segments", () => {
    expect(isValidVersionFormat("a.b.c")).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidVersionFormat("  1.136.17  ")).toBe(true);
  });
});
