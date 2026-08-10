import { useState } from "react";
import { AboutPanel } from "./components/AboutPanel";
import { AppHeader } from "./components/AppHeader";
import { AppsPanel } from "./components/AppsPanel";
import { ConnectionCard } from "./components/ConnectionCard";
import { Footer } from "./components/Footer";
import { Html5RefreshCard } from "./components/Html5RefreshCard";
import { useWorkzoneEnvironment } from "./hooks/useWorkzoneEnvironment";

type TabId = "apps" | "html5" | "about";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "apps", label: "Apps" },
  { id: "html5", label: "HTML5" },
  { id: "about", label: "About" },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("apps");
  const { state, refresh } = useWorkzoneEnvironment();

  const compatibilityStatus =
    state.status === "loading"
      ? "loading"
      : state.status === "error"
        ? "error"
        : state.environment.compatibilityStatus;

  return (
    <div className="app-shell">
      <AppHeader compatibilityStatus={compatibilityStatus} />
      <nav className="tab-bar" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "tab tab--active" : "tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tab-panel">
        {activeTab === "apps" && (
          <>
            <ConnectionCard state={state} onRefresh={refresh} />
            {state.status === "ready" && state.environment.eligible && <AppsPanel />}
          </>
        )}
        {activeTab === "html5" && (
          <>
            {state.status === "ready" && state.environment.eligible ? (
              <Html5RefreshCard environment={state.environment} />
            ) : (
              <p className="placeholder-note">
                Open an eligible SAP BTP Work Zone admin page to refresh HTML5 content.
              </p>
            )}
          </>
        )}
        {activeTab === "about" && <AboutPanel />}
      </main>

      <Footer />
    </div>
  );
}
