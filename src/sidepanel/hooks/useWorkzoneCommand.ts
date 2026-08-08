import type { WorkzoneCommand } from "../../messaging/protocol";
import type { WorkzoneCommandResponse } from "../../page-runtime/runtime-types";

/**
 * The only way the side panel talks to SAP: a fixed command name plus a
 * schema-validated payload, relayed through the service worker. Never a raw URL,
 * GraphQL document, or script.
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

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ command, payload }, (response: WorkzoneCommandResponse<T>) => {
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
