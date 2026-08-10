import { isValidVersionFormat } from "../shared/version-format";
import type { Ui5VersionDetection, Ui5VersionTarget, Ui5VersionTargetKind } from "./ui5-version";

export interface Ui5VersionChange {
  kind: Ui5VersionTargetKind;
  visualizationKey?: string;
  from: string | null;
  to: string;
  pathDescription: string;
}

export interface Ui5VersionUpdatePlan {
  appId: string;
  appTitle: string;
  current: Ui5VersionDetection;
  targetVersion: string;
  changes: Ui5VersionChange[];
  noOp: boolean;
  warnings: string[];
}

function describePath(target: Ui5VersionTarget): string {
  return target.kind === "targetAppConfig" ? "targetAppConfig" : `visualization: ${target.visualizationKey ?? "unknown"}`;
}

function emptyPlan(
  appId: string,
  appTitle: string,
  current: Ui5VersionDetection,
  targetVersion: string,
  warnings: string[],
): Ui5VersionUpdatePlan {
  return { appId, appTitle, current, targetVersion, changes: [], noOp: true, warnings };
}

/**
 * Pure diff builder (blueprint §16) — never touches the network or the CDM object
 * itself. The actual `structuredClone` + write happens in the mutation phase, using
 * this plan's `changes` list to know exactly which paths to set.
 */
export function createUi5VersionUpdatePlan(
  appId: string,
  appTitle: string,
  current: Ui5VersionDetection,
  targetVersion: string,
): Ui5VersionUpdatePlan {
  if (!isValidVersionFormat(targetVersion)) {
    return emptyPlan(appId, appTitle, current, targetVersion, [
      `Invalid target version format: "${targetVersion}".`,
    ]);
  }

  if (current.targets.length === 0) {
    return emptyPlan(appId, appTitle, current, targetVersion, ["No supported UI5 version target found."]);
  }

  const changes: Ui5VersionChange[] = current.targets
    .filter((target) => target.writable && target.currentValue !== targetVersion)
    .map((target) => ({
      kind: target.kind,
      visualizationKey: target.visualizationKey,
      from: target.currentValue,
      to: targetVersion,
      pathDescription: describePath(target),
    }));

  return {
    appId,
    appTitle,
    current,
    targetVersion,
    changes,
    noOp: changes.length === 0,
    warnings: [],
  };
}

export interface UpdatePlanSummary {
  selectedCount: number;
  changingCount: number;
  alreadyConfiguredCount: number;
  unsupportedCount: number;
  targetVersionBreakdown: Array<{ targetVersion: string; appCount: number }>;
}

/** Drives the blueprint §17 confirmation dialog's exact counts. */
export function summarizeUpdatePlans(plans: readonly Ui5VersionUpdatePlan[]): UpdatePlanSummary {
  let changingCount = 0;
  let alreadyConfiguredCount = 0;
  let unsupportedCount = 0;
  const breakdown = new Map<string, number>();

  for (const plan of plans) {
    if (plan.changes.length > 0) {
      changingCount++;
      breakdown.set(plan.targetVersion, (breakdown.get(plan.targetVersion) ?? 0) + 1);
    } else if (plan.warnings.length > 0) {
      unsupportedCount++;
    } else {
      alreadyConfiguredCount++;
    }
  }

  return {
    selectedCount: plans.length,
    changingCount,
    alreadyConfiguredCount,
    unsupportedCount,
    targetVersionBreakdown: Array.from(breakdown.entries()).map(([targetVersion, appCount]) => ({
      targetVersion,
      appCount,
    })),
  };
}
