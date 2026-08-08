import { validateIncomingPanelMessage } from "../messaging/validation";
import { isUiMessage } from "../messaging/ui-protocol";
import type { WorkzoneCommand } from "../messaging/protocol";
import type { WorkzoneCommandResponse } from "../page-runtime/runtime-types";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Tracks the single reusable workspace tab (mirrors the "focus, don't duplicate" pattern
// used by the floating in-page button). Persisted in chrome.storage.session — not a
// plain module variable — because MV3 service workers are terminated after ~30s of
// inactivity and restart with fresh module state on the next event; an in-memory
// variable would "forget" an already-open workspace tab and start duplicating it.
const WORKSPACE_TAB_STORAGE_KEY = "workspaceTabId";

async function getStoredWorkspaceTabId(): Promise<number | null> {
  const stored = await chrome.storage.session.get(WORKSPACE_TAB_STORAGE_KEY);
  const value = stored[WORKSPACE_TAB_STORAGE_KEY];
  return typeof value === "number" ? value : null;
}

async function setStoredWorkspaceTabId(tabId: number | null): Promise<void> {
  if (tabId === null) {
    await chrome.storage.session.remove(WORKSPACE_TAB_STORAGE_KEY);
  } else {
    await chrome.storage.session.set({ [WORKSPACE_TAB_STORAGE_KEY]: tabId });
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    if ((await getStoredWorkspaceTabId()) === tabId) {
      await setStoredWorkspaceTabId(null);
    }
  })();
});

function workspaceTabUrl(sourceTabId: number | undefined): string {
  const base = chrome.runtime.getURL("sidepanel/index.html");
  return sourceTabId === undefined ? base : `${base}?sourceTabId=${sourceTabId}`;
}

async function openOrFocusWorkspaceTabNow(sourceTabId: number | undefined): Promise<void> {
  const url = workspaceTabUrl(sourceTabId);
  const existingTabId = await getStoredWorkspaceTabId();

  if (existingTabId !== null) {
    try {
      const tab = await chrome.tabs.get(existingTabId);
      if (tab.id === undefined) {
        throw new Error("workspace tab has no id");
      }
      // Re-navigate so the tab is rebound to whichever SAP tab most recently asked
      // for it, even if it was already open and bound to a different one.
      await chrome.tabs.update(tab.id, { active: true, url });
      if (tab.windowId !== undefined) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return;
    } catch {
      // Tab was closed outside of onRemoved's notice (e.g. window closed); fall through.
      await setStoredWorkspaceTabId(null);
    }
  }

  const created = await chrome.tabs.create({ url });
  await setStoredWorkspaceTabId(created.id ?? null);
}

// Serializes concurrent OPEN_WORKSPACE_TAB calls (e.g. a double-click, or two
// different eligible tabs' buttons clicked in quick succession) so each one sees the
// previous call's result before deciding whether to create vs. focus — without this,
// two calls landing before the first chrome.tabs.create() resolves would both see "no
// workspace tab yet" and create two.
let workspaceTabOpQueue: Promise<void> = Promise.resolve();

function openOrFocusWorkspaceTab(sourceTabId: number | undefined): Promise<void> {
  const next = workspaceTabOpQueue.then(
    () => openOrFocusWorkspaceTabNow(sourceTabId),
    () => openOrFocusWorkspaceTabNow(sourceTabId),
  );
  workspaceTabOpQueue = next;
  return next;
}

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

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (isUiMessage(message)) {
    if (message.type === "OPEN_WORKSPACE_TAB") {
      // sender.tab.id is always the tab the content script is running in — this is
      // how we know which SAP tab to bind the workspace tab to, without trusting
      // anything the message payload itself might claim.
      openOrFocusWorkspaceTab(sender.tab?.id)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        });
      return true;
    }
  }

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
