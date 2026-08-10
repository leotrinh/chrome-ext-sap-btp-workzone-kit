import { useState } from "react";
import { sendWorkzoneCommand } from "../hooks/useWorkzoneCommand";
import { ConfirmDialog } from "./ConfirmDialog";
import type { WorkzoneEnvironment } from "../../integrations/sap-workzone/types";
import type { Html5RefreshResult } from "../../integrations/sap-workzone/html5-refresh";

interface Html5RefreshCardProps {
  environment: WorkzoneEnvironment;
}

const SUCCESS_MESSAGE = "HTML5 content refresh triggered.";

export function Html5RefreshCard({ environment }: Html5RefreshCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Html5RefreshResult | null>(null);

  const contextAvailable = Boolean(environment.subdomain && environment.subaccountId);

  async function handleConfirm(): Promise<void> {
    setConfirming(false);
    setRunning(true);
    setResult(null);

    const response = await sendWorkzoneCommand<Html5RefreshResult>("REFRESH_HTML5_CONTENT");
    setRunning(false);
    setResult(response.ok ? response.data : { status: "server_error", message: response.error.message });
  }

  return (
    <div className="html5-refresh-card">
      <h2>HTML5 Content Refresh</h2>
      <dl>
        <div>
          <dt>Provider</dt>
          <dd>saas_approuter</dd>
        </div>
        <div>
          <dt>Subdomain</dt>
          <dd>{environment.subdomain ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Subaccount</dt>
          <dd>{environment.subaccountId ?? "N/A"}</dd>
        </div>
      </dl>

      <button type="button" onClick={() => setConfirming(true)} disabled={!contextAvailable || running}>
        {running ? "Refreshing…" : "Refresh HTML5 Content"}
      </button>
      {!contextAvailable && (
        <p className="html5-refresh-card__hint">
          Subdomain/subaccount context is not available on this page yet.
        </p>
      )}

      {result && (
        <p
          className={
            result.status === "triggered" ? "html5-refresh-card__success" : "html5-refresh-card__error"
          }
          role="status"
        >
          {result.status === "triggered" ? SUCCESS_MESSAGE : (result.message ?? result.status)}
        </p>
      )}

      {confirming && (
        <ConfirmDialog
          title="Refresh HTML5 Content?"
          confirmLabel="Refresh Content"
          onCancel={() => setConfirming(false)}
          onConfirm={() => void handleConfirm()}
        >
          <p>
            This sends a manual content refresh request for the current SAP BTP Work Zone
            subaccount.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
