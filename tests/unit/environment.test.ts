import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectEnvironment } from "../../src/integrations/sap-workzone/environment";

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "tests/fixtures/workzone-pages", name), "utf-8");
}

const HOSTNAME = "acme.dt.eu10.hana.ondemand.com";

describe("detectEnvironment()", () => {
  it("prefers accountData.tenantId/subDomain from sap.flp.cf.Config", () => {
    const result = detectEnvironment({
      hostname: HOSTNAME,
      flpCfConfigContent: fixture("flp-cf-config-full.json"),
      ushellConfigSiteConfigContent: null,
    });

    expect(result.subaccountId).toBe("8f14e45f-tenant-acme");
    expect(result.subdomain).toBe("acme-prod");
    expect(result.metadataSource).toBe("sap.flp.cf.Config");
    expect(result.warnings).toEqual([]);
  });

  it("falls back to sap.ushellConfig.siteConfig tenantId/identityZoneId when flp config is absent", () => {
    const result = detectEnvironment({
      hostname: HOSTNAME,
      flpCfConfigContent: null,
      ushellConfigSiteConfigContent: fixture("ushell-config-fallback.json"),
    });

    expect(result.subaccountId).toBe("fallback-tenant-id");
    expect(result.metadataSource).toBe("sap.ushellConfig.siteConfig");
    expect(result.warnings).toEqual([]);
  });

  it("falls back to identityZoneId when tenantId is absent in ushellConfig", () => {
    const result = detectEnvironment({
      hostname: HOSTNAME,
      flpCfConfigContent: null,
      ushellConfigSiteConfigContent: JSON.stringify({ identityZoneId: "zone-only" }),
    });

    expect(result.subaccountId).toBe("zone-only");
  });

  it("always derives subdomain from hostname as the baseline before metadata overrides it", () => {
    const result = detectEnvironment({
      hostname: HOSTNAME,
      flpCfConfigContent: null,
      ushellConfigSiteConfigContent: null,
    });

    expect(result.subdomain).toBe("acme");
    expect(result.metadataSource).toBeNull();
  });

  it("never throws on malformed metadata JSON and records a warning", () => {
    expect(() =>
      detectEnvironment({
        hostname: HOSTNAME,
        flpCfConfigContent: fixture("malformed.txt"),
        ushellConfigSiteConfigContent: null,
      }),
    ).not.toThrow();

    const result = detectEnvironment({
      hostname: HOSTNAME,
      flpCfConfigContent: fixture("malformed.txt"),
      ushellConfigSiteConfigContent: null,
    });

    expect(result.subdomain).toBe("acme");
    expect(result.subaccountId).toBeNull();
    expect(result.warnings.some((w) => w.includes("sap.flp.cf.Config"))).toBe(true);
  });

  it("falls through to hostname-only when metadata is valid JSON but has none of the expected fields", () => {
    const result = detectEnvironment({
      hostname: HOSTNAME,
      flpCfConfigContent: fixture("empty-object.json"),
      ushellConfigSiteConfigContent: null,
    });

    expect(result.subaccountId).toBeNull();
    expect(result.metadataSource).toBeNull();
  });

  it("tries flp.cf.Config before ushellConfig.siteConfig when both are present", () => {
    const result = detectEnvironment({
      hostname: HOSTNAME,
      flpCfConfigContent: fixture("flp-cf-config-full.json"),
      ushellConfigSiteConfigContent: fixture("ushell-config-fallback.json"),
    });

    expect(result.metadataSource).toBe("sap.flp.cf.Config");
    expect(result.subaccountId).toBe("8f14e45f-tenant-acme");
  });
});
