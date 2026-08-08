import { isEligibleWorkzonePage } from "../integrations/sap-workzone/eligibility";

const HOST_ID = "btp-workzone-kit-fab-host";
const CHECK_INTERVAL_MS = 1000;

/**
 * Runs on every *.hana.ondemand.com page (manifest content_scripts match is broad —
 * Chrome match patterns can't express "contains .dt." — so this function does the real
 * narrowing, same gate the service worker uses before it will act on a tab).
 */
function currentPageIsEligible(): boolean {
  try {
    return isEligibleWorkzonePage(new URL(window.location.href));
  } catch {
    return false;
  }
}

function buildButton(shadowRoot: ShadowRoot): HTMLButtonElement {
  const style = document.createElement("style");
  style.textContent = `
    button {
      all: initial;
      position: fixed;
      top: 96px;
      right: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00c8e8 0%, #7659ff 100%);
      box-shadow: 0 4px 12px rgba(11, 31, 51, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      z-index: 2147483000;
      transition: transform 0.15s ease;
    }
    button:hover {
      transform: scale(1.08);
    }
    button:active {
      transform: scale(0.96);
    }
  `;
  shadowRoot.appendChild(style);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "⚡"; // ⚡
  button.title = "Open SAP BTP Workzone Kit";
  button.setAttribute("aria-label", "Open SAP BTP Workzone Kit");
  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_WORKSPACE_TAB" }, () => {
      // Ignore chrome.runtime.lastError here — there is nothing actionable the button
      // itself can do; the workspace tab (or its absence) is the user-visible result.
      void chrome.runtime.lastError;
    });
  });
  shadowRoot.appendChild(button);

  return button;
}

function ensureButtonMounted(): void {
  if (document.getElementById(HOST_ID)) {
    return;
  }
  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadowRoot = host.attachShadow({ mode: "closed" });
  document.documentElement.appendChild(host);
  buildButton(shadowRoot);
}

function removeButtonIfMounted(): void {
  document.getElementById(HOST_ID)?.remove();
}

function syncButtonVisibility(): void {
  if (currentPageIsEligible()) {
    ensureButtonMounted();
  } else {
    removeButtonIfMounted();
  }
}

/** Idempotent: Chrome may run this content script more than once per page in some flows. */
export function initFloatingButton(): void {
  if (window.__BTP_WORKZONE_KIT_FAB_ACTIVE__) {
    return;
  }
  window.__BTP_WORKZONE_KIT_FAB_ACTIVE__ = true;

  syncButtonVisibility();
  // Work Zone is a hash-routed SPA; some route changes fire hashchange, others don't
  // (pushState-based navigation). Poll like the proven source userscript did rather
  // than rely on an event that this SPA framework may not always dispatch.
  window.setInterval(syncButtonVisibility, CHECK_INTERVAL_MS);
}

declare global {
  interface Window {
    __BTP_WORKZONE_KIT_FAB_ACTIVE__?: boolean;
  }
}
