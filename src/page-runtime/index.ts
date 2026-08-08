import { parseCommandRequest } from "../messaging/protocol";
import { handleCommand } from "./command-handler";
import type { WorkzoneCommandResponse, WorkzoneRuntime } from "./runtime-types";

const RUNTIME_VERSION = "0.1.0";

function createRuntime(): WorkzoneRuntime {
  return {
    runtimeVersion: RUNTIME_VERSION,
    protocolVersion: 1,
    async handle(command, payload): Promise<WorkzoneCommandResponse> {
      const parsed = parseCommandRequest({ command, payload });
      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }
      return handleCommand(parsed.value.command, parsed.value.payload);
    },
  };
}

/** Idempotent: `chrome.scripting.executeScript` may inject this more than once per page. */
if (!window.__BTP_WORKZONE_KIT__) {
  window.__BTP_WORKZONE_KIT__ = createRuntime();
}
