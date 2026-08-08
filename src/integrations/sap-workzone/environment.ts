export interface DetectEnvironmentInput {
  hostname: string;
  flpCfConfigContent: string | null;
  ushellConfigSiteConfigContent: string | null;
}

export type EnvironmentMetadataSource = "sap.flp.cf.Config" | "sap.ushellConfig.siteConfig";

export interface EnvironmentExtractionResult {
  subdomain: string | null;
  subaccountId: string | null;
  metadataSource: EnvironmentMetadataSource | null;
  warnings: string[];
}

export function extractSubdomainFromHostname(hostname: string): string | null {
  const first = hostname.split(".")[0]?.trim();
  return first ? first : null;
}

function safeParseJsonObject(
  source: string | null,
  sourceLabel: string,
  warnings: string[],
): Record<string, unknown> | null {
  if (!source) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(source);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    warnings.push(`${sourceLabel}: parsed metadata is not a JSON object`);
    return null;
  } catch {
    warnings.push(`${sourceLabel}: failed to parse metadata as JSON`);
    return null;
  }
}

function getNestedString(root: Record<string, unknown>, path: string[]): string | null {
  let current: unknown = root;
  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.length > 0 ? current : null;
}

/**
 * Preserves the source userscript's fallback order (blueprint §3.3): start with the
 * hostname subdomain, then prefer `sap.flp.cf.Config`'s `accountData.tenantId`/
 * `subDomain`, then fall back to `sap.ushellConfig.siteConfig`'s `tenantId`/
 * `identityZoneId`. Never throws on malformed metadata.
 */
export function detectEnvironment(input: DetectEnvironmentInput): EnvironmentExtractionResult {
  const warnings: string[] = [];
  let subdomain = extractSubdomainFromHostname(input.hostname);
  let subaccountId: string | null = null;
  let metadataSource: EnvironmentMetadataSource | null = null;

  const flpConfig = safeParseJsonObject(input.flpCfConfigContent, "sap.flp.cf.Config", warnings);
  if (flpConfig) {
    const tenantId = getNestedString(flpConfig, ["accountData", "tenantId"]);
    const subDomain = getNestedString(flpConfig, ["accountData", "subDomain"]);
    if (tenantId !== null || subDomain !== null) {
      subaccountId = tenantId;
      subdomain = subDomain ?? subdomain;
      metadataSource = "sap.flp.cf.Config";
    }
  }

  if (!metadataSource) {
    const ushellConfig = safeParseJsonObject(
      input.ushellConfigSiteConfigContent,
      "sap.ushellConfig.siteConfig",
      warnings,
    );
    if (ushellConfig) {
      const tenantId = getNestedString(ushellConfig, ["tenantId"]);
      const identityZoneId = getNestedString(ushellConfig, ["identityZoneId"]);
      const resolved = tenantId ?? identityZoneId;
      if (resolved !== null) {
        subaccountId = resolved;
        metadataSource = "sap.ushellConfig.siteConfig";
      }
    }
  }

  return { subdomain, subaccountId, metadataSource, warnings };
}
