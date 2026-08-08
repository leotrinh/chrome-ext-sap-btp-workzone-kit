import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateManifest } from "../../scripts/verify-manifest.mjs";

const manifestPath = resolve(process.cwd(), "public/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

const ALLOWED_PERMISSIONS = ["activeTab", "scripting", "storage", "sidePanel"];

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
      permissions: ["activeTab", "scripting", "storage"],
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
});
