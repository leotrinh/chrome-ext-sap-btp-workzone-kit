import { z } from "zod";

/**
 * Fixed command set the panel is allowed to request from the packaged MAIN-world
 * runtime (blueprint §8). React never sends a URL, GraphQL document, or script —
 * only one of these literals plus a schema-validated payload.
 */
export const WORKZONE_COMMANDS = [
  "PING",
  "GET_ENVIRONMENT",
  "SCAN_APPS",
  "GET_APP_VERSION_TARGETS",
  "BUILD_UPDATE_PLAN",
  "UPDATE_APP_UI5_VERSION",
  "VERIFY_APP_UI5_VERSION",
  "REFRESH_HTML5_CONTENT",
] as const;

export type WorkzoneCommand = (typeof WORKZONE_COMMANDS)[number];

/** Commands implemented as of this phase; payload must be absent/undefined. */
const IMPLEMENTED_NO_PAYLOAD_COMMANDS = ["PING", "GET_ENVIRONMENT"] as const;

/** Known future commands (not yet implemented) — still bounded to the fixed set. */
const NOT_YET_IMPLEMENTED_COMMANDS = WORKZONE_COMMANDS.filter(
  (command) => !(IMPLEMENTED_NO_PAYLOAD_COMMANDS as readonly string[]).includes(command),
) as [string, ...string[]];

export function isKnownWorkzoneCommand(value: unknown): value is WorkzoneCommand {
  return typeof value === "string" && (WORKZONE_COMMANDS as readonly string[]).includes(value);
}

const NoPayloadRequestSchema = z.object({
  command: z.enum(IMPLEMENTED_NO_PAYLOAD_COMMANDS),
  payload: z.undefined().optional(),
});

const NotYetImplementedRequestSchema = z.object({
  command: z.enum(NOT_YET_IMPLEMENTED_COMMANDS),
  payload: z.unknown().optional(),
});

const WorkzoneCommandRequestSchema = z.union([
  NoPayloadRequestSchema,
  NotYetImplementedRequestSchema,
]);

export interface WorkzoneCommandRequest {
  command: WorkzoneCommand;
  payload?: unknown;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };

export function parseCommandRequest(raw: unknown): ParseResult<WorkzoneCommandRequest> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Command request must be a plain object." },
    };
  }

  const commandValue = (raw as Record<string, unknown>).command;
  if (!isKnownWorkzoneCommand(commandValue)) {
    return {
      ok: false,
      error: { code: "UNKNOWN_COMMAND", message: `Unknown command: ${String(commandValue)}` },
    };
  }

  const parsed = WorkzoneCommandRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      },
    };
  }

  return { ok: true, value: parsed.data as WorkzoneCommandRequest };
}
