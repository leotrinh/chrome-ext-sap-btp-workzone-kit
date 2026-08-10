import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyChangesToClonedCdm,
  applyUi5VersionChanges,
} from "../../src/integrations/sap-workzone/ui5-version-writer";
import { getBusinessAppDetail } from "../../src/integrations/sap-workzone/app-detail";
import { executeGraphQlRequest } from "../../src/integrations/sap-workzone/graphql-client";
import type { Ui5VersionChange } from "../../src/domain/update-plan";

vi.mock("../../src/integrations/sap-workzone/app-detail", () => ({
  getBusinessAppDetail: vi.fn(),
}));
vi.mock("../../src/integrations/sap-workzone/graphql-client", () => ({
  executeGraphQlRequest: vi.fn(),
}));

const mockedGetDetail = vi.mocked(getBusinessAppDetail);
const mockedExecute = vi.mocked(executeGraphQlRequest);

beforeEach(() => {
  mockedGetDetail.mockReset();
  mockedExecute.mockReset();
});

interface TestCdm {
  payload: {
    targetAppConfig?: { "sap.integration": { urlTemplateParams: { query: Record<string, unknown> } } };
    visualizations?: Record<
      string,
      { vizConfig: { "sap.flp": { target: { parameters: Record<string, { value: string; format: string }> } } } }
    >;
    unrelatedField?: string;
  };
}

describe("applyChangesToClonedCdm()", () => {
  it("writes the targetAppConfig path without touching sibling fields", () => {
    const original: TestCdm = {
      payload: {
        targetAppConfig: {
          "sap.integration": { urlTemplateParams: { query: { "sap-ui-version": "1.100.0", other: "keep-me" } } },
        },
        unrelatedField: "untouched",
      },
    };
    const changes: Ui5VersionChange[] = [
      { kind: "targetAppConfig", from: "1.100.0", to: "1.136.17", pathDescription: "targetAppConfig" },
    ];

    const result = applyChangesToClonedCdm(original, changes) as TestCdm;
    const query = result.payload.targetAppConfig?.["sap.integration"].urlTemplateParams.query;

    expect(query?.["sap-ui-version"]).toBe("1.136.17");
    expect(query?.other).toBe("keep-me");
    expect(result.payload.unrelatedField).toBe("untouched");
  });

  it("writes the visualization path as { value, format: 'plain' }", () => {
    const original: TestCdm = {
      payload: {
        visualizations: {
          launchTile: {
            vizConfig: { "sap.flp": { target: { parameters: { "sap-ui-version": { value: "1.100.0", format: "plain" } } } } },
          },
        },
      },
    };
    const changes: Ui5VersionChange[] = [
      {
        kind: "visualization",
        visualizationKey: "launchTile",
        from: "1.100.0",
        to: "1.136.17",
        pathDescription: "visualization: launchTile",
      },
    ];

    const result = applyChangesToClonedCdm(original, changes) as TestCdm;
    const parameters = result.payload.visualizations?.launchTile?.vizConfig["sap.flp"].target.parameters;

    expect(parameters?.["sap-ui-version"]).toEqual({ value: "1.136.17", format: "plain" });
  });

  it("never mutates the original CDM object", () => {
    const original: TestCdm = {
      payload: {
        targetAppConfig: { "sap.integration": { urlTemplateParams: { query: { "sap-ui-version": "1.100.0" } } } },
      },
    };
    const snapshot = JSON.parse(JSON.stringify(original));
    const changes: Ui5VersionChange[] = [
      { kind: "targetAppConfig", from: "1.100.0", to: "1.136.17", pathDescription: "targetAppConfig" },
    ];

    applyChangesToClonedCdm(original, changes);

    expect(original).toEqual(snapshot);
  });

  it("applies multiple changes independently in one clone", () => {
    const original: TestCdm = {
      payload: {
        targetAppConfig: { "sap.integration": { urlTemplateParams: { query: { "sap-ui-version": "1.100.0" } } } },
        visualizations: {
          appTile: { vizConfig: { "sap.flp": { target: { parameters: { "sap-ui-version": { value: "1.90.0", format: "plain" } } } } } },
        },
      },
    };
    const changes: Ui5VersionChange[] = [
      { kind: "targetAppConfig", from: "1.100.0", to: "1.136.17", pathDescription: "targetAppConfig" },
      {
        kind: "visualization",
        visualizationKey: "appTile",
        from: "1.90.0",
        to: "1.136.17",
        pathDescription: "visualization: appTile",
      },
    ];

    const result = applyChangesToClonedCdm(original, changes) as TestCdm;

    expect(result.payload.targetAppConfig?.["sap.integration"].urlTemplateParams.query["sap-ui-version"]).toBe(
      "1.136.17",
    );
    expect(
      result.payload.visualizations?.appTile?.vizConfig["sap.flp"].target.parameters["sap-ui-version"]?.value,
    ).toBe("1.136.17");
  });
});

