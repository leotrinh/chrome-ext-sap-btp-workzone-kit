import { beforeEach, describe, expect, it, vi } from "vitest";
import { listLocalBusinessApps } from "../../src/integrations/sap-workzone/app-list";
import { executeGraphQlRequest } from "../../src/integrations/sap-workzone/graphql-client";

vi.mock("../../src/integrations/sap-workzone/graphql-client", () => ({
  executeGraphQlRequest: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQlRequest);

beforeEach(() => {
  mockedExecute.mockReset();
});

describe("listLocalBusinessApps()", () => {
  it("returns local apps and filters out linked (baseId !== null) apps", async () => {
    mockedExecute.mockResolvedValueOnce({
      ok: true,
      data: {
        entities: {
          items: [
            { id: "a", title: "A", baseId: null, entityType: "businessapp" },
            { id: "b", title: "B", baseId: "linked-base", entityType: "businessapp" },
          ],
          continuationToken: null,
        },
      },
    });

    const result = await listLocalBusinessApps();

    expect(result).toEqual({
      ok: true,
      apps: [{ id: "a", title: "A", baseId: null, entityType: "businessapp" }],
    });
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });

  it("paginates across multiple pages until continuationToken is null", async () => {
    mockedExecute
      .mockResolvedValueOnce({
        ok: true,
        data: {
          entities: {
            items: [{ id: "a", title: "A", baseId: null, entityType: "businessapp" }],
            continuationToken: "tok-2",
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          entities: {
            items: [{ id: "b", title: "B", baseId: null, entityType: "businessapp" }],
            continuationToken: null,
          },
        },
      });

    const result = await listLocalBusinessApps();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.apps.map((app) => app.id)).toEqual(["a", "b"]);
    }
    expect(mockedExecute).toHaveBeenCalledTimes(2);
  });

  it("handles an empty result", async () => {
    mockedExecute.mockResolvedValueOnce({
      ok: true,
      data: { entities: { items: [], continuationToken: null } },
    });

    const result = await listLocalBusinessApps();

    expect(result).toEqual({ ok: true, apps: [] });
  });

  it("propagates a GraphQL error immediately without further pagination", async () => {
    mockedExecute.mockResolvedValueOnce({
      ok: false,
      error: { code: "GRAPHQL_ERROR", message: "boom" },
    });

    const result = await listLocalBusinessApps();

    expect(result).toEqual({ ok: false, error: { code: "GRAPHQL_ERROR", message: "boom" } });
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });

  it("aborts with PAGE_CHANGED when the same continuation token repeats", async () => {
    mockedExecute
      .mockResolvedValueOnce({
        ok: true,
        data: { entities: { items: [], continuationToken: "loop-token" } },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { entities: { items: [], continuationToken: "loop-token" } },
      });

    const result = await listLocalBusinessApps();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PAGE_CHANGED");
    }
  });

  it("treats a null items array as an empty page (never throws)", async () => {
    mockedExecute.mockResolvedValueOnce({
      ok: true,
      data: { entities: { items: null, continuationToken: null } },
    });

    const result = await listLocalBusinessApps();

    expect(result).toEqual({ ok: true, apps: [] });
  });
});
