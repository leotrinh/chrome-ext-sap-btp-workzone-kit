import { isEligibleWorkzonePage } from "../integrations/sap-workzone/eligibility";
import { parseCommandRequest } from "../messaging/protocol";
import { handleCommand } from "../page-runtime/command-handler";
import type { WorkzoneCommandResponse } from "../page-runtime/runtime-types";

function notEligibleResponse(): WorkzoneCommandResponse {
  return {
    ok: false,
    error: {
      code: "NOT_SAP_WORKZONE_PAGE",
      message: "This page is not an eligible SAP BTP Work Zone admin page.",
    },
  };
}

/**
 * Handles WorkzoneCommand messages the service worker relays here via
 * `chrome.tabs.sendMessage`. Runs entirely in this content script's isolated JS
 * world — no MAIN-world injection needed. `fetch()` from an isolated-world content
 * script already carries the page's own session cookies for same-origin requests,
 * exactly like a MAIN-world script would; the only thing MAIN-world access would add
 * is touching the page's own JS globals, which nothing here needs.
 *
 * This content script is declared in the manifest and auto-injected by Chrome without
 * needing `activeTab` or `host_permissions` — unlike `chrome.scripting.executeScript`,
 * which is what the previous (broken) architecture relied on and could never actually
 * get permission for from a content-script-initiated flow.
 */
export function initCommandRelay(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const parsed = parseCommandRequest(message);
    if (!parsed.ok) {
      // Not a WorkzoneCommand-shaped message — ignore it and let the intended
      // recipient handle it.
      return false;
    }

    if (!isEligibleWorkzonePage(new URL(window.location.href))) {
      sendResponse(notEligibleResponse());
      return false;
    }

    handleCommand(parsed.value.command, parsed.value.payload).then(sendResponse);
    return true;
  });
}
