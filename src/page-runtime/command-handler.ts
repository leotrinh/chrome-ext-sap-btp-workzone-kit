import {
  isSapWorkzoneHost,
  isSupportedRouteHash,
  matchedRouteSegment,
} from "../integrations/sap-workzone/eligibility";
import { detectEnvironment } from "../integrations/sap-workzone/environment";
import type { WorkzoneEnvironment } from "../integrations/sap-workzone/types";
import type { WorkzoneCommand } from "../messaging/protocol";
import type { WorkzoneCommandResponse } from "./runtime-types";

const RUNTIME_VERSION = "0.1.0";

function readMetaContent(name: string): string | null {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;
}

function handlePing(): WorkzoneCommandResponse {
  return { ok: true, data: { pong: true, runtimeVersion: RUNTIME_VERSION } };
}

function handleGetEnvironment(): WorkzoneCommandResponse<WorkzoneEnvironment> {
  const hostname = window.location.hostname;
  const hostEligible = isSapWorkzoneHost(hostname) && window.location.protocol === "https:";
  const routeEligible = isSupportedRouteHash(window.location.hash);
  const matchedRoute = matchedRouteSegment(window.location.hash);

  const detection = detectEnvironment({
    hostname,
    flpCfConfigContent: readMetaContent("sap.flp.cf.Config"),
    ushellConfigSiteConfigContent: readMetaContent("sap.ushellConfig.siteConfig"),
  });

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

/**
 * Every response is built from fixed, known-shape data only — no CSRF token, raw
 * CDM, or SAP response body ever crosses this boundary back to the side panel.
 */
export async function handleCommand(
  command: WorkzoneCommand,
  _payload: unknown,
): Promise<WorkzoneCommandResponse> {
  switch (command) {
    case "PING":
      return handlePing();
    case "GET_ENVIRONMENT":
      return handleGetEnvironment();
    default:
      return {
        ok: false,
        error: { code: "NOT_IMPLEMENTED", message: `Command not implemented yet: ${command}` },
      };
  }
}
