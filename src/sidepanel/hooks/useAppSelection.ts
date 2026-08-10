import { useCallback, useState } from "react";
import { clearSelection, isSelected, subtractSelection, toggleSelection, unionSelection } from "../../domain/selection";

export function useAppSelection(): {
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  selectVisible: (visibleIds: readonly string[]) => void;
  deselectVisible: (visibleIds: readonly string[]) => void;
  clear: () => void;
  isRowSelected: (id: string) => boolean;
} {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((current) => toggleSelection(current, id));
  }, []);

  const selectVisible = useCallback((visibleIds: readonly string[]) => {
    setSelected((current) => unionSelection(current, visibleIds));
  }, []);

  const deselectVisible = useCallback((visibleIds: readonly string[]) => {
    setSelected((current) => subtractSelection(current, visibleIds));
  }, []);

  const clear = useCallback(() => {
    setSelected(clearSelection());
  }, []);

  const isRowSelected = useCallback((id: string) => isSelected(selected, id), [selected]);

  return { selected, toggle, selectVisible, deselectVisible, clear, isRowSelected };
}
