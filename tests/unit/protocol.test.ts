import { describe, expect, it } from "vitest";
import {
  WORKZONE_COMMANDS,
  isKnownWorkzoneCommand,
  parseCommandRequest,
} from "../../src/messaging/protocol";

describe("isKnownWorkzoneCommand()", () => {
  it("accepts every literal in the fixed command set", () => {
    for (const command of WORKZONE_COMMANDS) {
      expect(isKnownWorkzoneCommand(command)).toBe(true);
    }
  });

  it.each([
    "eval(1+1)",
    "DROP_TABLE_USERS",
    "http://evil.example/graphql",
    "",
    "ping",
  ])("rejects unknown/arbitrary string %j", (value) => {
    expect(isKnownWorkzoneCommand(value)).toBe(false);
  });
});

describe("parseCommandRequest()", () => {
  it("accepts a bare PING request", () => {
    const result = parseCommandRequest({ command: "PING", payload: undefined });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.command).toBe("PING");
    }
  });

  it("accepts a bare GET_ENVIRONMENT request", () => {
    const result = parseCommandRequest({ command: "GET_ENVIRONMENT" });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown command string", () => {
    const result = parseCommandRequest({ command: "RUN_ARBITRARY_QUERY", payload: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_COMMAND");
    }
  });

  it("rejects a request carrying a raw GraphQL query string as payload", () => {
    const result = parseCommandRequest({
      command: "PING",
      payload: { graphqlQuery: "mutation batchProcess { ... }" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object request", () => {
    expect(parseCommandRequest(null).ok).toBe(false);
    expect(parseCommandRequest("PING").ok).toBe(false);
    expect(parseCommandRequest(42).ok).toBe(false);
  });

  it("rejects a request missing the command field", () => {
    const result = parseCommandRequest({ payload: {} });
    expect(result.ok).toBe(false);
  });
});

describe("parseCommandRequest() targetTabId", () => {
  it("accepts a request with a positive integer targetTabId", () => {
    const result = parseCommandRequest({ command: "GET_ENVIRONMENT", targetTabId: 42 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.targetTabId).toBe(42);
    }
  });

  it("accepts a request with targetTabId omitted (side-panel mode)", () => {
    const result = parseCommandRequest({ command: "GET_ENVIRONMENT" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.targetTabId).toBeUndefined();
    }
  });

  it("rejects a negative targetTabId", () => {
    const result = parseCommandRequest({ command: "GET_ENVIRONMENT", targetTabId: -1 });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer targetTabId", () => {
    const result = parseCommandRequest({ command: "GET_ENVIRONMENT", targetTabId: 1.5 });
    expect(result.ok).toBe(false);
  });

  it("rejects a string targetTabId (no type coercion)", () => {
    const result = parseCommandRequest({ command: "GET_ENVIRONMENT", targetTabId: "42" });
    expect(result.ok).toBe(false);
  });
});
