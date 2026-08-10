import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQlRequest, resetCsrfCache } from "../../src/integrations/sap-workzone/graphql-client";

const REQUEST = { query: "query Ping { ping }", variables: {} };

beforeEach(() => {
  resetCsrfCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
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

describe("executeGraphQlRequest()", () => {
  it("fetches CSRF then posts the GraphQL request, returning data on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse("tok-1"))
      .mockResolvedValueOnce(graphQlSuccessResponse({ pong: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeGraphQlRequest(REQUEST);

    expect(result).toEqual({ ok: true, data: { pong: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postCall = fetchMock.mock.calls.at(1);
    expect(postCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.objectContaining({ "X-CSRF-Token": "tok-1" }),
      }),
    );
  });

  it("reuses the cached CSRF token across multiple requests (no repeat HEAD)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse("tok-1"))
      .mockResolvedValueOnce(graphQlSuccessResponse({ a: 1 }))
      .mockResolvedValueOnce(graphQlSuccessResponse({ b: 2 }));
    vi.stubGlobal("fetch", fetchMock);

    await executeGraphQlRequest(REQUEST);
    await executeGraphQlRequest(REQUEST);

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 CSRF fetch + 2 POSTs
  });

  it("refetches CSRF and retries exactly once when the token is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse("stale-token"))
      .mockResolvedValueOnce(csrfRejectedResponse())
      .mockResolvedValueOnce(csrfResponse("fresh-token"))
      .mockResolvedValueOnce(graphQlSuccessResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeGraphQlRequest(REQUEST);

    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails with CSRF_REJECTED if the token is rejected twice in a row", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse("t1"))
      .mockResolvedValueOnce(csrfRejectedResponse())
      .mockResolvedValueOnce(csrfResponse("t2"))
      .mockResolvedValueOnce(csrfRejectedResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CSRF_REJECTED");
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("returns GRAPHQL_ERROR when the response body carries errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(graphQlErrorResponse("Entity not found"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: "GRAPHQL_ERROR", message: "Entity not found" });
    }
  });

  it("returns INVALID_RESPONSE on malformed JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(new Response("not json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_RESPONSE");
    }
  });

  it("propagates a CSRF fetch failure without attempting the POST", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTHENTICATION_REQUIRED");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns NETWORK_ERROR when the POST itself throws", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(csrfResponse()).mockRejectedValueOnce(new TypeError("net"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeGraphQlRequest(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });
});
