/**
 * Separate from `protocol.ts`'s `WorkzoneCommand` set (which targets the SAP page
 * runtime). This is the small, fixed set of extension-internal UI intents the
 * floating button / other injected UI can ask the service worker to perform.
 */
export const UI_MESSAGE_TYPES = ["OPEN_WORKSPACE_TAB"] as const;

export type UiMessageType = (typeof UI_MESSAGE_TYPES)[number];

export interface UiMessage {
  type: UiMessageType;
}

export function isUiMessage(value: unknown): value is UiMessage {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const type = (value as Record<string, unknown>).type;
  return typeof type === "string" && (UI_MESSAGE_TYPES as readonly string[]).includes(type);
}
