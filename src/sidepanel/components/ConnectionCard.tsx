import type { WorkzoneEnvironmentState } from "../hooks/useWorkzoneEnvironment";

interface ConnectionCardProps {
  state: WorkzoneEnvironmentState;
  onRefresh: () => void;
}

export function ConnectionCard({ state, onRefresh }: ConnectionCardProps) {
  if (state.status === "loading") {
    return (
      <div className="connection-card" role="status" aria-live="polite">
        Checking the active tab…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="connection-card connection-card--error" role="alert">
        <p>{state.message}</p>
        <button type="button" onClick={onRefresh}>
          Retry
        </button>
      </div>
    );
  }

  const { environment } = state;

  if (!environment.eligible) {
    return (
      <div className="connection-card connection-card--not-eligible" role="status">
        <p>
          This tab isn&apos;t a supported SAP BTP Work Zone administration page. Open a
          Content Manager, Site Directory, Provider Manager, Subaccount Settings, or
          Transport Manager route in a Work Zone tenant, then reopen this panel.
        </p>
        <button type="button" onClick={onRefresh}>
          Re-check
        </button>
      </div>
    );
  }

  return (
    <div className="connection-card connection-card--ready" role="status" aria-live="polite">
      <dl>
        <div>
          <dt>Subaccount</dt>
          <dd>{environment.subaccountId ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Subdomain</dt>
          <dd>{environment.subdomain ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>{environment.matchedRoute ?? "N/A"}</dd>
        </div>
      </dl>
      {environment.warnings.length > 0 && (
        <ul className="connection-card__warnings">
          {environment.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onRefresh}>
        Re-check
      </button>
    </div>
  );
}
