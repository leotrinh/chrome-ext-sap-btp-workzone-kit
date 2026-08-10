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

describe("parseCommandRequest() GET_APP_VERSION_TARGETS", () => {
  it("accepts a request with a valid appIds payload", () => {
    const result = parseCommandRequest({
      command: "GET_APP_VERSION_TARGETS",
      payload: { appIds: ["app-1", "app-2"] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.payload).toEqual({ appIds: ["app-1", "app-2"] });
    }
  });

  it("rejects a missing payload", () => {
    const result = parseCommandRequest({ command: "GET_APP_VERSION_TARGETS" });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty appIds array", () => {
    const result = parseCommandRequest({ command: "GET_APP_VERSION_TARGETS", payload: { appIds: [] } });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string entry in appIds", () => {
    const result = parseCommandRequest({
      command: "GET_APP_VERSION_TARGETS",
      payload: { appIds: ["app-1", 42] },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects extra unexpected fields smuggled into the payload", () => {
    const result = parseCommandRequest({
      command: "GET_APP_VERSION_TARGETS",
      payload: { appIds: ["app-1"], graphqlQuery: "mutation { ... }" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseCommandRequest() UPDATE_APP_UI5_VERSION", () => {
  const validChange = { kind: "targetAppConfig", from: "1.100.0", to: "1.136.17", pathDescription: "targetAppConfig" };

  it("accepts a valid appId + changes payload", () => {
    const result = parseCommandRequest({
      command: "UPDATE_APP_UI5_VERSION",
      payload: { appId: "app-1", changes: [validChange] },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty changes array (never send a no-op mutation)", () => {
    const result = parseCommandRequest({
      command: "UPDATE_APP_UI5_VERSION",
      payload: { appId: "app-1", changes: [] },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a change with an unknown kind", () => {
    const result = parseCommandRequest({
      command: "UPDATE_APP_UI5_VERSION",
      payload: { appId: "app-1", changes: [{ ...validChange, kind: "arbitraryField" }] },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects extra unexpected top-level payload fields", () => {
    const result = parseCommandRequest({
      command: "UPDATE_APP_UI5_VERSION",
      payload: { appId: "app-1", changes: [validChange], rawCdm: { anything: true } },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a 'visualization' change missing visualizationKey (would otherwise be silently skipped by the writer)", () => {
    const result = parseCommandRequest({
      command: "UPDATE_APP_UI5_VERSION",
      payload: {
        appId: "app-1",
        changes: [{ kind: "visualization", from: "1.100.0", to: "1.136.17", pathDescription: "visualization: ?" }],
      },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a 'targetAppConfig' change with no visualizationKey (not required for that kind)", () => {
    const result = parseCommandRequest({
      command: "UPDATE_APP_UI5_VERSION",
      payload: { appId: "app-1", changes: [validChange] },
    });
    expect(result.ok).toBe(true);
  });
});

describe("parseCommandRequest() VERIFY_APP_UI5_VERSION", () => {
  it("accepts a valid appId + expectedVersion payload", () => {
    const result = parseCommandRequest({
      command: "VERIFY_APP_UI5_VERSION",
      payload: { appId: "app-1", expectedVersion: "1.136.17" },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a missing expectedVersion", () => {
    const result = parseCommandRequest({
      command: "VERIFY_APP_UI5_VERSION",
      payload: { appId: "app-1" },
    });
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
