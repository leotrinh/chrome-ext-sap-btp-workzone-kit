import {
  FETCH_BRIDGE_CHANNEL,
  isFetchBridgeRequestMessage,
  type FetchBridgeRequestMessage,
  type FetchBridgeResult,
} from "./fetch-bridge-protocol";

/**
 * Declared in manifest.json with "world": "MAIN" — runs in the page's own JS realm,
 * not the extension's isolated world. Every fetch() issued here is indistinguishable
 * from one issued by the page's own inline script (same execution context the proven
 * Tampermonkey reference script ran in), unlike a fetch() from the isolated-world
 * content script, which SAP's `/semantic/graphql` CSRF endpoint rejected with an
 * HTTP 400 for reasons never fully explained (URL, method, headers, and credentials
 * mode were all confirmed identical between the two). This bridge sidesteps that
 * question entirely by matching the reference script's execution context exactly.
 */
/** Exported (not just a private listener body) so it's directly unit-testable without going through window.postMessage's real cross-realm plumbing, which test DOM environments (jsdom) don't faithfully emulate for same-window delivery. */
export async function handleFetchBridgeRequest(message: FetchBridgeRequestMessage): Promise<FetchBridgeResult> {
  try {
    const response = await fetch(message.url, {
      method: message.init.method,
      headers: message.init.headers,
      credentials: message.init.credentials,
      body: message.init.body,
    });
    const bodyText = await response.text().catch(() => "");
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { ok: true, status: response.status, redirected: response.redirected, headers, bodyText };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Fetch failed." };
  }
}

export function initMainWorldFetchBridge(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }
    if (!isFetchBridgeRequestMessage(event.data)) {
      return;
    }
    void handleFetchBridgeRequest(event.data).then((result) => {
      window.postMessage(
        { channel: FETCH_BRIDGE_CHANNEL, type: "response", requestId: event.data.requestId, result },
        window.location.origin,
      );
    });
  });
}

initMainWorldFetchBridge();
