import { getBusinessAppDetail } from "./app-detail";
import { readUi5VersionTargets } from "./ui5-version-reader";
import type { VerificationStatus } from "../../domain/update-result";

export interface VerifyResult {
  status: VerificationStatus;
  errorMessage?: string;
}

/**
 * Re-fetches the app's CDM and compares every writable target against the expected
 * version (blueprint §20). Distinct from mutation success — a successful mutation
 * response never implies "verified" on its own.
 */
export async function verifyUi5Version(appId: string, expectedVersion: string): Promise<VerifyResult> {
  const detailResult = await getBusinessAppDetail(appId);
  if (!detailResult.ok) {
    return { status: "verification_failed", errorMessage: detailResult.error.message };
  }

  const detection = readUi5VersionTargets(detailResult.detail.cdm);
  if (detection.targets.length === 0) {
    return { status: "not_verifiable" };
  }

  const allMatch = detection.targets.every((target) => target.currentValue === expectedVersion);
  return { status: allMatch ? "verified" : "mismatch" };
}
