import type { WorkzoneCompatibilityStatus } from "../../integrations/sap-workzone/types";
import logoUrl from "../../../public/logo-250.png";

interface AppHeaderProps {
  compatibilityStatus: WorkzoneCompatibilityStatus | "loading" | "error";
}

export function AppHeader({ compatibilityStatus }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <img src={logoUrl} alt="SAP BTP Workzone Kit" className="app-header__mark" />
        <h1 className="sr-only">SAP BTP Workzone Kit</h1>
      </div>
      <span className={`status-badge status-badge--${compatibilityStatus}`}>
        {compatibilityStatus}
      </span>
    </header>
  );
}
