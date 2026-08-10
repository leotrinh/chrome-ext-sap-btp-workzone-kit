const UI5_VERSION_OVERVIEW_URL = "https://ui5.sap.com/versionoverview.json";

export interface Ui5VersionPatch {
  version: string;
  eocp: string;
}

export interface Ui5VersionCatalog {
  activeVersion: string;
  patches: Ui5VersionPatch[];
}

export interface Ui5VersionMinorGroup {
  minorVersion: string;
  patches: Ui5VersionPatch[];
}

export type FetchUi5CatalogResult = { ok: true; catalog: Ui5VersionCatalog } | { ok: false; error: string };

function isUi5VersionPatch(entry: unknown): entry is Ui5VersionPatch {
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof (entry as Record<string, unknown>).version === "string" &&
    typeof (entry as Record<string, unknown>).eocp === "string"
  );
}

function parseUi5VersionCatalog(body: unknown): Ui5VersionCatalog | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.activeVersion !== "string" || !Array.isArray(candidate.patches)) {
    return null;
  }
  return {
    activeVersion: candidate.activeVersion,
    patches: candidate.patches.filter(isUi5VersionPatch),
  };
}

/**
 * Fetches SAP's public, unauthenticated UI5 version/patch list — used only to power
 * the "quick pick a UI5 version" combobox and overview modal in the side panel. No SAP
 * tenant data, session, or credentials are ever sent (credentials: "omit"); this is a
 * plain read of a public JSON file, unrelated to the SAP Work Zone session flow.
 */
export async function fetchUi5VersionCatalog(): Promise<FetchUi5CatalogResult> {
  let response: Response;
  try {
    response = await fetch(UI5_VERSION_OVERVIEW_URL, { credentials: "omit" });
  } catch {
    return { ok: false, error: "Network error while fetching the UI5 version list." };
  }

  if (!response.ok) {
    return { ok: false, error: `ui5.sap.com returned HTTP ${response.status}.` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "UI5 version list response was not valid JSON." };
  }

  const catalog = parseUi5VersionCatalog(body);
  if (!catalog) {
    return { ok: false, error: "UI5 version list response had an unexpected shape." };
  }

  return { ok: true, catalog };
}

function compareVersionStrings(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function minorVersionOf(version: string): string {
  const [major, minor] = version.split(".");
  return major !== undefined && minor !== undefined ? `${major}.${minor}` : version;
}

/** Groups flat patches (e.g. "1.151.0") by major.minor (e.g. "1.151"), each group and
 * its patches sorted newest-first — matches SAP's own versionoverview.html layout. */
export function groupPatchesByMinor(patches: readonly Ui5VersionPatch[]): Ui5VersionMinorGroup[] {
  const groups = new Map<string, Ui5VersionPatch[]>();
  for (const patch of patches) {
    const minor = minorVersionOf(patch.version);
    const list = groups.get(minor);
    if (list) {
      list.push(patch);
    } else {
      groups.set(minor, [patch]);
    }
  }

  return Array.from(groups.entries())
    .map(([minorVersion, groupPatches]) => ({
      minorVersion,
      patches: [...groupPatches].sort((a, b) => compareVersionStrings(b.version, a.version)),
    }))
    .sort((a, b) => compareVersionStrings(b.minorVersion, a.minorVersion));
}

export function filterUi5Patches(patches: readonly Ui5VersionPatch[], query: string): Ui5VersionPatch[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [...patches];
  }
  return patches.filter((patch) => patch.version.toLowerCase().includes(trimmed));
}
