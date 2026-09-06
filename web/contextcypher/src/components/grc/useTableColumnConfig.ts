import { useCallback, useMemo } from 'react';
import { GrcWorkspace, TableColumnConfig } from '../../types/GrcTypes';
import { getConfig } from '../../services/GrcWorkspaceService';

export interface ColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
  removable: boolean;
  width?: number | string;
}

export function useTableColumnConfig(
  tableKey: string,
  allColumnDefs: ColumnDef[],
  workspace: GrcWorkspace,
  applyWorkspace: (ws: GrcWorkspace) => void
) {
  const config = getConfig(workspace);
  const stored: TableColumnConfig | undefined = config.tableColumns?.[tableKey];

  const defaultVisibleIds = useMemo(
    () => allColumnDefs.filter(c => c.defaultVisible).map(c => c.id),
    [allColumnDefs]
  );

  const visibleIds = useMemo(() => {
    if (!stored?.visibleColumnIds?.length) return defaultVisibleIds;
    const knownIds = new Set(allColumnDefs.map(c => c.id));
    return stored.visibleColumnIds.filter(id => knownIds.has(id));
  }, [stored, defaultVisibleIds, allColumnDefs]);

  const visibleColumns = useMemo(
    () => visibleIds.map(id => allColumnDefs.find(c => c.id === id)!).filter(Boolean),
    [visibleIds, allColumnDefs]
  );

  const persist = useCallback((nextIds: string[]) => {
    const now = new Date().toISOString();
    const nextTableColumns = { ...(config.tableColumns || {}), [tableKey]: { visibleColumnIds: nextIds } };
    applyWorkspace({
      ...workspace,
      config: { ...config, tableColumns: nextTableColumns },
      updatedAt: now
    });
  }, [applyWorkspace, config, tableKey, workspace]);

  const toggleColumn = useCallback((columnId: string) => {
    const col = allColumnDefs.find(c => c.id === columnId);
    if (!col || !col.removable) return;
    const current = [...visibleIds];
    const idx = current.indexOf(columnId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(columnId);
    }
    persist(current);
  }, [allColumnDefs, persist, visibleIds]);

  const moveColumn = useCallback((columnId: string, direction: 'left' | 'right') => {
    const current = [...visibleIds];
    const idx = current.indexOf(columnId);
    if (idx < 0) return;
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= current.length) return;
    [current[idx], current[swapIdx]] = [current[swapIdx], current[idx]];
    persist(current);
  }, [persist, visibleIds]);

  const resetToDefaults = useCallback(() => {
    persist(defaultVisibleIds);
  }, [defaultVisibleIds, persist]);

  return {
    visibleColumns,
    allColumns: allColumnDefs,
    visibleIds,
    moveColumn,
    toggleColumn,
    resetToDefaults
  };
}
