import { executeGraphQlRequest } from "./graphql-client";
import {
  BATCH_PROCESS_MUTATION,
  buildBatchProcessVariables,
  type BatchProcessResponseData,
} from "./graphql/batch-process";
import { getBusinessAppDetail } from "./app-detail";
import { readUi5VersionTargets } from "./ui5-version-reader";
import type { Ui5VersionChange } from "../../domain/update-plan";
import type { WorkzoneRequestError } from "../../shared/errors";

export type ApplyChangesResult = { ok: true } | { ok: false; error: WorkzoneRequestError };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Walks/creates intermediate objects along `path` and sets the final key to `value`. */
function setByPath(root: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let current: Record<string, unknown> = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] as string;
    const next = current[key];
    if (isPlainObject(next)) {
      current = next;
    } else {
      const created: Record<string, unknown> = {};
      current[key] = created;
      current = created;
    }
  }
  const lastKey = path[path.length - 1] as string;
  current[lastKey] = value;
}

/**
 * Applies a plan's changes to a CLONE of the CDM (blueprint §18: `structuredClone`
 * before any write — the original passed in is never mutated). Only the two known
 * `sap-ui-version` paths are ever touched; every other field is left exactly as-is.
 */
export function applyChangesToClonedCdm(cdm: unknown, changes: readonly Ui5VersionChange[]): unknown {
  const clone = structuredClone(cdm);
  if (!isPlainObject(clone)) {
    return clone;
  }
  if (!isPlainObject(clone.payload)) {
    clone.payload = {};
  }
  const payload = clone.payload as Record<string, unknown>;

  for (const change of changes) {
    if (change.kind === "targetAppConfig") {
      setByPath(
        payload,
        ["targetAppConfig", "sap.integration", "urlTemplateParams", "query", "sap-ui-version"],
        change.to,
      );
    } else if (change.kind === "visualization" && change.visualizationKey) {
      setByPath(
        payload,
        [
          "visualizations",
          change.visualizationKey,
          "vizConfig",
          "sap.flp",
          "target",
          "parameters",
          "sap-ui-version",
        ],
        { value: change.to, format: "plain" },
      );
    }
  }

  return clone;
}

function changeTargetStillPresent(change: Ui5VersionChange, freshCdm: unknown): boolean {
  return readUi5VersionTargets(freshCdm).targets.some(
    (target) => target.kind === change.kind && target.visualizationKey === change.visualizationKey,
  );
}

/**
 * Re-fetches the app's current CDM (rather than reusing whatever was seen during
 * scan — the React UI never receives raw CDM at all, only extracted version data, and
 * even if it did, the SAP config could have changed since the scan), applies the given
 * changes to a clone, and sends the batchProcess mutation. Never called with an empty
 * `changes` array — no-op plans must be filtered out by the caller before this point.
 *
 * Before writing, every change's target path is re-verified against the freshly
 * fetched CDM (not the possibly-stale one the plan was built from). `setByPath`
 * creates missing intermediate objects rather than failing, which is correct for a
 * path that's genuinely there — but if a target was removed or renamed between scan
 * and this mutation, blindly writing to it would fabricate a minimal, sibling-field-
 * free object into a live SAP mutation instead of updating the real one. Failing
 * loudly here is the safe choice for a tool that writes to production tenants.
 */
export async function applyUi5VersionChanges(
  appId: string,
  changes: readonly Ui5VersionChange[],
): Promise<ApplyChangesResult> {
  const detailResult = await getBusinessAppDetail(appId);
  if (!detailResult.ok) {
    return detailResult;
  }

  const staleChange = changes.find((change) => !changeTargetStillPresent(change, detailResult.detail.cdm));
  if (staleChange) {
    return {
      ok: false,
      error: {
        code: "PAGE_CHANGED",
        message:
          `The target for "${staleChange.pathDescription}" is no longer present in this app's ` +
          "current configuration — it may have changed since the last scan. Re-scan and try again.",
      },
    };
  }

  const updatedCdm = applyChangesToClonedCdm(detailResult.detail.cdm, changes);

  const mutationResult = await executeGraphQlRequest<BatchProcessResponseData>({
    query: BATCH_PROCESS_MUTATION,
    variables: buildBatchProcessVariables(updatedCdm),
  });

  if (!mutationResult.ok) {
    return mutationResult;
  }

  return { ok: true };
}
