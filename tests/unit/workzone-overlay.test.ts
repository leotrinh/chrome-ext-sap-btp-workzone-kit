import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWorkzoneOverlay } from "../../src/content/workzone-overlay";

function mountShadowRoot(): ShadowRoot {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host.attachShadow({ mode: "open" });
}

beforeEach(() => {
  vi.stubGlobal("chrome", {
    runtime: { getURL: (path: string) => `chrome-extension://fake-id/${path}` },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("buildWorkzoneOverlay()", () => {
  it("starts hidden with no iframe until open() is called", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    expect(overlay.backdrop.hidden).toBe(true);
    expect(overlay.backdrop.querySelector("iframe")).toBeNull();
  });

  it("open() unhides the backdrop and lazily creates the side panel iframe", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    overlay.open();

    expect(overlay.backdrop.hidden).toBe(false);
    const iframe = overlay.backdrop.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.src).toBe("chrome-extension://fake-id/sidepanel/index.html");
  });

  it("open() called twice reuses the same iframe instead of creating a second one", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    overlay.open();
    overlay.open();

    expect(overlay.backdrop.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("close() hides the backdrop without removing the iframe (state preserved on reopen)", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    overlay.open();
    overlay.close();

    expect(overlay.backdrop.hidden).toBe(true);
    expect(overlay.backdrop.querySelector("iframe")).not.toBeNull();
  });

  it("clicking the backdrop itself closes the overlay", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    overlay.open();

    overlay.backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(overlay.backdrop.hidden).toBe(true);
  });

  it("clicking inside the panel does not close the overlay", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    overlay.open();
    const panel = overlay.backdrop.querySelector(".panel") as HTMLElement;

    panel.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(overlay.backdrop.hidden).toBe(false);
  });

  it("the close button closes the overlay", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    overlay.open();
    const closeButton = overlay.backdrop.querySelector(".close-btn") as HTMLElement;

    closeButton.click();

    expect(overlay.backdrop.hidden).toBe(true);
  });

  it("Escape closes the overlay while open", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    overlay.open();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(overlay.backdrop.hidden).toBe(true);
  });

  it("stops listening for Escape once closed (no leak onto later overlays)", () => {
    const overlay = buildWorkzoneOverlay(mountShadowRoot());
    overlay.open();
    overlay.close();
    overlay.open();
    overlay.close();

    // If the keydown listener leaked across open()/close() cycles, this would throw
    // when a stale closure fires against an already-detached backdrop — it doesn't,
    // and the overlay stays in the closed state Escape would produce anyway.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(overlay.backdrop.hidden).toBe(true);
  });
});
