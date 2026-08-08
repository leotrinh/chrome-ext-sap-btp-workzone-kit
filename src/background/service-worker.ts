import { isEligibleWorkzoneUrl, isSupportedRouteHash } from "../integrations/sap-workzone/eligibility";
import { validateIncomingPanelMessage } from "../messaging/validation";
import type { WorkzoneCommand } from "../messaging/protocol";
import type { WorkzoneCommandResponse } from "../page-runtime/runtime-types";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

function notEligibleResponse(message: string): WorkzoneCommandResponse {
  return { ok: false, error: { code: "NOT_SAP_WORKZONE_PAGE", message } };
}

const ACTIVE_TAB_NOT_GRANTED_MESSAGE =
  "Chrome hasn't granted this tab access yet. Click the SAP BTP Workzone Kit toolbar icon " +
  "once on this tab, then retry.";

function activeTabNotGrantedResponse(): WorkzoneCommandResponse {
  return { ok: false, error: { code: "ACTIVE_TAB_NOT_GRANTED", message: ACTIVE_TAB_NOT_GRANTED_MESSAGE } };
}

type ActiveTabCheck =
  | { status: "eligible"; tab: chrome.tabs.Tab & { id: number } }
  | { status: "not_eligible" }
  | { status: "permission_not_granted" };

/**
 * Enforces blueprint §8's gate before any page operation: HTTPS + Work Zone host +
 * a supported admin route, all read from the current active tab only.
 *
 * `activeTab` is only (re-)granted when the user invokes the extension (e.g. clicks
 * the toolbar icon) on the currently active tab. Chrome does not re-grant it just
 * because a docked side panel's active tab changed underneath it — `tab.url` comes
 * back empty in that case, which we treat as a distinct "not granted" outcome so the
 * panel can tell the user what to do, instead of a misleading "not eligible".
 */
async function checkActiveTab(): Promise<ActiveTabCheck> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { status: "not_eligible" };
  }
  if (!tab.url) {
    return { status: "permission_not_granted" };
  }

  let url: URL;
  try {
    url = new URL(tab.url);
  } catch {
    return { status: "not_eligible" };
  }

  if (!isEligibleWorkzoneUrl(url) || !isSupportedRouteHash(url.hash)) {
    return { status: "not_eligible" };
  }

  return { status: "eligible", tab: tab as chrome.tabs.Tab & { id: number } };
}

async function injectPageRuntime(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["page-runtime.js"],
    world: "MAIN",
  });
}

async function runCommandOnActiveTab(
  command: WorkzoneCommand,
  payload: unknown,
): Promise<WorkzoneCommandResponse> {
  const check = await checkActiveTab();
  if (check.status === "permission_not_granted") {
    return activeTabNotGrantedResponse();
  }
  if (check.status === "not_eligible") {
    return notEligibleResponse("Active tab is not an eligible SAP BTP Work Zone admin page.");
  }

  const tabId = check.tab.id;

  try {
    await injectPageRuntime(tabId);

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (cmd: WorkzoneCommand, pl: unknown) => window.__BTP_WORKZONE_KIT__?.handle(cmd, pl),
      args: [command, payload],
    });

    const response = injectionResult?.result as WorkzoneCommandResponse | undefined;
    return (
      response ?? {
        ok: false,
        error: { code: "UNKNOWN", message: "No response from the page runtime." },
      }
    );
  } catch (error) {
    // Chrome throws here (instead of returning empty tab.url) when the *second*
    // executeScript races a permission revocation, or on some Chrome/Edge builds
    // for the same activeTab-vs-side-panel gap `checkActiveTab` already guards.
    const message = error instanceof Error ? error.message : String(error);
    if (/cannot access|no tab with id|permission/i.test(message)) {
      return activeTabNotGrantedResponse();
    }
    return { ok: false, error: { code: "UNKNOWN", message } };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const parsed = validateIncomingPanelMessage(message);
  if (!parsed.ok) {
    sendResponse({ ok: false, error: parsed.error });
    return false;
  }

  runCommandOnActiveTab(parsed.value.command, parsed.value.payload)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: { code: "UNKNOWN", message: error instanceof Error ? error.message : "Unknown error" },
      });
    });
  return true;
});
