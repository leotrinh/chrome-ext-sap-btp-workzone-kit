import { afterEach, describe, expect, it, vi } from "vitest";
import { handleFetchBridgeRequest } from "../../src/content/main-world-bridge";
import { FETCH_BRIDGE_CHANNEL } from "../../src/content/fetch-bridge-protocol";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleFetchBridgeRequest()", () => {
  it("performs the fetch and returns a serializable success result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("hello", { status: 200, headers: { "x-csrf-token": "tok-1" } })),
    );

    const result = await handleFetchBridgeRequest({
      channel: FETCH_BRIDGE_CHANNEL,
      type: "request",
      requestId: "r1",
      url: "/semantic/graphql",
      init: { method: "HEAD", headers: { "x-csrf-token": "Fetch" } },
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      redirected: false,
      headers: { "content-type": "text/plain;charset=UTF-8", "x-csrf-token": "tok-1" },
      bodyText: "hello",
    });
  });

  it("passes method/headers/credentials/body through to fetch() unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await handleFetchBridgeRequest({
      channel: FETCH_BRIDGE_CHANNEL,
      type: "request",
      requestId: "r1",
      url: "/semantic/graphql",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": "tok-1" },
        credentials: "include",
        body: '{"query":"..."}',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("/semantic/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "tok-1" },
      credentials: "include",
      body: '{"query":"..."}',
    });
  });

  it("returns ok:false when fetch() itself throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await handleFetchBridgeRequest({
      channel: FETCH_BRIDGE_CHANNEL,
      type: "request",
      requestId: "r1",
      url: "/semantic/graphql",
      init: { method: "HEAD", headers: {} },
    });

    expect(result).toEqual({ ok: false, errorMessage: "Failed to fetch" });
  });

  it("preserves a non-2xx status and empty body faithfully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 400 })));

    const result = await handleFetchBridgeRequest({
      channel: FETCH_BRIDGE_CHANNEL,
      type: "request",
      requestId: "r1",
      url: "/semantic/graphql",
      init: { method: "HEAD", headers: { "x-csrf-token": "Fetch" } },
    });

    expect(result).toEqual({ ok: true, status: 400, redirected: false, headers: {}, bodyText: "" });
  });
});
