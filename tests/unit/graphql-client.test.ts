import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQlRequest, resetCsrfCache } from "../../src/integrations/sap-workzone/graphql-client";
import { toBridgedResponse } from "./helpers/bridged-response";

vi.mock("../../src/content/fetch-bridge", () => ({
  bridgedFetch: vi.fn(),
}));

import { bridgedFetch } from "../../src/content/fetch-bridge";
const bridgedFetchMock = vi.mocked(bridgedFetch);

const REQUEST = { query: "query Ping { ping }", variables: {} };

beforeEach(() => {
  resetCsrfCache();
  bridgedFetchMock.mockReset();
});

function csrfResponse(token = "csrf-token"): Response {
  return new Response(null, { status: 200, headers: { "x-csrf-token": token } });
}

function graphQlSuccessResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function graphQlErrorResponse(message: string): Response {
  return new Response(JSON.stringify({ errors: [{ message }] }), { status: 200 });
}

function csrfRejectedResponse(): Response {
  return new Response(null, { status: 403, headers: { "x-csrf-token": "Required" } });
}

async function queue(...responses: Response[]): Promise<void> {
  for (const response of responses) {
    bridgedFetchMock.mockResolvedValueOnce(await toBridgedResponse(response));
  }
}

describe("executeGraphQlRequest()", () => {
  it("fetches CSRF then posts the GraphQL request, returning data on success", async () => {
    await queue(csrfResponse("tok-1"), graphQlSuccessResponse({ pong: true }));

    const result = await executeGraphQlRequest(REQUEST);

    expect(result).toEqual({ ok: true, data: { pong: true } });
    expect(bridgedFetchMock).toHaveBeenCalledTimes(2);
    const postCall = bridgedFetchMock.mock.calls.at(1);
    expect(postCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "tok-1" }),
      }),
    );
  });

  it("reuses the cached CSRF token across multiple requests (no repeat HEAD)", async () => {
    await queue(csrfResponse("tok-1"), graphQlSuccessResponse({ a: 1 }), graphQlSuccessResponse({ b: 2 }));

    await executeGraphQlRequest(REQUEST);
    await executeGraphQlRequest(REQUEST);

    expect(bridgedFetchMock).toHaveBeenCalledTimes(3); // 1 CSRF fetch + 2 POSTs
  });

  it("refetches CSRF and retries exactly once when the token is rejected", async () => {
    await queue(csrfResponse("stale-token"), csrfRejectedResponse(), csrfResponse("fresh-token"), graphQlSuccessResponse({ ok: true }));

    const result = await executeGraphQlRequest(REQUEST);

    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(bridgedFetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails with CSRF_REJECTED if the token is rejected twice in a row", async () => {
    await queue(csrfResponse("t1"), csrfRejectedResponse(), csrfResponse("t2"), csrfRejectedResponse());

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CSRF_REJECTED");
    }
    expect(bridgedFetchMock).toHaveBeenCalledTimes(4);
  });

  it("returns GRAPHQL_ERROR when the response body carries errors", async () => {
    await queue(csrfResponse(), graphQlErrorResponse("Entity not found"));

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: "GRAPHQL_ERROR", message: "Entity not found" });
    }
  });

  it("returns INVALID_RESPONSE on malformed JSON", async () => {
    await queue(csrfResponse(), new Response("not json", { status: 200 }));

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_RESPONSE");
    }
  });

  it("propagates a CSRF fetch failure without attempting the POST", async () => {
    await queue(new Response(null, { status: 401 }));

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTHENTICATION_REQUIRED");
    }
    expect(bridgedFetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the real GraphQL error message even when SAP attaches a non-2xx HTTP status (e.g. 400)", async () => {
    // Regression: SAP's GraphQL endpoint can return HTTP 400 for an ordinary
    // GraphQL-level error, same as the proven-working reference userscript observed
    // (hand-off/update-ui-version-script.js never gates on HTTP status for GraphQL
    // calls — it always parses the body and checks `errors`). Discarding the body on
    // any non-2xx status replaced this with an opaque "SAP returned HTTP 400."
    await queue(
      csrfResponse(),
      new Response(JSON.stringify({ errors: [{ message: "Invalid queryData.entityTypes value" }] }), {
        status: 400,
      }),
    );

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: "GRAPHQL_ERROR", message: "Invalid queryData.entityTypes value" });
    }
  });

  it("falls back to the generic HTTP_ERROR when a non-2xx response has no parseable GraphQL error body", async () => {
    await queue(csrfResponse(), new Response("<html>Bad Gateway</html>", { status: 502 }));

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: "HTTP_ERROR", message: "SAP returned HTTP 502." });
    }
  });

  it("still fails fast with AUTHORIZATION_DENIED on a real 403 (not a CSRF-required 403)", async () => {
    await queue(csrfResponse(), new Response(JSON.stringify({ errors: [{ message: "should be ignored" }] }), { status: 403 }));

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTHORIZATION_DENIED");
    }
  });

  it("returns NETWORK_ERROR when the POST itself throws", async () => {
    bridgedFetchMock.mockResolvedValueOnce(await toBridgedResponse(csrfResponse()));
    bridgedFetchMock.mockRejectedValueOnce(new TypeError("net"));

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });
});
