import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyUi5Version } from "../../src/integrations/sap-workzone/verification";
import { getBusinessAppDetail } from "../../src/integrations/sap-workzone/app-detail";

vi.mock("../../src/integrations/sap-workzone/app-detail", () => ({
  getBusinessAppDetail: vi.fn(),
}));

const mockedGetDetail = vi.mocked(getBusinessAppDetail);

beforeEach(() => {
  mockedGetDetail.mockReset();
});

const CDM_WITH_VERSION = (version: string) => ({
  payload: { targetAppConfig: { "sap.integration": { urlTemplateParams: { query: { "sap-ui-version": version } } } } },
});

describe("verifyUi5Version()", () => {
  it("returns 'verified' when every target matches the expected version", async () => {
    mockedGetDetail.mockResolvedValueOnce({ ok: true, detail: { id: "app-1", cdm: CDM_WITH_VERSION("1.136.17") } });

    const result = await verifyUi5Version("app-1", "1.136.17");

    expect(result).toEqual({ status: "verified" });
  });

  it("returns 'mismatch' when the re-fetched value differs from expected", async () => {
    mockedGetDetail.mockResolvedValueOnce({ ok: true, detail: { id: "app-1", cdm: CDM_WITH_VERSION("1.100.0") } });

    const result = await verifyUi5Version("app-1", "1.136.17");

    expect(result).toEqual({ status: "mismatch" });
  });

  it("returns 'not_verifiable' when the re-fetched CDM has no writable target", async () => {
    mockedGetDetail.mockResolvedValueOnce({ ok: true, detail: { id: "app-1", cdm: { payload: {} } } });

    const result = await verifyUi5Version("app-1", "1.136.17");

    expect(result).toEqual({ status: "not_verifiable" });
  });

  it("returns 'verification_failed' when the re-fetch itself fails", async () => {
    mockedGetDetail.mockResolvedValueOnce({ ok: false, error: { code: "NETWORK_ERROR", message: "offline" } });

    const result = await verifyUi5Version("app-1", "1.136.17");

    expect(result).toEqual({ status: "verification_failed", errorMessage: "offline" });
  });

  it("requires every target to match, not just one of several", async () => {
    mockedGetDetail.mockResolvedValueOnce({
      ok: true,
      detail: {
        id: "app-1",
        cdm: {
          payload: {
            targetAppConfig: { "sap.integration": { urlTemplateParams: { query: { "sap-ui-version": "1.136.17" } } } },
            visualizations: {
              launchTile: { vizConfig: { "sap.flp": { target: { parameters: { "sap-ui-version": { value: "1.100.0", format: "plain" } } } } } },
            },
          },
        },
      },
    });

    const result = await verifyUi5Version("app-1", "1.136.17");

    expect(result).toEqual({ status: "mismatch" });
  });
});
