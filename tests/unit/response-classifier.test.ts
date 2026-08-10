import { describe, expect, it } from "vitest";
import {
  classifyHttpResponseError,
  classifyGraphQlBody,
  extractGraphQlErrorMessage,
} from "../../src/integrations/sap-workzone/response-classifier";

function makeResponse(status: number, headerEntries: Record<string, string> = {}): {
  status: number;
  redirected: boolean;
  headers: { get(name: string): string | null };
} {
  const headers = new Headers(headerEntries);
  return { status, redirected: false, headers };
}

describe("classifyHttpResponseError()", () => {
  it("returns null for 2xx success", () => {
    expect(classifyHttpResponseError(makeResponse(200))).toBeNull();
    expect(classifyHttpResponseError(makeResponse(204))).toBeNull();
  });

  it("classifies 401 as AUTHENTICATION_REQUIRED", () => {
    expect(classifyHttpResponseError(makeResponse(401))?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("classifies 403 with x-csrf-token: Required as CSRF_REJECTED", () => {
    const response = makeResponse(403, { "x-csrf-token": "Required" });
    expect(classifyHttpResponseError(response)?.code).toBe("CSRF_REJECTED");
  });

  it("classifies plain 403 as AUTHORIZATION_DENIED", () => {
    expect(classifyHttpResponseError(makeResponse(403))?.code).toBe("AUTHORIZATION_DENIED");
  });

  it("classifies a redirected response as AUTHENTICATION_REQUIRED regardless of status", () => {
    const response = { ...makeResponse(200), redirected: true };
    expect(classifyHttpResponseError(response)?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("classifies other 4xx/5xx as HTTP_ERROR", () => {
    expect(classifyHttpResponseError(makeResponse(404))?.code).toBe("HTTP_ERROR");
    expect(classifyHttpResponseError(makeResponse(500))?.code).toBe("HTTP_ERROR");
  });
});

describe("classifyGraphQlBody()", () => {
  it("returns null when there are no errors", () => {
    expect(classifyGraphQlBody({ data: { ok: true } })).toBeNull();
  });

  it("returns GRAPHQL_ERROR when errors array is non-empty", () => {
    expect(classifyGraphQlBody({ errors: [{ message: "boom" }] })).toBe("GRAPHQL_ERROR");
  });

  it("returns null when errors array is empty", () => {
    expect(classifyGraphQlBody({ errors: [] })).toBeNull();
  });

  it("handles non-object bodies safely", () => {
    expect(classifyGraphQlBody(null)).toBeNull();
    expect(classifyGraphQlBody("not json")).toBeNull();
    expect(classifyGraphQlBody(42)).toBeNull();
  });
});

describe("extractGraphQlErrorMessage()", () => {
  it("extracts the first error's message", () => {
    expect(extractGraphQlErrorMessage({ errors: [{ message: "first" }, { message: "second" }] })).toBe(
      "first",
    );
  });

  it("falls back to a generic message when shape is unexpected", () => {
    expect(extractGraphQlErrorMessage({ errors: [{}] })).toBe("GraphQL request returned errors.");
    expect(extractGraphQlErrorMessage({})).toBe("GraphQL request returned errors.");
  });
});
