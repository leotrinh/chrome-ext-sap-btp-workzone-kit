import {
  isSapWorkzoneHost,
  isSupportedRouteHash,
  matchedRouteSegment,
} from "../integrations/sap-workzone/eligibility";
import { detectEnvironment } from "../integrations/sap-workzone/environment";
import { listLocalBusinessApps, type WorkzoneAppSummary } from "../integrations/sap-workzone/app-list";
import { getBusinessAppDetails } from "../integrations/sap-workzone/app-detail";
import { readUi5VersionTargets } from "../integrations/sap-workzone/ui5-version-reader";
import { applyUi5VersionChanges } from "../integrations/sap-workzone/ui5-version-writer";
import { verifyUi5Version } from "../integrations/sap-workzone/verification";
import { refreshHtml5Content, type Html5RefreshResult } from "../integrations/sap-workzone/html5-refresh";
import type { Ui5VersionDetection } from "../domain/ui5-version";
import type { Ui5VersionChange } from "../domain/update-plan";
import type { WorkzoneEnvironment } from "../integrations/sap-workzone/types";
import type { WorkzoneRequestError } from "../shared/errors";
import type { WorkzoneCommand } from "../messaging/protocol";
import type { WorkzoneCommandResponse } from "./runtime-types";

const RUNTIME_VERSION = "0.2.0";

function readMetaContent(name: string): string | null {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;
}

function handlePing(): WorkzoneCommandResponse {
  return { ok: true, data: { pong: true, runtimeVersion: RUNTIME_VERSION } };
}

function computeEnvironment(): {
  hostEligible: boolean;
  routeEligible: boolean;
  matchedRoute: ReturnType<typeof matchedRouteSegment>;
  detection: ReturnType<typeof detectEnvironment>;
} {
  const hostname = window.location.hostname;
  const hostEligible = isSapWorkzoneHost(hostname) && window.location.protocol === "https:";
  const routeEligible = isSupportedRouteHash(window.location.hash);
  const matchedRoute = matchedRouteSegment(window.location.hash);

  const detection = detectEnvironment({
    hostname,
    flpCfConfigContent: readMetaContent("sap.flp.cf.Config"),
    ushellConfigSiteConfigContent: readMetaContent("sap.ushellConfig.siteConfig"),
  });

  return { hostEligible, routeEligible, matchedRoute, detection };
}

function handleGetEnvironment(): WorkzoneCommandResponse<WorkzoneEnvironment> {
  const { hostEligible, routeEligible, matchedRoute, detection } = computeEnvironment();

  return {
    ok: true,
    data: {
      eligible: hostEligible && routeEligible,
      matchedRoute: matchedRoute ?? undefined,
      subaccountId: detection.subaccountId ?? undefined,
      subdomain: detection.subdomain ?? undefined,
      metadataSource: detection.metadataSource ?? undefined,
      compatibilityStatus: hostEligible && routeEligible ? "ready" : "unsupported_page",
      warnings: detection.warnings,
    },
  };
}

async function handleScanApps(): Promise<WorkzoneCommandResponse<{ apps: WorkzoneAppSummary[] }>> {
  const result = await listLocalBusinessApps();
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: { apps: result.apps } };
}

export interface AppVersionTargetsEntry {
  appId: string;
  detection?: Ui5VersionDetection;
  error?: WorkzoneRequestError;
}

/**
 * Batched (not per-app) so the fixed concurrency-5 cap (blueprint's
 * APP_DETAIL_CONCURRENCY, enforced inside getBusinessAppDetails) applies across the
 * whole request — the panel calls this once with every scanned app id rather than
 * firing one message per app, which would bypass the cap entirely.
 */
