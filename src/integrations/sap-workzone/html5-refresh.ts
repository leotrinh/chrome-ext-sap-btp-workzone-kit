import {
  HTML5_ENDPOINT,
  HTML5_PROVIDER_ID,
  HTML5_CONTENT_ADDITION_MODE,
} from "./constants";
import { acquireCsrfToken } from "./graphql-client";
import { classifyHttpResponseError } from "./response-classifier";
import { bridgedFetch, type BridgedResponse } from "../../content/fetch-bridge";
import type { WorkzoneRequestErrorCode } from "../../shared/errors";

export type Html5RefreshStatus =
  | "triggered"
  | "authentication_required"
  | "authorization_denied"
  | "csrf_error"
  | "server_error"
  | "invalid_response"
  | "network_error";

export interface Html5RefreshResult {
  status: Html5RefreshStatus;
  message?: string;
}

function mapErrorCodeToStatus(code: WorkzoneRequestErrorCode): Html5RefreshStatus {
  switch (code) {
    case "AUTHENTICATION_REQUIRED":
      return "authentication_required";
    case "AUTHORIZATION_DENIED":
      return "authorization_denied";
    case "CSRF_REJECTED":
    case "CSRF_MISSING":
      return "csrf_error";
    case "NETWORK_ERROR":
      return "network_error";
    case "INVALID_RESPONSE":
      return "invalid_response";
    default:
      return "server_error";
  }
}

type PostResult = Html5RefreshResult | { retryWithFreshCsrf: true };

async function postHtml5Refresh(token: string, subdomain: string, subaccountId: string): Promise<PostResult> {
  let response: BridgedResponse;
  try {
    // See csrf.ts's fetchCsrfToken() for why this goes through bridgedFetch()
    // (MAIN-world execution) rather than this content script's own fetch().
    response = await bridgedFetch(HTML5_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
      credentials: "include",
      body: JSON.stringify({
        providerId: HTML5_PROVIDER_ID,
        contentAdditionMode: HTML5_CONTENT_ADDITION_MODE,
        subdomain,
        subaccountId,
      }),
    });
  } catch {
    return { status: "network_error", message: "Network error while refreshing HTML5 content." };
  }

  const httpError = classifyHttpResponseError(response);
  if (httpError?.code === "CSRF_REJECTED") {
    return { retryWithFreshCsrf: true };
  }
  if (httpError) {
    return { status: mapErrorCodeToStatus(httpError.code), message: httpError.message };
  }

  return { status: "triggered" };
}

/**
 * Blueprint §3.10/§21 — same fixed payload as the working source userscript. Requires
 * explicit user confirmation upstream (this function itself performs no gating); never
 * auto-triggered after a UI5 bulk update (blueprint's explicit non-goal).
 */
export async function refreshHtml5Content(subdomain: string, subaccountId: string): Promise<Html5RefreshResult> {
  const tokenResult = await acquireCsrfToken(false);
  if (!tokenResult.ok) {
    return { status: mapErrorCodeToStatus(tokenResult.error.code), message: tokenResult.error.message };
  }

  const first = await postHtml5Refresh(tokenResult.token, subdomain, subaccountId);
  if (!("retryWithFreshCsrf" in first)) {
    return first;
  }

  const refreshed = await acquireCsrfToken(true);
  if (!refreshed.ok) {
    return { status: mapErrorCodeToStatus(refreshed.error.code), message: refreshed.error.message };
  }

  const second = await postHtml5Refresh(refreshed.token, subdomain, subaccountId);
  if ("retryWithFreshCsrf" in second) {
    return { status: "csrf_error", message: "SAP rejected the CSRF token twice in a row." };
  }
  return second;
}
