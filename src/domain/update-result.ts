export type AppUpdateStatus =
  | "pending"
  | "updating"
  | "updated"
  | "verifying"
  | "verified"
  | "failed"
  | "skipped"
  | "unknown";

export interface Ui5VersionUpdateResult {
  appId: string;
  status: AppUpdateStatus;
  errorMessage?: string;
  /** Kept separate from `status` — mutation success and verification are distinct
   * outcomes (blueprint §20): a successful mutation is never displayed as "Verified"
   * on its own. */
  verificationStatus?: VerificationStatus;
}

export type BulkUpdateState =
  | "idle"
  | "planning"
  | "confirming"
  | "updating"
  | "verifying"
  | "completed"
  | "cancelled";

export type VerificationStatus = "verified" | "mismatch" | "not_verifiable" | "verification_failed";
