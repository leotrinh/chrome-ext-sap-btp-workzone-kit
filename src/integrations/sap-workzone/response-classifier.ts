import type { WorkzoneRequestError } from "../../shared/errors";

export interface HttpLikeResponse {
  status: number;
  redirected: boolean;
  headers: { get(name: string): string | null };
}

/**
 * Classifies a fetch Response (or a same-shaped test double) into a
 * WorkzoneRequestError, or null when it's a plain success. A redirect on a relative
 * `/semantic/graphql` POST/HEAD almost always means the SAP session expired and the
 * browser was bounced to a login page — treated as AUTHENTICATION_REQUIRED regardless
 * of the final status code. A 403 carrying `x-csrf-token: Required` is SAP/OData's
 * standard signal that the token is stale (distinct from a real authorization denial).
 */
export function classifyHttpResponseError(response: HttpLikeResponse): WorkzoneRequestError | null {
  if (response.redirected) {
    return {
      code: "AUTHENTICATION_REQUIRED",
      message: "Request was redirected — the SAP session has likely expired.",
    };
  }

  const { status } = response;
  if (status >= 200 && status < 300) {
    return null;
  }
  if (status === 401) {
    return { code: "AUTHENTICATION_REQUIRED", message: "SAP returned 401 Unauthorized." };
  }
  if (status === 403) {
    const csrfHeader = response.headers.get("x-csrf-token");
    if (csrfHeader?.toLowerCase() === "required") {
      return { code: "CSRF_REJECTED", message: "SAP rejected the CSRF token (x-csrf-token: Required)." };
    }
    return { code: "AUTHORIZATION_DENIED", message: "SAP returned 403 Forbidden." };
  }
  return { code: "HTTP_ERROR", message: `SAP returned HTTP ${status}.` };
}

interface GraphQlErrorBody {
  errors: Array<{ message?: unknown }>;
}

function isGraphQlErrorBody(body: unknown): body is GraphQlErrorBody {
  return (
    body !== null &&
    typeof body === "object" &&
    Array.isArray((body as { errors?: unknown }).errors) &&
    (body as GraphQlErrorBody).errors.length > 0
  );
}

export function classifyGraphQlBody(body: unknown): "GRAPHQL_ERROR" | null {
  return isGraphQlErrorBody(body) ? "GRAPHQL_ERROR" : null;
}

export function extractGraphQlErrorMessage(body: unknown): string {
  if (isGraphQlErrorBody(body)) {
    const first = body.errors[0];
    if (typeof first?.message === "string" && first.message.length > 0) {
      return first.message;
    }
  }
  return "GraphQL request returned errors.";
}
