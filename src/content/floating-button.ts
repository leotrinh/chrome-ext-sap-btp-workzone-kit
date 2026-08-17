import { isEligibleWorkzonePage } from "../integrations/sap-workzone/eligibility";
import { buildWorkzoneOverlay, type WorkzoneOverlay } from "./workzone-overlay";

const HOST_ID = "btp-workzone-kit-fab-host";
const CHECK_INTERVAL_MS = 1000;

// Set while the host (button + overlay) is mounted, so a page becoming ineligible mid-
// session (SPA navigation while the overlay is open) can close the overlay before the
// host is torn down — `close()` also detaches the overlay's own keydown listener, which
// isn't scoped to the host element and wouldn't otherwise get cleaned up by removing it.
let activeOverlay: WorkzoneOverlay | null = null;

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

function buildButton(shadowRoot: ShadowRoot, onClick: () => void): HTMLButtonElement {
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
  button.addEventListener("click", onClick);
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

  const overlay = buildWorkzoneOverlay(shadowRoot);
  activeOverlay = overlay;
  buildButton(shadowRoot, () => {
    if (overlay.backdrop.hidden) {
      overlay.open();
    } else {
      overlay.close();
    }
  });
}

function removeButtonIfMounted(): void {
  // Never tear down the host while the overlay is open — the iframe may be mid bulk
  // update (the SAP tab's own route can still change under it, e.g. via the browser's
  // Back button, even while the backdrop blocks clicks on the page underneath).
  // Removing the host would destroy the iframe's browsing context and silently abort
  // whatever it was doing, unlike close() (hide only), which is the overlay's only
  // other teardown path. Eligibility is re-polled every second, so removal is simply
  // retried once the user dismisses the overlay through its own close affordances.
  if (activeOverlay && !activeOverlay.backdrop.hidden) {
    return;
  }
  activeOverlay = null;
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
