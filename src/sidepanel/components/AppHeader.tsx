import type { WorkzoneCompatibilityStatus } from "../../integrations/sap-workzone/types";

interface AppHeaderProps {
  compatibilityStatus: WorkzoneCompatibilityStatus | "loading" | "error";
}

export function AppHeader({ compatibilityStatus }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__mark" aria-hidden="true">
          SB
        </span>
        <h1>SAP BTP Workzone Kit</h1>
      </div>
      <span className={`status-badge status-badge--${compatibilityStatus}`}>
        {compatibilityStatus}
      </span>
    </header>
  );
}
