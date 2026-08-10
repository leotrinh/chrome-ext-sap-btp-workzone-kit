import type { Ui5VersionConsistency, Ui5VersionDetection, Ui5VersionTarget } from "../../domain/ui5-version";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeGet(root: unknown, path: readonly string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function computeConsistency(targets: readonly Ui5VersionTarget[]): Ui5VersionConsistency {
  if (targets.length === 0) {
    return "none";
  }
  if (targets.length === 1) {
    return "single";
  }
  const first = targets[0]?.currentValue;
  return targets.every((target) => target.currentValue === first) ? "consistent" : "mixed";
}

/**
 * Detects every supported UI5 version target in a business app's CDM (blueprint §3.7)
 * — both known paths, not just the first found like the source userscript did. Never
 * throws: any malformed/missing shape along the way is treated as "not found" for
 * that specific target, not a crash.
 */
export function readUi5VersionTargets(cdm: unknown): Ui5VersionDetection {
  const targets: Ui5VersionTarget[] = [];
  const payload = safeGet(cdm, ["payload"]);

  const pathAValue = safeGet(payload, [
    "targetAppConfig",
    "sap.integration",
    "urlTemplateParams",
    "query",
    "sap-ui-version",
  ]);
  if (typeof pathAValue === "string" && pathAValue.length > 0) {
    targets.push({ kind: "targetAppConfig", currentValue: pathAValue, writable: true });
  }

  const visualizations = safeGet(payload, ["visualizations"]);
  if (isPlainObject(visualizations)) {
    for (const key of Object.keys(visualizations)) {
      const value = safeGet(visualizations, [
        key,
        "vizConfig",
        "sap.flp",
        "target",
        "parameters",
        "sap-ui-version",
        "value",
      ]);
      if (typeof value === "string" && value.length > 0) {
        targets.push({ kind: "visualization", visualizationKey: key, currentValue: value, writable: true });
      }
    }
  }

  const consistency = computeConsistency(targets);
  const displayVersion =
    consistency === "single" || consistency === "consistent" ? (targets[0]?.currentValue ?? null) : null;

  return { displayVersion, targets, consistency };
}
