import { useState } from "react";
import { AboutPanel } from "./components/AboutPanel";
import { AppHeader } from "./components/AppHeader";
import { ConnectionCard } from "./components/ConnectionCard";
import { Footer } from "./components/Footer";
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
            <p className="placeholder-note">
              App scanning and UI5 version updates arrive in a later phase.
            </p>
          </>
        )}
        {activeTab === "html5" && (
          <p className="placeholder-note">HTML5 content refresh arrives in a later phase.</p>
        )}
        {activeTab === "about" && <AboutPanel />}
      </main>

      <Footer />
    </div>
  );
}
