import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateManifest } from "../../scripts/verify-manifest.mjs";

const manifestPath = resolve(process.cwd(), "public/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

const ALLOWED_PERMISSIONS = ["storage", "sidePanel"];

describe("public/manifest.json", () => {
  it("is manifest_version 3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("declares exactly the allowed permissions, nothing more", () => {
    expect([...manifest.permissions].sort()).toEqual([...ALLOWED_PERMISSIONS].sort());
  });

  it("does not declare host_permissions", () => {
    expect(manifest.host_permissions).toBeUndefined();
  });

  it("has a restrictive extension_pages CSP with no unsafe-eval and no remote host", () => {
    const csp = manifest.content_security_policy.extension_pages;
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(csp).not.toMatch(/https?:\/\//);
    expect(csp).toMatch(/script-src 'self'/);
  });

  it("registers a module service worker", () => {
    expect(manifest.background.type).toBe("module");
    expect(manifest.background.service_worker).toBe("service-worker.js");
  });

  it("registers the side panel entry point", () => {
    expect(manifest.side_panel.default_path).toBe("sidepanel/index.html");
  });

  it("registers the isolated-world content script (floating button + command relay) scoped to hana.ondemand.com only", () => {
    expect(manifest.content_scripts).toHaveLength(2);
    expect(manifest.content_scripts[0].matches).toEqual(["*://*.hana.ondemand.com/*"]);
    expect(manifest.content_scripts[0].js).toEqual(["content-script.js"]);
    expect(manifest.content_scripts[0].world).toBeUndefined();
  });

  it("registers the MAIN-world fetch bridge scoped to hana.ondemand.com only", () => {
    expect(manifest.content_scripts[1].matches).toEqual(["*://*.hana.ondemand.com/*"]);
    expect(manifest.content_scripts[1].js).toEqual(["main-world-bridge.js"]);
    expect(manifest.content_scripts[1].world).toBe("MAIN");
  });

  it("exposes the side panel bundle to hana.ondemand.com only, for the in-page overlay iframe", () => {
    expect(manifest.web_accessible_resources).toHaveLength(1);
    const entry = manifest.web_accessible_resources[0];
    expect(entry.matches).toEqual(["*://*.hana.ondemand.com/*"]);
    expect(entry.resources).toEqual(["sidepanel/index.html", "sidepanel/assets/*"]);
  });

  it("keeps description within the Chrome Web Store's 132-character limit", () => {
    // Regression: a 139-char description was rejected at upload time with "The
    // description field in manifest is too long: 139. It exceeds maximum size
    // limit of 132 characters." — this test (plus validateManifest() below) catches
    // that in CI instead of at upload time.
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });
});

describe("validateManifest()", () => {
  it("passes on the real manifest", () => {
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a manifest with an extra permission", () => {
    const result = validateManifest({
      ...manifest,
      permissions: [...ALLOWED_PERMISSIONS, "cookies"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/cookies/);
  });

  it("rejects a manifest with host_permissions", () => {
    const result = validateManifest({
      ...manifest,
      host_permissions: ["https://*.hana.ondemand.com/*"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/host_permissions/);
  });

  it("rejects a manifest missing a required permission", () => {
    const result = validateManifest({
      ...manifest,
      permissions: ["storage"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/sidePanel/);
  });

  it("rejects a CSP allowing unsafe-eval", () => {
    const result = validateManifest({
      ...manifest,
      content_security_policy: {
        extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self'",
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/unsafe-eval/);
  });

  it("rejects manifest_version 2", () => {
    const result = validateManifest({ ...manifest, manifest_version: 2 });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/manifest_version/);
  });

  it("rejects a content_scripts match pattern broader than hana.ondemand.com", () => {
    const result = validateManifest({
      ...manifest,
      content_scripts: [{ matches: ["<all_urls>"], js: ["floating-button.js"] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/too broad/);
  });

  it("rejects a web_accessible_resources match pattern broader than hana.ondemand.com", () => {
    const result = validateManifest({
      ...manifest,
      web_accessible_resources: [{ resources: ["sidepanel/index.html"], matches: ["<all_urls>"] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/too broad/);
  });

  it("rejects a description longer than 132 characters (real Chrome Web Store upload error)", () => {
    const result = validateManifest({
      ...manifest,
      description: "x".repeat(139),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/too long/);
  });
});
