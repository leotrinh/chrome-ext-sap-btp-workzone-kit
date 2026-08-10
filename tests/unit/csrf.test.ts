import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCsrfToken } from "../../src/integrations/sap-workzone/csrf";
import { toBridgedResponse } from "./helpers/bridged-response";

vi.mock("../../src/content/fetch-bridge", () => ({
  bridgedFetch: vi.fn(),
}));

import { bridgedFetch } from "../../src/content/fetch-bridge";
const bridgedFetchMock = vi.mocked(bridgedFetch);

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchCsrfToken()", () => {
  it("returns the token from the x-csrf-token response header on a 200", async () => {
    bridgedFetchMock.mockResolvedValue(
      await toBridgedResponse(new Response(null, { status: 200, headers: { "x-csrf-token": "abc123" } })),
    );
    const result = await fetchCsrfToken();
    expect(result).toEqual({ ok: true, token: "abc123" });
  });

  it("uses HEAD with x-csrf-token: Fetch, via the MAIN-world bridge", async () => {
    bridgedFetchMock.mockResolvedValue(
      await toBridgedResponse(new Response(null, { headers: { "x-csrf-token": "t" } })),
    );
    await fetchCsrfToken();
    expect(bridgedFetchMock).toHaveBeenCalledWith(
      "/semantic/graphql",
      expect.objectContaining({
        method: "HEAD",
        credentials: "include",
        headers: expect.objectContaining({ "x-csrf-token": "Fetch" }),
      }),
    );
  });

  it("returns the token even when the response status is 400 (regression: real tenant behavior)", async () => {
    // Regression for the actual bug: a real tenant capture of the proven-working
    // Tampermonkey reference script showed HEAD /semantic/graphql returning HTTP 400
    // while STILL carrying a valid, usable x-csrf-token header — the exact token the
    // very next request succeeded with. The reference script's getCsrfToken() never
    // checks res.ok/status at all, it just reads the header unconditionally. Checking
    // status first (as this code used to) discarded a token that was right there.
    bridgedFetchMock.mockResolvedValue(
      await toBridgedResponse(
        new Response(null, { status: 400, headers: { "x-csrf-token": "fake-1234abcd5678ef90-XxXxXxXxXxXxXxXxXxXxXx" } }),
      ),
    );
    const result = await fetchCsrfToken();
    expect(result).toEqual({ ok: true, token: "fake-1234abcd5678ef90-XxXxXxXxXxXxXxXxXxXxXx" });
  });

  it("does not treat the 'Required' sentinel as a usable token", async () => {
    // Distinct from the 400-with-real-token case above: a 403 carrying
    // `x-csrf-token: Required` is SAP's documented "you need a fresh token" signal,
    // not a token value — must still be classified as CSRF_REJECTED, not returned as
    // if it were a real token.
    bridgedFetchMock.mockResolvedValue(
      await toBridgedResponse(new Response(null, { status: 403, headers: { "x-csrf-token": "Required" } })),
    );
    const result = await fetchCsrfToken();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CSRF_REJECTED");
    }
  });

  it("returns CSRF_MISSING when the header is absent on a 200", async () => {
    bridgedFetchMock.mockResolvedValue(await toBridgedResponse(new Response(null, { status: 200 })));
    const result = await fetchCsrfToken();
    expect(result).toEqual({
      ok: false,
      error: { code: "CSRF_MISSING", message: expect.any(String) },
    });
  });

  it("returns AUTHENTICATION_REQUIRED on a 401 with no token header", async () => {
    bridgedFetchMock.mockResolvedValue(await toBridgedResponse(new Response(null, { status: 401 })));
    const result = await fetchCsrfToken();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTHENTICATION_REQUIRED");
    }
  });

  it("returns NETWORK_ERROR when the bridge rejects (e.g. main-world fetch throws)", async () => {
    bridgedFetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await fetchCsrfToken();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });
});
