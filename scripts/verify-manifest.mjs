import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ALLOWED_PERMISSIONS = ["storage", "sidePanel"];

// Chrome Web Store rejects the upload outright if manifest.description exceeds this
// (confirmed by the exact upload error this check was added for).
const MAX_DESCRIPTION_LENGTH = 132;

/**
 * @param {Record<string, unknown>} manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManifest(manifest) {
  const errors = [];

  if (manifest.manifest_version !== 3) {
    errors.push(`manifest_version must be 3, got ${JSON.stringify(manifest.manifest_version)}`);
  }

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  for (const permission of permissions) {
    if (!ALLOWED_PERMISSIONS.includes(permission)) {
      errors.push(`disallowed permission: ${permission}`);
    }
  }
  for (const required of ALLOWED_PERMISSIONS) {
    if (!permissions.includes(required)) {
      errors.push(`missing required permission: ${required}`);
    }
  }

  if (manifest.host_permissions !== undefined) {
    errors.push("host_permissions must not be present in V1");
  }

  if (manifest.oauth2 !== undefined) {
    errors.push("oauth2 must not be present in V1");
  }

  const csp = manifest.content_security_policy?.extension_pages ?? "";
  if (!/script-src\s+'self'/.test(csp)) {
    errors.push("content_security_policy.extension_pages must restrict script-src to 'self'");
  }
  if (/unsafe-eval/.test(csp)) {
    errors.push("content_security_policy.extension_pages must not allow unsafe-eval");
  }
  if (/https?:\/\//.test(csp)) {
    errors.push("content_security_policy.extension_pages must not reference a remote host");
  }

  if (manifest.background?.type !== "module") {
    errors.push("background.type must be 'module'");
  }

  if (typeof manifest.side_panel?.default_path !== "string") {
    errors.push("side_panel.default_path must be set");
  }

  if (typeof manifest.description === "string" && manifest.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `description is too long: ${manifest.description.length}. Chrome Web Store's limit is ${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  }

  const BROAD_MATCH_PATTERNS = ["<all_urls>", "*://*/*", "http://*/*", "https://*/*"];
  for (const script of manifest.content_scripts ?? []) {
    for (const match of script.matches ?? []) {
      if (BROAD_MATCH_PATTERNS.includes(match)) {
        errors.push(`content_scripts match pattern is too broad: ${match}`);
      }
    }
  }
  for (const entry of manifest.web_accessible_resources ?? []) {
    for (const match of entry.matches ?? []) {
      if (BROAD_MATCH_PATTERNS.includes(match)) {
        errors.push(`web_accessible_resources match pattern is too broad: ${match}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function runCli() {
  const manifestPath = fileURLToPath(new URL("../dist/manifest.json", import.meta.url));
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch (error) {
    console.error(`Failed to read ${manifestPath}: ${error.message}`);
    process.exit(1);
  }

  const { valid, errors } = validateManifest(manifest);
  if (!valid) {
    console.error("Manifest verification failed:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  console.log("Manifest verification passed.");
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  runCli();
}
