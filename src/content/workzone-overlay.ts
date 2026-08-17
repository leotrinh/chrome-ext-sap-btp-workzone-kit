const SIDEPANEL_PATH = "sidepanel/index.html";

/**
 * Full-screen modal overlay rendered directly on the Work Zone page — replaces the
 * previous "open a separate browser tab" flow. The side panel bundle doesn't care which
 * host it runs in (it only ever talks to SAP via `chrome.runtime` messaging), so this
 * reuses it verbatim in an iframe instead of duplicating the React app into the content
 * script bundle.
 */
export interface WorkzoneOverlay {
  backdrop: HTMLDivElement;
  open: () => void;
  close: () => void;
}

export function buildWorkzoneOverlay(shadowRoot: ShadowRoot): WorkzoneOverlay {
  const style = document.createElement("style");
  style.textContent = `
    .backdrop {
      all: initial;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      z-index: 2147483001;
      display: flex;
      box-sizing: border-box;
      padding: 28px 20px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .backdrop[hidden] {
      display: none;
    }
    .panel {
      position: relative;
      width: 100%;
      height: 100%;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.4);
      overflow: hidden;
    }
    .close-btn {
      all: initial;
      position: absolute;
      top: 14px;
      right: 18px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.08);
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      z-index: 1;
    }
    .close-btn:hover {
      background: rgba(15, 23, 42, 0.16);
    }
    iframe {
      display: block;
      border: 0;
      width: 100%;
      height: 100%;
    }
  `;
  shadowRoot.appendChild(style);

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.hidden = true;
  backdrop.setAttribute("role", "presentation");

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "SAP BTP Workzone Kit");

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "close-btn";
  closeButton.textContent = "✕";
  closeButton.setAttribute("aria-label", "Close");

  // Created lazily on first open — no iframe load (and no side panel bundle fetch)
  // until the user actually opens the overlay.
  let iframe: HTMLIFrameElement | null = null;

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      // This listener lives on the real Work Zone page's `window` (there's no iframe
      // boundary protecting it, unlike the sidepanel's own in-extension dialogs).
      // Registered on the CAPTURE phase (see addEventListener call below) so it runs
      // before the event reaches SAPUI5's own document/element-level handlers —
      // stopPropagation() in the bubble phase would be too late to prevent those, since
      // window is the last stop in bubble order, not the first.
      event.stopPropagation();
      close();
    }
  }

  function close(): void {
    backdrop.hidden = true;
    window.removeEventListener("keydown", handleKeyDown, true);
  }

  function open(): void {
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.src = chrome.runtime.getURL(SIDEPANEL_PATH);
      iframe.title = "SAP BTP Workzone Kit";
      panel.appendChild(iframe);
    }
    backdrop.hidden = false;
    window.addEventListener("keydown", handleKeyDown, true);
  }

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      close();
    }
  });

  panel.appendChild(closeButton);
  backdrop.appendChild(panel);
  shadowRoot.appendChild(backdrop);

  return { backdrop, open, close };
}
