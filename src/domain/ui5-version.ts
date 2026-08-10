export type Ui5VersionTargetKind = "targetAppConfig" | "visualization";

export interface Ui5VersionTarget {
  kind: Ui5VersionTargetKind;
  visualizationKey?: string;
  currentValue: string | null;
  writable: boolean;
}

export type Ui5VersionConsistency = "none" | "single" | "consistent" | "mixed";

export interface Ui5VersionDetection {
  displayVersion: string | null;
  targets: Ui5VersionTarget[];
  consistency: Ui5VersionConsistency;
}
