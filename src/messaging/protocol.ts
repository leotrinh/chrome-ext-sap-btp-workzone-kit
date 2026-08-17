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
const IMPLEMENTED_NO_PAYLOAD_COMMANDS = [
  "PING",
  "GET_ENVIRONMENT",
  "SCAN_APPS",
  "REFRESH_HTML5_CONTENT",
] as const;

/** Commands implemented as of this phase that take exactly `{ appIds: string[] }`. */
const IMPLEMENTED_APP_ID_PAYLOAD_COMMANDS = ["GET_APP_VERSION_TARGETS"] as const;

/** Commands implemented as of this phase that take `{ appId, changes }`. */
const IMPLEMENTED_UPDATE_PAYLOAD_COMMANDS = ["UPDATE_APP_UI5_VERSION"] as const;

/** Commands implemented as of this phase that take `{ appId, expectedVersion }`. */
const IMPLEMENTED_VERIFY_PAYLOAD_COMMANDS = ["VERIFY_APP_UI5_VERSION"] as const;

/** Known future commands (not yet implemented) — still bounded to the fixed set. */
const NOT_YET_IMPLEMENTED_COMMANDS = WORKZONE_COMMANDS.filter(
  (command) =>
    !(IMPLEMENTED_NO_PAYLOAD_COMMANDS as readonly string[]).includes(command) &&
    !(IMPLEMENTED_APP_ID_PAYLOAD_COMMANDS as readonly string[]).includes(command) &&
    !(IMPLEMENTED_UPDATE_PAYLOAD_COMMANDS as readonly string[]).includes(command) &&
    !(IMPLEMENTED_VERIFY_PAYLOAD_COMMANDS as readonly string[]).includes(command),
) as [string, ...string[]];

export function isKnownWorkzoneCommand(value: unknown): value is WorkzoneCommand {
  return typeof value === "string" && (WORKZONE_COMMANDS as readonly string[]).includes(value);
}

// Vestigial: was set by a separate workspace *tab* the floating button used to open,
// to tell the service worker which SAP tab to operate on instead of assuming "whatever
// tab is active" (wrong once the workspace tab itself became the active tab). That flow
// was replaced by an in-page overlay (`src/content/workzone-overlay.ts`) that already
// runs inside the SAP tab, so no current caller sets this — see the docstring on
// `resolveTargetTabId` in `src/background/service-worker.ts`. Left in the wire schema
// since removing it touches ~30 unrelated protocol tests for no behavior change.
const targetTabIdSchema = z.number().int().positive().optional();

const NoPayloadRequestSchema = z.object({
  command: z.enum(IMPLEMENTED_NO_PAYLOAD_COMMANDS),
  payload: z.undefined().optional(),
  targetTabId: targetTabIdSchema,
});

const AppIdPayloadRequestSchema = z.object({
  command: z.enum(IMPLEMENTED_APP_ID_PAYLOAD_COMMANDS),
  payload: z.object({ appIds: z.array(z.string().min(1)).min(1) }).strict(),
  targetTabId: targetTabIdSchema,
});

// Mirrors Ui5VersionChange (src/domain/update-plan.ts) — kept as an independent schema
// (not imported from the domain type) since this is the wire-format contract, and it
// must stay a plain-data description regardless of how the domain type evolves.
const Ui5VersionChangeSchema = z
  .object({
    kind: z.enum(["targetAppConfig", "visualization"]),
    visualizationKey: z.string().optional(),
    from: z.string().nullable(),
    to: z.string(),
    pathDescription: z.string(),
  })
  .strict()
  // A "visualization" change with no key would be silently skipped by the writer
  // (ui5-version-writer.ts checks `change.visualizationKey` before applying it) —
  // reject that combination here instead of letting a plan under-apply silently.
  .refine((change) => change.kind !== "visualization" || change.visualizationKey !== undefined, {
    message: "visualizationKey is required when kind is 'visualization'",
  });

const UpdatePayloadRequestSchema = z.object({
  command: z.enum(IMPLEMENTED_UPDATE_PAYLOAD_COMMANDS),
  payload: z
    .object({
      appId: z.string().min(1),
      changes: z.array(Ui5VersionChangeSchema).min(1),
    })
    .strict(),
  targetTabId: targetTabIdSchema,
});

const VerifyPayloadRequestSchema = z.object({
  command: z.enum(IMPLEMENTED_VERIFY_PAYLOAD_COMMANDS),
  payload: z.object({ appId: z.string().min(1), expectedVersion: z.string().min(1) }).strict(),
  targetTabId: targetTabIdSchema,
});

const NotYetImplementedRequestSchema = z.object({
  command: z.enum(NOT_YET_IMPLEMENTED_COMMANDS),
  payload: z.unknown().optional(),
  targetTabId: targetTabIdSchema,
});

const WorkzoneCommandRequestSchema = z.union([
  NoPayloadRequestSchema,
  AppIdPayloadRequestSchema,
  UpdatePayloadRequestSchema,
  VerifyPayloadRequestSchema,
  NotYetImplementedRequestSchema,
]);

export interface WorkzoneCommandRequest {
  command: WorkzoneCommand;
  payload?: unknown;
  targetTabId?: number;
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
