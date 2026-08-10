export const FETCH_BRIDGE_CHANNEL = "btp-workzone-kit:fetch-bridge";

export interface FetchBridgeRequestInit {
  method: string;
  headers: Record<string, string>;
  credentials?: "omit" | "same-origin" | "include";
  body?: string;
}

export interface FetchBridgeRequestMessage {
  channel: typeof FETCH_BRIDGE_CHANNEL;
  type: "request";
  requestId: string;
  url: string;
  init: FetchBridgeRequestInit;
}

export type FetchBridgeResult =
  | { ok: true; status: number; redirected: boolean; headers: Record<string, string>; bodyText: string }
  | { ok: false; errorMessage: string };

export interface FetchBridgeResponseMessage {
  channel: typeof FETCH_BRIDGE_CHANNEL;
  type: "response";
  requestId: string;
  result: FetchBridgeResult;
}

export function isFetchBridgeRequestMessage(data: unknown): data is FetchBridgeRequestMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    candidate.channel === FETCH_BRIDGE_CHANNEL &&
    candidate.type === "request" &&
    typeof candidate.requestId === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.init === "object" &&
    candidate.init !== null
  );
}

export function isFetchBridgeResponseMessage(data: unknown): data is FetchBridgeResponseMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    candidate.channel === FETCH_BRIDGE_CHANNEL &&
    candidate.type === "response" &&
    typeof candidate.requestId === "string" &&
    typeof candidate.result === "object" &&
    candidate.result !== null
  );
}
