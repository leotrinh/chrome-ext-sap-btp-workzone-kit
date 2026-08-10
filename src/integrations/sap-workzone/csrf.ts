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
      credentials: "same-origin",
    });
  } catch {
    return {
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network error while fetching the CSRF token." },
    };
  }

  const classified = classifyHttpResponseError(response);
  if (classified) {
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
