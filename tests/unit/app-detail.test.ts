import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBusinessAppDetail, getBusinessAppDetails } from "../../src/integrations/sap-workzone/app-detail";
import { executeGraphQlRequest } from "../../src/integrations/sap-workzone/graphql-client";

vi.mock("../../src/integrations/sap-workzone/graphql-client", () => ({
  executeGraphQlRequest: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQlRequest);

beforeEach(() => {
  mockedExecute.mockReset();
});

describe("getBusinessAppDetail()", () => {
  it("returns the cdm on success", async () => {
    mockedExecute.mockResolvedValueOnce({ ok: true, data: { entity: { cdm: { payload: {} } } } });

    const result = await getBusinessAppDetail("app-1");

    expect(result).toEqual({ ok: true, detail: { id: "app-1", cdm: { payload: {} } } });
  });

  it("propagates GraphQL/HTTP errors", async () => {
    mockedExecute.mockResolvedValueOnce({ ok: false, error: { code: "HTTP_ERROR", message: "500" } });

    const result = await getBusinessAppDetail("app-1");

    expect(result).toEqual({ ok: false, error: { code: "HTTP_ERROR", message: "500" } });
  });

  it("returns INVALID_RESPONSE when entity is null", async () => {
    mockedExecute.mockResolvedValueOnce({ ok: true, data: { entity: null } });

    const result = await getBusinessAppDetail("app-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_RESPONSE");
    }
  });
});

describe("getBusinessAppDetails()", () => {
  it("never exceeds concurrency 5 and returns one result per app id", async () => {
    let active = 0;
    let maxActive = 0;
    mockedExecute.mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return { ok: true, data: { entity: { cdm: {} } } };
    });

    const appIds = Array.from({ length: 12 }, (_, i) => `app-${i}`);
    const results = await getBusinessAppDetails(appIds);

    expect(maxActive).toBeLessThanOrEqual(5);
    expect(results).toHaveLength(12);
    expect(results.every((r) => r.result.ok)).toBe(true);
    expect(results.map((r) => r.appId)).toEqual(appIds);
  });

  it("a single failure doesn't block the rest of the batch", async () => {
    mockedExecute
      .mockResolvedValueOnce({ ok: false, error: { code: "HTTP_ERROR", message: "fail" } })
      .mockResolvedValue({ ok: true, data: { entity: { cdm: {} } } });

    const results = await getBusinessAppDetails(["a", "b", "c"]);

    expect(results).toHaveLength(3);
    expect(results.filter((r) => !r.result.ok)).toHaveLength(1);
  });
});