async function handleGetAppVersionTargets(
  payload: unknown,
): Promise<WorkzoneCommandResponse<{ results: AppVersionTargetsEntry[] }>> {
  const appIds = (payload as { appIds?: unknown } | undefined)?.appIds;
  if (!Array.isArray(appIds) || appIds.length === 0 || appIds.some((id) => typeof id !== "string")) {
    return {
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "payload.appIds must be a non-empty array of strings." },
    };
  }

  const detailResults = await getBusinessAppDetails(appIds as string[]);
  const results: AppVersionTargetsEntry[] = detailResults.map(({ appId, result }) =>
    result.ok
      ? { appId, detection: readUi5VersionTargets(result.detail.cdm) }
      : { appId, error: result.error },
  );

  return { ok: true, data: { results } };
}

/**
 * The panel builds the plan (it already has `detection` from GET_APP_VERSION_TARGETS)
 * and sends only the final `changes` list — never the CDM, never a GraphQL document.
 * `changes.length === 0` is rejected here too, defense-in-depth against a caller bug
 * that would otherwise send an unchanged CDM as a "no-op" mutation.
 */
async function handleUpdateAppUi5Version(payload: unknown): Promise<WorkzoneCommandResponse> {
  const typed = payload as { appId?: unknown; changes?: unknown } | undefined;
  const appId = typed?.appId;
  const changes = typed?.changes;

  if (typeof appId !== "string" || appId.length === 0 || !Array.isArray(changes) || changes.length === 0) {
    return {
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "payload.appId and a non-empty payload.changes are required." },
    };
  }

  const result = await applyUi5VersionChanges(appId, changes as Ui5VersionChange[]);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: { appId } };
}

async function handleVerifyAppUi5Version(
  payload: unknown,
): Promise<WorkzoneCommandResponse<{ appId: string; status: string; errorMessage?: string }>> {
  const typed = payload as { appId?: unknown; expectedVersion?: unknown } | undefined;
  const appId = typed?.appId;
  const expectedVersion = typed?.expectedVersion;

  if (typeof appId !== "string" || appId.length === 0 || typeof expectedVersion !== "string" || expectedVersion.length === 0) {
    return {
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "payload.appId and payload.expectedVersion are required." },
    };
  }

  const result = await verifyUi5Version(appId, expectedVersion);
  return { ok: true, data: { appId, status: result.status, errorMessage: result.errorMessage } };
}

/**
 * Re-derives subdomain/subaccountId itself (rather than trusting values the panel
 * might supply) using the same `detectEnvironment` logic as GET_ENVIRONMENT — the
 * content script is the single source of truth for this data.
 */
async function handleRefreshHtml5Content(): Promise<WorkzoneCommandResponse<Html5RefreshResult>> {
  const { detection } = computeEnvironment();
  if (!detection.subdomain || !detection.subaccountId) {
    return {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Subdomain/subaccount context is not available on this page.",
      },
    };
  }

  const result = await refreshHtml5Content(detection.subdomain, detection.subaccountId);
  return { ok: true, data: result };
}

/**
 * Every response is built from fixed, known-shape data only — no CSRF token, raw
 * CDM, or SAP response body ever crosses this boundary back to the side panel.
 */
export async function handleCommand(
  command: WorkzoneCommand,
  payload: unknown,
): Promise<WorkzoneCommandResponse> {
  switch (command) {
    case "PING":
      return handlePing();
    case "GET_ENVIRONMENT":
      return handleGetEnvironment();
    case "SCAN_APPS":
      return handleScanApps();
    case "GET_APP_VERSION_TARGETS":
      return handleGetAppVersionTargets(payload);
    case "UPDATE_APP_UI5_VERSION":
      return handleUpdateAppUi5Version(payload);
    case "VERIFY_APP_UI5_VERSION":
      return handleVerifyAppUi5Version(payload);
    case "REFRESH_HTML5_CONTENT":
      return handleRefreshHtml5Content();
    default:
      return {
        ok: false,
        error: { code: "NOT_IMPLEMENTED", message: `Command not implemented yet: ${command}` },
      };
  }
}
