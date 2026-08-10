import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchUi5VersionCatalog,
  filterUi5Patches,
  groupPatchesByMinor,
  type Ui5VersionPatch,
} from "../../src/integrations/ui5-versions/ui5-version-catalog";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUi5VersionCatalog()", () => {
  it("fetches and parses a well-formed catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            activeVersion: "1.150.1",
            versions: [{ version: "1.150.*" }],
            patches: [
              { version: "1.151.0", eocp: "To Be Determined" },
              { version: "1.150.1", eocp: "To Be Determined" },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await fetchUi5VersionCatalog();

    expect(result).toEqual({
      ok: true,
      catalog: {
        activeVersion: "1.150.1",
        patches: [
          { version: "1.151.0", eocp: "To Be Determined" },
          { version: "1.150.1", eocp: "To Be Determined" },
        ],
      },
    });
  });

  it("fetches without credentials (no SAP session data ever sent to a third-party host)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ activeVersion: "1.150.1", patches: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchUi5VersionCatalog();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ui5.sap.com/versionoverview.json",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("drops malformed patch entries instead of failing the whole fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            activeVersion: "1.150.1",
            patches: [
              { version: "1.151.0", eocp: "To Be Determined" },
              { version: "1.150.1" }, // missing eocp
              { eocp: "Q3/2027" }, // missing version
              "not an object",
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await fetchUi5VersionCatalog();

    expect(result).toEqual({
      ok: true,
      catalog: { activeVersion: "1.150.1", patches: [{ version: "1.151.0", eocp: "To Be Determined" }] },
    });
  });

  it("returns an error when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const result = await fetchUi5VersionCatalog();

    expect(result.ok).toBe(false);
  });

  it("returns an error when the body is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));

    const result = await fetchUi5VersionCatalog();

    expect(result.ok).toBe(false);
  });

  it("returns an error when the shape is unexpected (missing activeVersion/patches)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ foo: "bar" }), { status: 200 })));

    const result = await fetchUi5VersionCatalog();

    expect(result.ok).toBe(false);
  });

  it("returns NETWORK_ERROR-style failure when fetch itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await fetchUi5VersionCatalog();

    expect(result.ok).toBe(false);
  });
});

describe("groupPatchesByMinor()", () => {
  const patches: Ui5VersionPatch[] = [
    { version: "1.150.0", eocp: "Q3/2027" },
    { version: "1.151.0", eocp: "To Be Determined" },
    { version: "1.150.1", eocp: "To Be Determined" },
    { version: "1.136.17", eocp: "Q4/2033" },
    { version: "1.136.5", eocp: "Q4/2033" },
  ];

  it("groups patches by major.minor", () => {
    const groups = groupPatchesByMinor(patches);
    expect(groups.map((g) => g.minorVersion)).toEqual(["1.151", "1.150", "1.136"]);
  });

  it("sorts groups descending by minor version", () => {
    const groups = groupPatchesByMinor(patches);
    expect(groups[0]?.minorVersion).toBe("1.151");
    expect(groups.at(-1)?.minorVersion).toBe("1.136");
  });

  it("sorts patches within a group descending by patch number", () => {
    const groups = groupPatchesByMinor(patches);
    const group150 = groups.find((g) => g.minorVersion === "1.150");
    expect(group150?.patches.map((p) => p.version)).toEqual(["1.150.1", "1.150.0"]);
    const group136 = groups.find((g) => g.minorVersion === "1.136");
    expect(group136?.patches.map((p) => p.version)).toEqual(["1.136.17", "1.136.5"]);
  });

  it("handles an empty list", () => {
    expect(groupPatchesByMinor([])).toEqual([]);
  });
});

describe("filterUi5Patches()", () => {
  const patches: Ui5VersionPatch[] = [
    { version: "1.151.0", eocp: "To Be Determined" },
    { version: "1.150.1", eocp: "To Be Determined" },
    { version: "1.136.17", eocp: "Q4/2033" },
  ];

  it("returns everything for an empty/whitespace query", () => {
    expect(filterUi5Patches(patches, "")).toEqual(patches);
    expect(filterUi5Patches(patches, "   ")).toEqual(patches);
  });

  it("matches by substring, case-insensitively", () => {
    expect(filterUi5Patches(patches, "1.136")).toEqual([{ version: "1.136.17", eocp: "Q4/2033" }]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterUi5Patches(patches, "9.9.9")).toEqual([]);
  });
});
