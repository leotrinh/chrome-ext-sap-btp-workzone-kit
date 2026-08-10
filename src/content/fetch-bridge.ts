import {
  FETCH_BRIDGE_CHANNEL,
  isFetchBridgeResponseMessage,
  type FetchBridgeRequestInit,
} from "./fetch-bridge-protocol";

const BRIDGE_TIMEOUT_MS = 15000;

export interface BridgedResponse {
  readonly status: number;
  readonly redirected: boolean;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
  clone(): BridgedResponse;
}

function makeBridgedResponse(
  status: number,
  redirected: boolean,
  headers: Record<string, string>,
  bodyText: string,
): BridgedResponse {
  const lowerCaseHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  const response: BridgedResponse = {
    status,
    redirected,
    headers: { get: (name) => lowerCaseHeaders.get(name.toLowerCase()) ?? null },
    text: () => Promise.resolve(bodyText),
    json: async () => JSON.parse(bodyText) as unknown,
    clone: () => response,
  };
  return response;
}

/**
 * Relays a fetch() to the page's MAIN world (main-world-bridge.ts) instead of issuing
 * it directly from this isolated-world content script — see main-world-bridge.ts for
 * why. Callers get back a Response-shaped object (status/redirected/headers.get/
 * text/json/clone) so response-classifier.ts's HttpLikeResponse contract and existing
 * body-parsing code work unchanged.
 */
export function bridgedFetch(url: string, init: FetchBridgeRequestInit): Promise<BridgedResponse> {
  const requestId = crypto.randomUUID();

  return new Promise<BridgedResponse>((resolvePromise, rejectPromise) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      rejectPromise(new Error("Main-world fetch bridge timed out — no response from the page context."));
    }, BRIDGE_TIMEOUT_MS);

    function onMessage(event: MessageEvent): void {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }
      if (!isFetchBridgeResponseMessage(event.data) || event.data.requestId !== requestId) {
        return;
      }
      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      const { result } = event.data;
      if (result.ok) {
        resolvePromise(makeBridgedResponse(result.status, result.redirected, result.headers, result.bodyText));
      } else {
        rejectPromise(new Error(result.errorMessage));
      }
    }

    window.addEventListener("message", onMessage);
    window.postMessage(
      { channel: FETCH_BRIDGE_CHANNEL, type: "request", requestId, url, init },
      window.location.origin,
    );
  });
}
