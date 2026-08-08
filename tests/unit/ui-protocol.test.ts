import { describe, expect, it } from "vitest";
import { isUiMessage } from "../../src/messaging/ui-protocol";

describe("isUiMessage()", () => {
  it("accepts a known UI message type", () => {
    expect(isUiMessage({ type: "OPEN_WORKSPACE_TAB" })).toBe(true);
  });

  it("rejects an unknown type string", () => {
    expect(isUiMessage({ type: "DO_SOMETHING_ELSE" })).toBe(false);
  });

  it("rejects the WorkzoneCommand shape (different protocol, must not cross-match)", () => {
    expect(isUiMessage({ command: "PING" })).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isUiMessage(null)).toBe(false);
    expect(isUiMessage("OPEN_WORKSPACE_TAB")).toBe(false);
    expect(isUiMessage(42)).toBe(false);
  });
});
