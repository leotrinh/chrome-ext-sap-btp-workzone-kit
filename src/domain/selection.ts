/**
 * All functions are pure Set operations keyed by app id (never DOM/row index — the
 * blueprint's explicit fix for the source userscript's checkbox-index-based state,
 * which broke under search/sort). Filtering-awareness (visible vs. all loaded) is the
 * caller's responsibility: pass only the currently-visible ids to `unionSelection` for
 * "select all visible", or the full loaded id list for "select all loaded".
 */

export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/** "Select all visible" / "select all loaded" — adds ids, preserves existing selection. */
export function unionSelection(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    next.add(id);
  }
  return next;
}

/** Deselects only the given ids (e.g. "clear visible"), leaving the rest untouched. */
export function subtractSelection(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    next.delete(id);
  }
  return next;
}

export function clearSelection(): Set<string> {
  return new Set();
}

export function isSelected(selected: ReadonlySet<string>, id: string): boolean {
  return selected.has(id);
}