describe("applyUi5VersionChanges()", () => {
  const changes: Ui5VersionChange[] = [
    { kind: "targetAppConfig", from: "1.100.0", to: "1.136.17", pathDescription: "targetAppConfig" },
  ];

  it("re-fetches the CDM, applies changes, and sends the mutation", async () => {
    mockedGetDetail.mockResolvedValueOnce({
      ok: true,
      detail: {
        id: "app-1",
        cdm: { payload: { targetAppConfig: { "sap.integration": { urlTemplateParams: { query: { "sap-ui-version": "1.100.0" } } } } } },
      },
    });
    mockedExecute.mockResolvedValueOnce({ ok: true, data: { batchProcess: { activation: "ok" } } });

    const result = await applyUi5VersionChanges("app-1", changes);

    expect(result).toEqual({ ok: true });
    expect(mockedExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          batchOperations: {
            BATCH: [{ metadata: { operation: "UPDATE" }, cdm: expect.any(Object) }],
          },
        }),
      }),
    );
  });

  it("propagates a detail-fetch failure without attempting the mutation", async () => {
    mockedGetDetail.mockResolvedValueOnce({ ok: false, error: { code: "HTTP_ERROR", message: "500" } });

    const result = await applyUi5VersionChanges("app-1", changes);

    expect(result).toEqual({ ok: false, error: { code: "HTTP_ERROR", message: "500" } });
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("propagates a GraphQL mutation error", async () => {
    mockedGetDetail.mockResolvedValueOnce({
      ok: true,
      detail: {
        id: "app-1",
        cdm: { payload: { targetAppConfig: { "sap.integration": { urlTemplateParams: { query: { "sap-ui-version": "1.100.0" } } } } } },
      },
    });
    mockedExecute.mockResolvedValueOnce({ ok: false, error: { code: "GRAPHQL_ERROR", message: "mutation failed" } });

    const result = await applyUi5VersionChanges("app-1", changes);

    expect(result).toEqual({ ok: false, error: { code: "GRAPHQL_ERROR", message: "mutation failed" } });
  });

  it("refuses to write (and never fabricates structure) when the target is no longer present in the freshly-fetched CDM", async () => {
    // Fresh CDM has no targetAppConfig at all — target was removed/renamed since scan.
    mockedGetDetail.mockResolvedValueOnce({ ok: true, detail: { id: "app-1", cdm: { payload: {} } } });

    const result = await applyUi5VersionChanges("app-1", changes);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PAGE_CHANGED");
    }
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("refuses to write a visualization change whose key no longer exists in the fresh CDM", async () => {
    mockedGetDetail.mockResolvedValueOnce({
      ok: true,
      detail: { id: "app-1", cdm: { payload: { visualizations: {} } } },
    });
    const visualizationChange: Ui5VersionChange[] = [
      { kind: "visualization", visualizationKey: "launchTile", from: "1.100.0", to: "1.136.17", pathDescription: "visualization: launchTile" },
    ];

    const result = await applyUi5VersionChanges("app-1", visualizationChange);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PAGE_CHANGED");
    }
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("proceeds normally when every target is confirmed present on the fresh CDM", async () => {
    mockedGetDetail.mockResolvedValueOnce({
      ok: true,
      detail: {
        id: "app-1",
        cdm: { payload: { targetAppConfig: { "sap.integration": { urlTemplateParams: { query: { "sap-ui-version": "1.100.0" } } } } } },
      },
    });
    mockedExecute.mockResolvedValueOnce({ ok: true, data: { batchProcess: { activation: "ok" } } });

    const result = await applyUi5VersionChanges("app-1", changes);

    expect(result).toEqual({ ok: true });
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });
});
