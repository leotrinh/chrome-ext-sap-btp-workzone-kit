import { validateIncomingPanelMessage } from "../messaging/validation";
import type { WorkzoneCommand } from "../messaging/protocol";
import type { WorkzoneCommandResponse } from "../page-runtime/runtime-types";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

function notEligibleResponse(message: string): WorkzoneCommandResponse {
  return { ok: false, error: { code: "NOT_SAP_WORKZONE_PAGE", message } };
}

type ResolvedTab =
  | { status: "resolved"; tabId: number }
  | { status: "no_target_tab" }
  | { status: "target_tab_closed" };

/**
 * Only resolves *which tab id* to message — deliberately never reads `tab.url`, which
 * would require `activeTab` (gesture-gated; a content-script-rendered button click
 * does not count as the required gesture) or static `host_permissions` (which this
 * extension does not declare). Host/route eligibility is enforced downstream by the
 * content script itself once the message reaches it — it has full, unredacted access
 * to its own page's location, no permission needed for that.
 *
 * `targetTabId` is currently always `undefined` in practice: it existed to bind a
 * separate workspace *tab* back to the SAP tab that opened it (via `?sourceTabId=`,
 * `src/sidepanel/workspace-context.ts`), a flow removed in favor of an in-page overlay
 * (`src/content/workzone-overlay.ts`) that already runs inside the SAP tab itself, so
 * "active tab" resolution is correct without it. Left in place — narrowing the wire
 * protocol touches ~30 unrelated tests for no behavior change — but no current caller
 * sets it.
 */
async function resolveTargetTabId(targetTabId: number | undefined): Promise<ResolvedTab> {
  if (targetTabId !== undefined) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      return tab.id === undefined ? { status: "no_target_tab" } : { status: "resolved", tabId: tab.id };
    } catch {
      return { status: "target_tab_closed" };
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id === undefined ? { status: "no_target_tab" } : { status: "resolved", tabId: tab.id };
}

/**
 * Relays the command to the content script already running in that tab — declared in
 * the manifest and auto-injected by Chrome, no `activeTab`/`host_permissions` needed
 * for that. If nothing answers, the tab either isn't a hana.ondemand.com page at all,
 * or hasn't finished loading one yet.
 */
function relayCommandToContentScript(
  tabId: number,
  command: WorkzoneCommand,
  payload: unknown,
): Promise<WorkzoneCommandResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { command, payload }, (response: WorkzoneCommandResponse | undefined) => {
      if (chrome.runtime.lastError) {
        resolve(
          notEligibleResponse(
            "No SAP BTP Workzone Kit content script is running on that tab — it's probably " +
              "not a hana.ondemand.com page, or it hasn't finished loading yet.",
          ),
        );
        return;
      }
      resolve(
        response ?? {
          ok: false,
          error: { code: "UNKNOWN", message: "No response from the content script." },
        },
      );
    });
  });
}

async function runCommandOnActiveTab(
  command: WorkzoneCommand,
  payload: unknown,
  targetTabId: number | undefined,
): Promise<WorkzoneCommandResponse> {
  const resolved = await resolveTargetTabId(targetTabId);
  // Unreachable with today's only two callers (docked panel, in-page overlay) — both
  // always pass targetTabId=undefined, so resolveTargetTabId() never returns this
  // status. Kept for the vestigial explicit-targetTabId path (see its docstring above).
  if (resolved.status === "target_tab_closed") {
    return {
      ok: false,
      error: {
        code: "TARGET_TAB_CLOSED",
        message:
          "The SAP Work Zone tab this window was opened from is no longer open. Close this " +
          "tab and click the ⚡ button again from an open Work Zone tab.",
      },
    };
  }
  if (resolved.status === "no_target_tab") {
    return notEligibleResponse("No active tab found.");
  }

  return relayCommandToContentScript(resolved.tabId, command, payload);
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const parsed = validateIncomingPanelMessage(message);
  if (!parsed.ok) {
    sendResponse({ ok: false, error: parsed.error });
    return false;
  }

  runCommandOnActiveTab(parsed.value.command, parsed.value.payload, parsed.value.targetTabId)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: { code: "UNKNOWN", message: error instanceof Error ? error.message : "Unknown error" },
      });
    });
  return true;
});
