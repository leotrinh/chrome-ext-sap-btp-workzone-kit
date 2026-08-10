import { GRAPHQL_ENDPOINT } from "./constants";
import { fetchCsrfToken } from "./csrf";
import {
  classifyGraphQlBody,
  classifyHttpResponseError,
  extractGraphQlErrorMessage,
} from "./response-classifier";
import type { WorkzoneRequestError } from "../../shared/errors";

export type GraphQlResult<T> = { ok: true; data: T } | { ok: false; error: WorkzoneRequestError };

export interface GraphQlRequest {
  query: string;
  variables: Record<string, unknown>;
}

// In-memory only, scoped to this content script's lifetime — never persisted, never
// sent to the React UI. Reset happens implicitly on page navigation (fresh module
// instance) or explicitly via resetCsrfCache() after a CSRF_REJECTED response.
let cachedCsrfToken: string | null = null;

export function resetCsrfCache(): void {
  cachedCsrfToken = null;
}

/**
 * Shared by the GraphQL client and the HTML5 refresh endpoint — exported so other
 * same-origin POSTs don't fetch/cache a second, redundant token.
 *
 * ASSUMPTION, NOT CONFIRMED: this assumes a CSRF token fetched from
 * `HEAD /semantic/graphql` is also valid for `POST /semantic/entity/provider/html5`
 * (i.e. the token is session-scoped, not endpoint-scoped — a common SAP/OData
 * convention, but not something this repo has verified against a real tenant). If
 * that assumption is wrong, HTML5 refresh would see CSRF_REJECTED on every call even
 * with a fresh token from this endpoint. See docs/compatibility.md.
 */
export async function acquireCsrfToken(
  forceRefresh: boolean,
): Promise<{ ok: true; token: string } | { ok: false; error: WorkzoneRequestError }> {
  if (cachedCsrfToken && !forceRefresh) {
    return { ok: true, token: cachedCsrfToken };
  }
  const result = await fetchCsrfToken();
  if (!result.ok) {
    return result;
  }
  cachedCsrfToken = result.token;
  return { ok: true, token: result.token };
}

type PostResult<T> = GraphQlResult<T> | { retryWithFreshCsrf: true };

function extractOperationName(query: string): string {
  const match = /\b(query|mutation)\s+(\w+)/.exec(query);
  return match ? `${match[1]} ${match[2]}` : "unknown operation";
}

async function postGraphQl<T>(request: GraphQlRequest, token: string): Promise<PostResult<T>> {
  let response: Response;
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
      // See csrf.ts's fetchCsrfToken() for why this is "include" rather than
      // "same-origin".
      credentials: "include",
      body: JSON.stringify(request),
    });
  } catch {
    return {
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Network error during the GraphQL request." },
    };
  }

  const httpError = classifyHttpResponseError(response);
  if (httpError) {
    // Debug aid, not sensitive: the operation name and URL are static, status is not
    // sensitive, and the body here is SAP's own server-side error text — never logs
    // `request.variables` (batchProcess's variables carry the app's CDM) or the
    // X-CSRF-Token header itself.
    const bodyText = await response
      .clone()
      .text()
      .catch(() => "<unreadable body>");
    console.error(
      `[BTP Workzone Kit] POST ${GRAPHQL_ENDPOINT} (${extractOperationName(request.query)}) -> ${response.status}. Body: ${bodyText || "<empty>"}`,
    );
  }
  if (httpError?.code === "CSRF_REJECTED") {
    return { retryWithFreshCsrf: true };
  }
  // AUTHENTICATION_REQUIRED (redirect/401) and AUTHORIZATION_DENIED (real 403) are
  // structural failures — SAP won't have sent a meaningful GraphQL body, fail fast.
  // Any other non-2xx status (generic HTTP_ERROR, e.g. 400/500) still gets checked for
  // a GraphQL error body below before giving up on it: SAP's GraphQL endpoint can
  // attach a non-2xx HTTP status to an ordinary GraphQL error response, and the
  // proven-working reference userscript (hand-off/update-ui-version-script.js)
  // never gates on HTTP status for GraphQL calls at all — it unconditionally parses
  // the JSON body and only inspects `errors`. Short-circuiting on HTTP_ERROR here (as
  // this code used to) discarded that body and replaced a real, actionable GraphQL
  // error message with an opaque "SAP returned HTTP {status}.".
  if (httpError?.code === "AUTHENTICATION_REQUIRED" || httpError?.code === "AUTHORIZATION_DENIED") {
    return { ok: false, error: httpError };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (httpError) {
      return { ok: false, error: httpError };
    }
    return {
      ok: false,
      error: { code: "INVALID_RESPONSE", message: "GraphQL response body was not valid JSON." },
    };
  }

  const graphQlErrorCode = classifyGraphQlBody(body);
  if (graphQlErrorCode) {
    return { ok: false, error: { code: graphQlErrorCode, message: extractGraphQlErrorMessage(body) } };
  }

  if (httpError) {
    return { ok: false, error: httpError };
  }

  if (body === null || typeof body !== "object" || !("data" in body)) {
    return {
      ok: false,
      error: { code: "INVALID_RESPONSE", message: "GraphQL response body is missing 'data'." },
    };
  }

  return { ok: true, data: (body as { data: T }).data };
}

/**
 * Fixed, same-origin GraphQL client (blueprint §11). Acquires and caches a CSRF token,
 * retrying exactly once with a freshly-fetched token if SAP rejects it
 * (`x-csrf-token: Required`) — never more than once, to avoid looping against a
 * genuinely expired session.
 */
export async function executeGraphQlRequest<T>(request: GraphQlRequest): Promise<GraphQlResult<T>> {
  const tokenResult = await acquireCsrfToken(false);
  if (!tokenResult.ok) {
    return tokenResult;
  }

  const first = await postGraphQl<T>(request, tokenResult.token);
  if (!("retryWithFreshCsrf" in first)) {
    return first;
  }

  const refreshed = await acquireCsrfToken(true);
  if (!refreshed.ok) {
    return refreshed;
  }

  const second = await postGraphQl<T>(request, refreshed.token);
  if ("retryWithFreshCsrf" in second) {
    return {
      ok: false,
      error: { code: "CSRF_REJECTED", message: "SAP rejected the CSRF token twice in a row." },
    };
  }
  return second;
}
