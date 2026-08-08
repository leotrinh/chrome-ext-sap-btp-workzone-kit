import { parseCommandRequest, type ParseResult, type WorkzoneCommandRequest } from "./protocol";

/**
 * Boundary gate for messages arriving at the service worker from the side panel
 * (`chrome.runtime.sendMessage`). Never trust panel input directly — always route
 * it through the same fixed-command schema used by the page-runtime handler.
 */
export function validateIncomingPanelMessage(raw: unknown): ParseResult<WorkzoneCommandRequest> {
  return parseCommandRequest(raw);
}
