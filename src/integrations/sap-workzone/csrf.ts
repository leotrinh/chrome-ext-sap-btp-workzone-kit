import { GRAPHQL_ENDPOINT } from "./constants";
import { classifyHttpResponseError } from "./response-classifier";
import { bridgedFetch, type BridgedResponse } from "../../content/fetch-bridge";
import type { WorkzoneRequestError } from "../../shared/errors";

export type CsrfResult = { ok: true; token: string } | { ok: false; error: WorkzoneRequestError };

// Preserves the source userscript's exact contract (blueprint §3.4): HEAD
// /semantic/graphql with x-csrf-token: Fetch.
const CSRF_FETCH_METHOD = "HEAD";

const CSRF_SENTINEL_VALUES = new Set(["fetch", "required"]);

/**
 * Blueprint §3.4's CSRF pre-flight: fetch /semantic/graphql with x-csrf-token: Fetch,
 * read the token back from the response header. Never persisted anywhere outside this
 * module's runtime memory — see graphql-client.ts's in-memory cache, which is the only
 * place this result is kept.
 *
 * Confirmed against a real tenant (DevTools capture of the reference Tampermonkey
 * script, which returns `res.headers.get('x-csrf-token')` completely unconditionally,
 * never checking `res.ok`/status): SAP returns HTTP 400 for this HEAD request, but the
 * response STILL carries a valid, usable x-csrf-token header — the very token the next
 * request succeeds with. Checking HTTP status before reading the header (as this code
 * used to, matching the blueprint's documented client contract in section 11 — "validate
 * HTTP status" — which turned out not to hold for this specific endpoint) discarded a
 * token that was right there. So this reads the header FIRST, unconditionally, exactly
 * like the reference script, and only falls back to status-based error classification
 * when no usable token is present.
 *
 * Issued via bridgedFetch() (MAIN-world execution, see fetch-bridge.ts /
 * main-world-bridge.ts) so this request is indistinguishable from one issued by a
 * genuine page script.
 */
export async function fetchCsrfToken(): Promise<CsrfResult> {
  let response: BridgedResponse;
  try {
    response = await bridgedFetch(GRAPHQL_ENDPOINT, {
      method: CSRF_FETCH_METHOD,
      headers: { "x-csrf-token": "Fetch" },
      credentials: "include",
    });
  } catch {
    return {
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network error while fetching the CSRF token." },
    };
  }

  const token = response.headers.get("x-csrf-token");
  if (token && !CSRF_SENTINEL_VALUES.has(token.toLowerCase())) {
    return { ok: true, token };
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
      `[BTP Workzone Kit] ${CSRF_FETCH_METHOD} ${GRAPHQL_ENDPOINT} -> ${response.status}. Body: ${bodyText || "<empty>"}`,
    );
    return { ok: false, error: classified };
  }

  return {
    ok: false,
    error: { code: "CSRF_MISSING", message: "SAP response did not include an x-csrf-token header." },
  };
}
