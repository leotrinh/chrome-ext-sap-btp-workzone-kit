import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgedFetch } from "../../src/content/fetch-bridge";
import { handleFetchBridgeRequest } from "../../src/content/main-world-bridge";
import { FETCH_BRIDGE_CHANNEL, isFetchBridgeRequestMessage } from "../../src/content/fetch-bridge-protocol";

/**
 * jsdom's window.postMessage doesn't populate MessageEvent.source/.origin correctly
 * for same-window delivery (verified against real Chrome behavior, where
 * event.source === window and event.origin are both correct — this is the documented
 * Chrome pattern for MAIN-world <-> ISOLATED-world content script bridging). To test
 * bridgedFetch()'s real listener/matching/cleanup logic against the real
 * handleFetchBridgeRequest() business logic without depending on jsdom's incomplete
 * postMessage transport, this spies on window.postMessage for the outgoing request and
 * manually re-delivers the (real, computed) response via window.dispatchEvent with an
 * explicit source/origin — everything except the native cross-realm transport itself
 * is exercised for real.
 */
function wireUpFakeMainWorld(): void {
  vi.spyOn(window, "postMessage").mockImplementation((data: unknown) => {
    if (!isFetchBridgeRequestMessage(data)) {
      return;
    }
    void handleFetchBridgeRequest(data).then((result) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { channel: FETCH_BRIDGE_CHANNEL, type: "response", requestId: data.requestId, result },
          origin: window.location.origin,
          source: window,
        }),
      );
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bridgedFetch() <-> handleFetchBridgeRequest() integration", () => {
  it("relays a successful fetch and returns a Response-shaped result", async () => {
    wireUpFakeMainWorld();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("hello", { status: 200, headers: { "x-csrf-token": "tok-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await bridgedFetch("/semantic/graphql", {
      method: "HEAD",
      headers: { "x-csrf-token": "Fetch" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/semantic/graphql",
      expect.objectContaining({ method: "HEAD", headers: { "x-csrf-token": "Fetch" } }),
    );
    expect(response.status).toBe(200);
    expect(response.redirected).toBe(false);
    expect(response.headers.get("x-csrf-token")).toBe("tok-1");
    expect(response.headers.get("X-CSRF-TOKEN")).toBe("tok-1");
    await expect(response.text()).resolves.toBe("hello");
  });

  it("allows text()/json()/clone() to be called repeatedly (no stream to exhaust)", async () => {
    wireUpFakeMainWorld();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { pong: true } }), { status: 200 })),
    );

    const response = await bridgedFetch("/semantic/graphql", { method: "POST", headers: {}, body: "{}" });

    await expect(response.text()).resolves.toBe(JSON.stringify({ data: { pong: true } }));
    await expect(response.json()).resolves.toEqual({ data: { pong: true } });
    await expect(response.clone().json()).resolves.toEqual({ data: { pong: true } });
  });

  it("propagates a main-world fetch() failure as a rejection", async () => {
    wireUpFakeMainWorld();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    await expect(bridgedFetch("/semantic/graphql", { method: "HEAD", headers: {} })).rejects.toThrow("network down");
  });

  it("carries a non-2xx status through untouched, with the response body intact", async () => {
    wireUpFakeMainWorld();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad Request", { status: 400 })));

    const response = await bridgedFetch("/semantic/graphql", { method: "HEAD", headers: {} });

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Bad Request");
  });

  it("keeps concurrent bridgedFetch() calls independent (matched by requestId)", async () => {
    wireUpFakeMainWorld();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => new Response(`body-for-${url}`, { status: 200 })),
    );

    const [a, b] = await Promise.all([
      bridgedFetch("/a", { method: "GET", headers: {} }),
      bridgedFetch("/b", { method: "GET", headers: {} }),
    ]);

    await expect(a.text()).resolves.toBe("body-for-/a");
    await expect(b.text()).resolves.toBe("body-for-/b");
  });

  it("ignores a response event for a different requestId and eventually times out on its own", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(window, "postMessage").mockImplementation(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            channel: FETCH_BRIDGE_CHANNEL,
            type: "response",
            requestId: "not-the-real-one",
            result: { ok: true, status: 200, redirected: false, headers: {}, bodyText: "" },
          },
          origin: window.location.origin,
          source: window,
        }),
      );
    });

    const pending = bridgedFetch("/semantic/graphql", { method: "HEAD", headers: {} });
    const assertion = expect(pending).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(20000);
    await assertion;
    vi.useRealTimers();
  });
});
