import { describe, expect, it } from "vitest";
import { findRootAbsoluteAssetRefs } from "../../scripts/sidepanel-html-guard.mjs";

describe("findRootAbsoluteAssetRefs()", () => {
  it("flags a root-absolute script src (the bug: 404s under chrome-extension://<id>/sidepanel/)", () => {
    const html = `<script type="module" src="/assets/index-abc123.js"></script>`;
    expect(findRootAbsoluteAssetRefs(html)).toEqual(['src="/assets/index-abc123.js"']);
  });

  it("flags a root-absolute stylesheet href", () => {
    const html = `<link rel="stylesheet" href="/assets/index-abc123.css">`;
    expect(findRootAbsoluteAssetRefs(html)).toEqual(['href="/assets/index-abc123.css"']);
  });

  it("does not flag relative asset paths (the fix)", () => {
    const html =
      `<script type="module" src="./assets/index-abc123.js"></script>` +
      `<link rel="stylesheet" href="./assets/index-abc123.css">`;
    expect(findRootAbsoluteAssetRefs(html)).toEqual([]);
  });

  it("does not flag protocol-relative or external URLs", () => {
    const html = `<a href="https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit">GitHub</a>`;
    expect(findRootAbsoluteAssetRefs(html)).toEqual([]);
  });
});
