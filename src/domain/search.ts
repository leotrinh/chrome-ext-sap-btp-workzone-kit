export interface SearchableApp {
  title: string;
  currentVersionText?: string | null;
}

/**
 * Blueprint §3.8: search matches app title OR current UI5 config text
 * (including "N/A"/"Mixed"/"Error" badge text), case-insensitive.
 */
export function matchesSearch(app: SearchableApp, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const title = app.title.toLowerCase();
  const versionText = (app.currentVersionText ?? "").toLowerCase();
  return title.includes(normalizedQuery) || versionText.includes(normalizedQuery);
}
