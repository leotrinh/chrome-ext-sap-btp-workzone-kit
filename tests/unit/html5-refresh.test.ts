import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshHtml5Content } from "../../src/integrations/sap-workzone/html5-refresh";
import { resetCsrfCache } from "../../src/integrations/sap-workzone/graphql-client";
import { toBridgedResponse } from "./helpers/bridged-response";

vi.mock("../../src/content/fetch-bridge", () => ({
  bridgedFetch: vi.fn(),
}));

import { bridgedFetch } from "../../src/content/fetch-bridge";
const bridgedFetchMock = vi.mocked(bridgedFetch);

beforeEach(() => {
  resetCsrfCache();
  bridgedFetchMock.mockReset();
});

function csrfResponse(token = "csrf-token"): Response {
  return new Response(null, { status: 200, headers: { "x-csrf-token": token } });
}

async function mockFetchSequence(...responses: Response[]): Promise<void> {
  for (const response of responses) {
    bridgedFetchMock.mockResolvedValueOnce(await toBridgedResponse(response));
  }
}

describe("refreshHtml5Content()", () => {
  it("sends the exact fixed payload and reports 'triggered' on success", async () => {
    await mockFetchSequence(csrfResponse("tok-1"), new Response("OK", { status: 200 }));

    const result = await refreshHtml5Content("acme-prod", "sub-123");

    expect(result).toEqual({ status: "triggered" });
    const postCall = bridgedFetchMock.mock.calls.at(1);
    expect(postCall?.[0]).toBe("/semantic/entity/provider/html5");
    expect(postCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "tok-1" }),
        body: JSON.stringify({
          providerId: "saas_approuter",
          contentAdditionMode: "manual",
          subdomain: "acme-prod",
          subaccountId: "sub-123",
        }),
      }),
    );
  });

  it("maps a 401 to authentication_required", async () => {
    await mockFetchSequence(csrfResponse(), new Response(null, { status: 401 }));

    const result = await refreshHtml5Content("acme-prod", "sub-123");

    expect(result.status).toBe("authentication_required");
  });

  it("maps a 403 (non-CSRF) to authorization_denied", async () => {
    await mockFetchSequence(csrfResponse(), new Response(null, { status: 403 }));

    const result = await refreshHtml5Content("acme-prod", "sub-123");

    expect(result.status).toBe("authorization_denied");
  });

  it("retries once with a fresh CSRF token, then succeeds", async () => {
    await mockFetchSequence(
      csrfResponse("stale"),
      new Response(null, { status: 403, headers: { "x-csrf-token": "Required" } }),
      csrfResponse("fresh"),
      new Response("OK", { status: 200 }),
    );

    const result = await refreshHtml5Content("acme-prod", "sub-123");

    expect(result).toEqual({ status: "triggered" });
    expect(bridgedFetchMock).toHaveBeenCalledTimes(4);
  });

  it("reports csrf_error if the token is rejected twice in a row", async () => {
    await mockFetchSequence(
      csrfResponse("t1"),
      new Response(null, { status: 403, headers: { "x-csrf-token": "Required" } }),
      csrfResponse("t2"),
      new Response(null, { status: 403, headers: { "x-csrf-token": "Required" } }),
    );

    const result = await refreshHtml5Content("acme-prod", "sub-123");

    expect(result.status).toBe("csrf_error");
  });

  it("maps a 500 to server_error", async () => {
    await mockFetchSequence(csrfResponse(), new Response(null, { status: 500 }));

    const result = await refreshHtml5Content("acme-prod", "sub-123");

    expect(result.status).toBe("server_error");
  });

  it("maps a network throw during the POST to network_error", async () => {
    bridgedFetchMock.mockResolvedValueOnce(await toBridgedResponse(csrfResponse()));
    bridgedFetchMock.mockRejectedValueOnce(new TypeError("net"));

    const result = await refreshHtml5Content("acme-prod", "sub-123");

    expect(result.status).toBe("network_error");
  });

  it("propagates a CSRF acquisition failure without attempting the POST", async () => {
    await mockFetchSequence(new Response(null, { status: 401 }));

    const result = await refreshHtml5Content("acme-prod", "sub-123");

    expect(result.status).toBe("authentication_required");
    expect(bridgedFetchMock).toHaveBeenCalledTimes(1);
  });
});
