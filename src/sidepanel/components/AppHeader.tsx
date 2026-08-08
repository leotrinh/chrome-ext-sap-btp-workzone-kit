import type { WorkzoneCompatibilityStatus } from "../../integrations/sap-workzone/types";

interface AppHeaderProps {
  compatibilityStatus: WorkzoneCompatibilityStatus | "loading" | "error";
}

export function AppHeader({ compatibilityStatus }: AppHeaderProps) {
  return (
    <header className="app-header">
      <h1>SAP BTP Workzone Kit</h1>
      <span className={`status-badge status-badge--${compatibilityStatus}`}>
        {compatibilityStatus}
      </span>
    </header>
  );
}
