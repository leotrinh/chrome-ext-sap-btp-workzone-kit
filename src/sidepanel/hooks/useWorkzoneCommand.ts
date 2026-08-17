import type { WorkzoneCommand } from "../../messaging/protocol";
import type { WorkzoneCommandResponse } from "../../page-runtime/runtime-types";
import { getTargetTabIdFromLocationSearch } from "../workspace-context";

/**
 * The only way the side panel talks to SAP: a fixed command name plus a
 * schema-validated payload, relayed through the service worker. Never a raw URL,
 * GraphQL document, or script.
 *
 * `?sourceTabId=` (see `workspace-context.ts`) is vestigial from a since-removed
 * separate-tab flow — no current caller sets it, so this always resolves to
 * `undefined` and the service worker falls back to "whatever tab is active", which is
 * correct both for the docked panel and for the in-page overlay iframe (the overlay
 * runs inside the SAP tab it targets, so that tab genuinely is the active one).
 */
export function sendWorkzoneCommand<T = unknown>(
  command: WorkzoneCommand,
  payload?: unknown,
): Promise<WorkzoneCommandResponse<T>> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return Promise.resolve({
      ok: false,
      error: { code: "NO_EXTENSION_RUNTIME", message: "Not running inside the extension host." },
    });
  }

  const targetTabId = getTargetTabIdFromLocationSearch(window.location.search);

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ command, payload, targetTabId }, (response: WorkzoneCommandResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: {
            code: "MESSAGING_ERROR",
            message: chrome.runtime.lastError.message ?? "Unknown messaging error",
          },
        });
        return;
      }
      resolve(response);
    });
  });
}
