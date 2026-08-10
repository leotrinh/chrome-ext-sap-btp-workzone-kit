import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCsrfToken } from "../../src/integrations/sap-workzone/csrf";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOnce(response: Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
}

describe("fetchCsrfToken()", () => {
  it("returns the token from the x-csrf-token response header", async () => {
    mockFetchOnce(new Response(null, { status: 200, headers: { "x-csrf-token": "abc123" } }));
    const result = await fetchCsrfToken();
    expect(result).toEqual({ ok: true, token: "abc123" });
  });

  it("uses HEAD method with x-csrf-token: Fetch request header", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { headers: { "x-csrf-token": "t" } }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCsrfToken();
    expect(fetchMock).toHaveBeenCalledWith(
      "/semantic/graphql",
      expect.objectContaining({
        method: "HEAD",
        credentials: "include",
        headers: expect.objectContaining({ "x-csrf-token": "Fetch" }),
      }),
    );
  });

  it("returns CSRF_MISSING when the header is absent on a 200", async () => {
    mockFetchOnce(new Response(null, { status: 200 }));
    const result = await fetchCsrfToken();
    expect(result).toEqual({
      ok: false,
      error: { code: "CSRF_MISSING", message: expect.any(String) },
    });
  });

  it("returns AUTHENTICATION_REQUIRED on a 401", async () => {
    mockFetchOnce(new Response(null, { status: 401 }));
    const result = await fetchCsrfToken();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTHENTICATION_REQUIRED");
    }
  });

  it("returns NETWORK_ERROR when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const result = await fetchCsrfToken();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });
});
