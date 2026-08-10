import { GRAPHQL_ENDPOINT } from "./constants";
import { classifyHttpResponseError } from "./response-classifier";
import type { WorkzoneRequestError } from "../../shared/errors";

export type CsrfResult = { ok: true; token: string } | { ok: false; error: WorkzoneRequestError };

/**
 * Preserves the source userscript's contract (blueprint §3.4): HEAD /semantic/graphql
 * with x-csrf-token: Fetch, read the token back from the response header. Never
 * persisted anywhere outside this module's runtime memory — see graphql-client.ts's
 * in-memory cache, which is the only place this result is kept.
 */
export async function fetchCsrfToken(): Promise<CsrfResult> {
  let response: Response;
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: "HEAD",
      headers: { "x-csrf-token": "Fetch" },
      // "include" rather than "same-origin": a real page-script request to this exact
      // relative URL was observed sending "include" (captured via DevTools against a
      // live tenant). A content script's fetch() can compute same-origin-ness
      // differently than a genuine page script even for a nominally same-origin
      // relative URL, so "include" removes that ambiguity — this endpoint is always
      // same-host (relative URL), so it never sends cookies cross-origin either way.
      credentials: "include",
    });
  } catch {
    return {
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network error while fetching the CSRF token." },
    };
  }

  const classified = classifyHttpResponseError(response);
  if (classified) {
    // Debug aid, not sensitive: method/URL are static constants, status is not
    // sensitive, and the body here is SAP's own server-side error text — never a
    // token or CDM. Never logs the X-CSRF-Token header itself.
    const bodyText = await response
      .clone()
      .text()
      .catch(() => "<unreadable body>");
    console.error(
      `[BTP Workzone Kit] HEAD ${GRAPHQL_ENDPOINT} -> ${response.status}. Body: ${bodyText || "<empty>"}`,
    );
    return { ok: false, error: classified };
  }

  const token = response.headers.get("x-csrf-token");
  if (!token) {
    return {
      ok: false,
      error: { code: "CSRF_MISSING", message: "SAP response did not include an x-csrf-token header." },
    };
  }

  return { ok: true, token };
}
