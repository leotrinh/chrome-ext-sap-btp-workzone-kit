export type WorkzoneRequestErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_DENIED"
  | "CSRF_MISSING"
  | "CSRF_REJECTED"
  | "HTTP_ERROR"
  | "GRAPHQL_ERROR"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR"
  | "PAGE_CHANGED"
  | "UNKNOWN";

export interface WorkzoneRequestError {
  code: WorkzoneRequestErrorCode;
  message: string;
}
