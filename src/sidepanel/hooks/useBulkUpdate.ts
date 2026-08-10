import { useCallback, useState } from "react";
import { sendWorkzoneCommand } from "./useWorkzoneCommand";
import { MUTATION_DELAY_MS } from "../../integrations/sap-workzone/constants";
import type { Ui5VersionUpdatePlan } from "../../domain/update-plan";
import type {
  AppUpdateStatus,
  BulkUpdateState,
  Ui5VersionUpdateResult,
  VerificationStatus,
} from "../../domain/update-result";

// Blueprint §19: sequential queue, fixed delay between writes, never Promise.all.
// Auth/CSRF problems stop the whole queue rather than continuing app-by-app (blueprint
// §19: "If auth/CSRF fails: stop queue; do not continue").
const QUEUE_STOPPING_ERROR_CODES = new Set([
  "AUTHENTICATION_REQUIRED",
  "AUTHORIZATION_DENIED",
  "CSRF_REJECTED",
  "CSRF_MISSING",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useBulkUpdate(): {
  state: BulkUpdateState;
  results: Map<string, Ui5VersionUpdateResult>;
  run: (plans: readonly Ui5VersionUpdatePlan[]) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<BulkUpdateState>("idle");
  const [results, setResults] = useState<Map<string, Ui5VersionUpdateResult>>(new Map());

  const setStatus = useCallback(
    (appId: string, status: AppUpdateStatus, errorMessage?: string, verificationStatus?: VerificationStatus) => {
      setResults((current) => {
        const next = new Map(current);
        const existing = current.get(appId);
        next.set(appId, {
          appId,
          status,
          errorMessage,
          verificationStatus: verificationStatus ?? existing?.verificationStatus,
        });
        return next;
      });
    },
    [],
  );

  const run = useCallback(
    async (plans: readonly Ui5VersionUpdatePlan[]) => {
      setState("updating");

      const initial = new Map<string, Ui5VersionUpdateResult>();
      for (const plan of plans) {
        initial.set(plan.appId, { appId: plan.appId, status: plan.noOp ? "skipped" : "pending" });
      }
      setResults(initial);

      // Never send a no-op plan as a mutation (blueprint §16/§18).
      const actionable = plans.filter((plan) => !plan.noOp);

      for (let i = 0; i < actionable.length; i++) {
        const plan = actionable[i];
        if (!plan) {
          continue;
        }

        setStatus(plan.appId, "updating");

        const response = await sendWorkzoneCommand<{ appId: string }>("UPDATE_APP_UI5_VERSION", {
          appId: plan.appId,
          changes: plan.changes,
        });

        if (!response.ok) {
          setStatus(plan.appId, "failed", response.error.message);

          if (QUEUE_STOPPING_ERROR_CODES.has(response.error.code)) {
            for (let j = i + 1; j < actionable.length; j++) {
              const remaining = actionable[j];
              if (remaining) {
                setStatus(remaining.appId, "unknown", "Queue stopped after an authentication/CSRF failure.");
              }
            }
            setState("completed");
            return;
          }
        } else {
          setStatus(plan.appId, "updated");
          setStatus(plan.appId, "verifying");

          const verifyResponse = await sendWorkzoneCommand<{
            appId: string;
            status: VerificationStatus;
            errorMessage?: string;
          }>("VERIFY_APP_UI5_VERSION", { appId: plan.appId, expectedVersion: plan.targetVersion });

          if (verifyResponse.ok) {
            const verifyStatus =
              verifyResponse.data.status === "verified" ? "verified" : ("updated" as AppUpdateStatus);
            setStatus(plan.appId, verifyStatus, verifyResponse.data.errorMessage, verifyResponse.data.status);
          } else {
            // Verification itself failing to run doesn't roll back or retry the
            // mutation (blueprint §20) — the update already succeeded.
            setStatus(plan.appId, "updated", undefined, "verification_failed");
          }
        }

        if (i < actionable.length - 1) {
          await sleep(MUTATION_DELAY_MS);
        }
      }

      setState("completed");
    },
    [setStatus],
  );

  const reset = useCallback(() => {
    setState("idle");
    setResults(new Map());
  }, []);

  return { state, results, run, reset };
}
