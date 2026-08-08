import { VALID_WORKZONE_HASH_SEGMENTS } from "./constants";

export { VALID_WORKZONE_HASH_SEGMENTS };

/**
 * Real SAP BTP Work Zone tenants are served from `<subdomain>.dt.<region>.hana.ondemand.com`.
 * Reject anything that merely contains that string as a suffix/prefix trick
 * (e.g. `hana.ondemand.com.attacker.example`) by requiring an exact suffix match.
 */
export function isSapWorkzoneHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host.endsWith(".hana.ondemand.com") && host.includes(".dt.");
}

export function isEligibleWorkzoneUrl(url: URL): boolean {
  return url.protocol === "https:" && isSapWorkzoneHost(url.hostname);
}

export function isSupportedRouteHash(hash: string): boolean {
  if (!hash) {
    return false;
  }
  return VALID_WORKZONE_HASH_SEGMENTS.some((segment) => hash.includes(segment));
}

export function matchedRouteSegment(hash: string): (typeof VALID_WORKZONE_HASH_SEGMENTS)[number] | null {
  return VALID_WORKZONE_HASH_SEGMENTS.find((segment) => hash.includes(segment)) ?? null;
}

/**
 * Full gate for "should the extension surface itself on this page at all" — HTTPS +
 * Work Zone host + a supported admin route. Shared by the service worker's tab check
 * and the content-script floating button so the two can never disagree.
 */
export function isEligibleWorkzonePage(url: URL): boolean {
  return isEligibleWorkzoneUrl(url) && isSupportedRouteHash(url.hash);
}
