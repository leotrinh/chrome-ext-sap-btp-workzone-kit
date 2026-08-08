import { describe, expect, it } from "vitest";
import {
  isSapWorkzoneHost,
  isEligibleWorkzoneUrl,
  isEligibleWorkzonePage,
  isSupportedRouteHash,
  VALID_WORKZONE_HASH_SEGMENTS,
} from "../../src/integrations/sap-workzone/eligibility";

describe("isSapWorkzoneHost()", () => {
  const cases: Array<{ hostname: string; expected: boolean; label: string }> = [
    { hostname: "abc123.dt.eu10.hana.ondemand.com", expected: true, label: "valid host" },
    { hostname: "ABC123.DT.EU10.HANA.ONDEMAND.COM", expected: true, label: "uppercase" },
    {
      hostname: "abc123.dt.eu10.hana.ondemand.com.",
      expected: true,
      label: "trailing dot",
    },
    {
      hostname: "abc123.eu10.hana.ondemand.com",
      expected: false,
      label: "no .dt. segment",
    },
    {
      hostname: "hana.ondemand.com.attacker.example",
      expected: false,
      label: "malicious suffix",
    },
    { hostname: "fakehana.ondemand.com", expected: false, label: "lookalike domain" },
    {
      hostname: "sap.dt.hana.ondemand.com.evil.test",
      expected: false,
      label: "malicious suffix after real host",
    },
    { hostname: "example.com", expected: false, label: "unrelated domain" },
  ];

  it.each(cases)("hostname=$hostname -> $expected ($label)", ({ hostname, expected }) => {
    expect(isSapWorkzoneHost(hostname)).toBe(expected);
  });
});

describe("isEligibleWorkzoneUrl()", () => {
  const validHost = "abc123.dt.eu10.hana.ondemand.com";

  it("accepts https + valid host", () => {
    expect(isEligibleWorkzoneUrl(new URL(`https://${validHost}/`))).toBe(true);
  });

  it("rejects http even on a valid host", () => {
    expect(isEligibleWorkzoneUrl(new URL(`http://${validHost}/`))).toBe(false);
  });

  it("rejects a valid protocol on an invalid host", () => {
    expect(isEligibleWorkzoneUrl(new URL("https://example.com/"))).toBe(false);
  });
});

describe("isSupportedRouteHash()", () => {
  it.each(VALID_WORKZONE_HASH_SEGMENTS)("accepts hash containing %s", (segment) => {
    expect(isSupportedRouteHash(`#${segment}-someId&/detail`)).toBe(true);
  });

  it("rejects an unsupported hash", () => {
    expect(isSupportedRouteHash("#Some-Other-Route")).toBe(false);
  });

  it("rejects an empty hash", () => {
    expect(isSupportedRouteHash("")).toBe(false);
  });
});

describe("isEligibleWorkzonePage()", () => {
  const validHost = "abc123.dt.eu10.hana.ondemand.com";

  it("accepts https + valid host + supported route", () => {
    const url = new URL(`https://${validHost}/#Content-Manage-someId&/detail`);
    expect(isEligibleWorkzonePage(url)).toBe(true);
  });

  it("rejects a valid host/protocol with an unsupported route", () => {
    const url = new URL(`https://${validHost}/#Some-Other-Route`);
    expect(isEligibleWorkzonePage(url)).toBe(false);
  });

  it("rejects a valid host/route over http", () => {
    const url = new URL(`http://${validHost}/#Content-Manage-someId`);
    expect(isEligibleWorkzonePage(url)).toBe(false);
  });

  it("rejects a supported route on an invalid host", () => {
    const url = new URL("https://example.com/#Content-Manage-someId");
    expect(isEligibleWorkzonePage(url)).toBe(false);
  });
});
