'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type RowData = Record<string, string>;

interface ModelRow {
  id: string;
  row_data: RowData;
  is_enabled: boolean;
  sort_order: number;
  sheet_source_id?: string | null;
  sheet_source_name?: string | null;
  sheet_row_number?: number | null;
}

function formatTitleFromKey(key: string) {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function ModelSelectorV2() {
  const router = useRouter();
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [importSheetId, setImportSheetId] = useState('1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA');
  const [importSheetName, setImportSheetName] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSubtitles, setColumnSubtitles] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ column: string | null; direction: 'asc' | 'desc' | null }>({
    column: null,
    direction: null,
  });
  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number; y: number; column: string } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);

  const columnOrderStorageKey = 'cloudhelper.model-selector-v2.column-order';
  const columnSubtitleStorageKey = 'cloudhelper.model-selector-v2.column-subtitles';

  const columns = useMemo(() => {
    const keys = new Set<string>();

    rows.forEach((row) => {
      Object.keys(row.row_data || {}).forEach((key) => keys.add(key));
    });

    const discoveredColumns = Array.from(keys);

    if (columnOrder.length === 0) {
      return discoveredColumns;
    }

    const ordered = columnOrder.filter((column) => keys.has(column));
    const missing = discoveredColumns.filter((column) => !ordered.includes(column));
    return [...ordered, ...missing];
  }, [rows, columnOrder]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      return Object.values(row.row_data || {}).some((value) =>
        String(value || '').toLowerCase().includes(query)
      );
    });
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) {
      return filteredRows;
    }

    const column = sortConfig.column;
    const directionFactor = sortConfig.direction === 'asc' ? 1 : -1;

    return [...filteredRows].sort((a, b) => {
      const rawA = String(a.row_data?.[column] ?? '').trim();
      const rawB = String(b.row_data?.[column] ?? '').trim();

      if (!rawA && !rawB) return 0;
      if (!rawA) return 1;
      if (!rawB) return -1;

      const numericA = Number.parseFloat(rawA.replace(',', '.').replace(/[^0-9.-]/g, ''));
      const numericB = Number.parseFloat(rawB.replace(',', '.').replace(/[^0-9.-]/g, ''));
      const bothNumeric = Number.isFinite(numericA) && Number.isFinite(numericB);

      if (bothNumeric) {
        if (numericA === numericB) return 0;
        return numericA > numericB ? directionFactor : -directionFactor;
      }

      const textA = rawA.toLowerCase();
      const textB = rawB.toLowerCase();
      const comparison = textA.localeCompare(textB);
      return comparison * directionFactor;
    });
  }, [filteredRows, sortConfig]);

  const intelligenceRange = useMemo(() => {
    const values = rows
      .map((row) => {
        const raw = row.row_data?.Intelligence;
        if (!raw) return Number.NaN;
        const normalized = String(raw).replace(',', '.').replace(/[^0-9.-]/g, '');
        return Number.parseFloat(normalized);
      })
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) {
      return { min: 0, max: 0 };
    }

    return { min: Math.min(...values), max: Math.max(...values) };
  }, [rows]);

  const getIntelligenceHeatClass = (column: string, value: string) => {
    if (column.toLowerCase() !== 'intelligence') {
      return '';
    }

    const normalized = String(value || '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const numeric = Number.parseFloat(normalized);

    if (!Number.isFinite(numeric)) {
      return 'bg-gray-950';
    }

    const { min, max } = intelligenceRange;
    if (max <= min) {
      return 'bg-emerald-500/35 border-emerald-300/60 text-white';
    }

    const ratio = (numeric - min) / (max - min);
    if (ratio <= 0.2) return 'bg-red-500/35 border-red-300/60 text-white';
    if (ratio <= 0.4) return 'bg-orange-500/35 border-orange-300/60 text-white';
    if (ratio <= 0.6) return 'bg-yellow-400/35 border-yellow-200/70 text-white';
    if (ratio <= 0.8) return 'bg-lime-400/35 border-lime-200/70 text-white';
    return 'bg-emerald-400/35 border-emerald-200/70 text-white';
  };

  const toggleSort = (column: string) => {
    setSortConfig((current) => {
      if (current.column !== column) {
        return { column, direction: 'asc' };
      }

      if (current.direction === 'asc') {
        return { column, direction: 'desc' };
      }

      if (current.direction === 'desc') {
        return { column: null, direction: null };
      }

      return { column, direction: 'asc' };
    });
  };

  const updateColumnSubtitle = (column: string, subtitle: string) => {
    setColumnSubtitles((current) => ({
      ...current,
      [column]: subtitle,
    }));
  };

  const loadRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/model-selector-v2');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load model selector v2 rows');
      }

      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const persistColumnOrder = (nextOrder: string[]) => {
    setColumnOrder(nextOrder);
    try {
      localStorage.setItem(columnOrderStorageKey, JSON.stringify(nextOrder));
    } catch (error) {
      console.error('Failed to persist column order:', error);
    }
  };

  const moveColumn = (columnName: string, direction: -1 | 1) => {
    const currentIndex = columns.indexOf(columnName);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const nextOrder = [...columns];
    const [movedColumn] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, movedColumn);
    persistColumnOrder(nextOrder);
  };

  const resetColumnOrder = () => {
    persistColumnOrder([]);
    try {
      localStorage.removeItem(columnOrderStorageKey);
    } catch (error) {
      console.error('Failed to reset column order:', error);
    }
  };

  const syncSelectedModelToChat = (modelId: string) => {
    try {
      localStorage.setItem('cloudhelper.selectedModel', modelId);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'cloudhelper.selectedModel',
        newValue: modelId,
      }));
      window.dispatchEvent(new CustomEvent('cloudhelper:model-change', { detail: modelId }));
    } catch (error) {
      console.error('Failed to sync selected model:', error);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      await loadRows();

      try {
        const savedColumnOrder = localStorage.getItem(columnOrderStorageKey);
        if (savedColumnOrder) {
          setColumnOrder(JSON.parse(savedColumnOrder));
        }

        const savedColumnSubtitles = localStorage.getItem(columnSubtitleStorageKey);
        if (savedColumnSubtitles) {
          setColumnSubtitles(JSON.parse(savedColumnSubtitles));
        }
      } catch (error) {
        console.error('Failed to load column order:', error);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (columns.length === 0) return;

    if (columnOrder.length === 0) {
      return;
    }

    const availableColumns = new Set(columns);
    const ordered = columnOrder.filter((column) => availableColumns.has(column));
    const missing = columns.filter((column) => !ordered.includes(column));

    const normalizedOrder = [...ordered, ...missing];
    if (normalizedOrder.join('|') !== columnOrder.join('|')) {
      setColumnOrder(normalizedOrder);
      try {
        localStorage.setItem(columnOrderStorageKey, JSON.stringify(normalizedOrder));
      } catch (error) {
        console.error('Failed to normalize column order:', error);
      }
    }
  }, [columns]);

  useEffect(() => {
    if (columnOrder.length === 0) return;

    try {
      localStorage.setItem(columnOrderStorageKey, JSON.stringify(columnOrder));
    } catch (error) {
      console.error('Failed to persist column order:', error);
    }
  }, [columnOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(columnSubtitleStorageKey, JSON.stringify(columnSubtitles));
    } catch (error) {
      console.error('Failed to persist column subtitles:', error);
    }
  }, [columnSubtitles]);

  useEffect(() => {
    const intelligenceColumn = columns.find((column) => column.toLowerCase() === 'intelligence');
    if (!intelligenceColumn) return;

    setColumnSubtitles((current) => {
      if (Object.prototype.hasOwnProperty.call(current, intelligenceColumn)) {
        return current;
      }

      return {
        ...current,
        [intelligenceColumn]: 'artificialanalysis.ai',
      };
    });
  }, [columns]);

  useEffect(() => {
    const tableScroll = tableScrollRef.current;
    const bottomScroll = bottomScrollRef.current;

    if (!tableScroll || !bottomScroll) return;

    const syncBottomWidth = () => {
      const track = bottomScroll.firstElementChild as HTMLElement | null;
      if (track) {
        track.style.width = `${tableScroll.scrollWidth}px`;
      }
    };

    const handleTableScroll = () => {
      if (bottomScroll.scrollLeft !== tableScroll.scrollLeft) {
        bottomScroll.scrollLeft = tableScroll.scrollLeft;
      }
    };

    const handleBottomScroll = () => {
      if (tableScroll.scrollLeft !== bottomScroll.scrollLeft) {
        tableScroll.scrollLeft = bottomScroll.scrollLeft;
      }
    };

    syncBottomWidth();
    handleTableScroll();

    tableScroll.addEventListener('scroll', handleTableScroll, { passive: true });
    bottomScroll.addEventListener('scroll', handleBottomScroll, { passive: true });
    window.addEventListener('resize', syncBottomWidth);

    const observer = new ResizeObserver(syncBottomWidth);
    observer.observe(tableScroll);

    return () => {
      tableScroll.removeEventListener('scroll', handleTableScroll);
      bottomScroll.removeEventListener('scroll', handleBottomScroll);
      window.removeEventListener('resize', syncBottomWidth);
      observer.disconnect();
    };
  }, [columns, rows.length]);

  const updateRowLocal = (rowId: string, key: string, value: string) => {
    setRows((current) => current.map((row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        row_data: {
          ...(row.row_data || {}),
          [key]: value,
        },
      };
    }));
  };

  const saveRow = async (row: ModelRow) => {
    setSavingId(row.id);
    setError(null);

    try {
      const response = await fetch('/api/model-selector-v2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          rowData: row.row_data,
          isEnabled: row.is_enabled,
          sortOrder: row.sort_order,
          sheetSourceId: row.sheet_source_id,
          sheetSourceName: row.sheet_source_name,
          sheetRowNumber: row.sheet_row_number,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save row');
      }

      setRows((current) => current.map((currentRow) => (currentRow.id === row.id ? data.row : currentRow)));
      setStatus('Saved row');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const selectForChat = (row: ModelRow) => {
    const modelId = row.row_data?.Model?.trim();
    if (!modelId) {
      setError('This row does not have a usable Model value yet. Fill the Model column first.');
      return;
    }

    syncSelectedModelToChat(modelId);
    setStatus(`Selected ${modelId} for the main chat`);
    router.push('/chat');
  };

  const addRow = async () => {
    const modelValue = window.prompt('Model value for the new row', `row-${rows.length + 1}`) || '';

    setError(null);

    try {
      const response = await fetch('/api/model-selector-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          rowData: { Model: modelValue },
          sortOrder: rows.length,
          isEnabled: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create row');
      }

      setRows((current) => [...current, data.row]);
      setStatus('Added row');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addColumn = async () => {
    const name = (newColumnName || window.prompt('New column name') || '').trim();
    if (!name) return;

    await createColumn(name);
  };

  const createColumn = async (columnName: string, rightOfColumn?: string) => {
    const name = columnName.trim();
    if (!name) return;

    setError(null);

    try {
      const response = await fetch('/api/model-selector-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addColumn',
          columnName: name,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add column');
      }

      setRows((current) => current.map((row) => ({
        ...row,
        row_data: {
          ...(row.row_data || {}),
          [name]: row.row_data?.[name] ?? '',
        },
      })));

      if (rightOfColumn) {
        const currentColumns = [...columns];
        const anchorIndex = currentColumns.indexOf(rightOfColumn);
        if (anchorIndex !== -1) {
          const withInsertion = [...currentColumns];
          withInsertion.splice(anchorIndex + 1, 0, name);
          const deduped = Array.from(new Set(withInsertion));
          persistColumnOrder(deduped);
        }
      }

      setNewColumnName('');
      setStatus(`Added column ${name}`);
      setHeaderContextMenu(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const closeContextMenu = () => setHeaderContextMenu(null);
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('resize', closeContextMenu);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('resize', closeContextMenu);
    };
  }, []);

  const deleteRow = async (rowId: string) => {
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;

    const modelName = row.row_data?.Model?.trim() || 'this row';
    if (!window.confirm(`Delete ${modelName}?`)) return;

    setError(null);

    try {
      const response = await fetch(`/api/model-selector-v2?id=${encodeURIComponent(rowId)}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete row');
      }

      setRows((current) => current.filter((item) => item.id !== rowId));
      setStatus(`Deleted ${modelName}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const importFromSheet = async () => {
    setError(null);
    setStatus('Importing sheet...');

    try {
      const response = await fetch('/api/model-selector-v2/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId: importSheetId.trim(),
          sheetName: importSheetName.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import sheet');
      }

      setStatus(`Imported ${data.importedRows} rows from ${data.sheetName}`);
      await loadRows();
    } catch (err: any) {
      setError(err.message);
      setStatus(null);
    }
  };

  const createBackup = async (reason: string) => {
    setError(null);
    setStatus('Creating backup...');

    try {
      const response = await fetch('/api/model-selector-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createBackup', reason }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create backup');
      }

      setStatus(`Backup saved (${data.backup?.rowCount ?? rows.length} rows)`);
      return true;
    } catch (err: any) {
      setError(err.message);
      setStatus(null);
      return false;
    }
  };

  const restoreBackup = async () => {
    if (!window.confirm('Go back to the last backup? This will replace current rows.')) {
      return;
    }

    setError(null);
    setStatus('Restoring backup...');

    try {
      const response = await fetch('/api/model-selector-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restoreBackup' }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to restore backup');
      }

      setStatus(`Restored ${data.restoredRows ?? 0} rows from backup`);
      await loadRows();
    } catch (err: any) {
      setError(err.message);
      setStatus(null);
    }
  };

  const resetAllRows = async () => {
    const typed = window.prompt('Type RESET to delete all current rows');
    if (typed !== 'RESET') {
      return;
    }

    const backedUp = await createBackup('pre-reset');
    if (!backedUp) {
      return;
    }

    setError(null);
    setStatus('Resetting rows...');

    try {
      const response = await fetch('/api/model-selector-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resetAll' }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset rows');
      }

      setStatus('All rows deleted. Use "Go Back" to restore last backup if needed.');
      await loadRows();
    } catch (err: any) {
      setError(err.message);
      setStatus(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-semibold">Model Selector v2</h1>
              <p className="text-sm font-medium text-amber-300">Don't act like every model is the same!</p>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Spreadsheet-style model catalog backed by Supabase. The current selector stays unchanged.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={importSheetId}
              onChange={(event) => setImportSheetId(event.target.value)}
              placeholder="Google Sheet ID"
              className="min-w-[260px] rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
            />
            <input
              value={importSheetName}
              onChange={(event) => setImportSheetName(event.target.value)}
              placeholder="Tab name (optional)"
              className="min-w-[200px] rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
            />
            <button
              onClick={importFromSheet}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Import once from Sheet
            </button>
            <button
              onClick={addRow}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Add row
            </button>
            <button
              onClick={resetColumnOrder}
              className="rounded border border-gray-700 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-800"
            >
              Reset column order
            </button>
            <button
              onClick={() => createBackup('manual')}
              className="rounded border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
            >
              Backup now
            </button>
            <button
              onClick={restoreBackup}
              className="rounded border border-yellow-500/40 bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-200 hover:bg-yellow-500/30"
            >
              Go Back
            </button>
            <button
              onClick={resetAllRows}
              className="rounded border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30"
            >
              Reset all rows
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search rows"
              className="min-w-[220px] rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
            />
            <input
              value={newColumnName}
              onChange={(event) => setNewColumnName(event.target.value)}
              placeholder="New column name"
              className="min-w-[240px] rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
            />
            <button
              onClick={addColumn}
              className="rounded border border-gray-700 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-800"
            >
              Add column
            </button>
          </div>

          <div className="text-sm text-gray-400">
            {loading ? 'Loading rows...' : `${filteredRows.length}/${rows.length} rows`}
            {savingId ? ` · Saving ${savingId}` : ''}
          </div>
        </div>

        {status && <div className="mt-3 text-sm text-emerald-400">{status}</div>}
        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
      </div>

      <div ref={tableScrollRef} className="overflow-auto px-4 pb-24 pt-4 sm:px-6 sm:pb-24 lg:px-8 lg:pb-24">
        <div className="min-w-max rounded-lg border border-gray-800 bg-gray-900 shadow-2xl shadow-black/20">
          <table className="border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-400">
                <th className="border-r border-gray-800 px-3 py-3">Row</th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="border-r border-gray-800 px-3 py-3"
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setHeaderContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        column,
                      });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{formatTitleFromKey(column) || column}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleSort(column)}
                          className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300 hover:bg-gray-800"
                          aria-label={`Sort by ${column}`}
                          title={
                            sortConfig.column === column && sortConfig.direction
                              ? `Sorted ${sortConfig.direction}`
                              : 'Sort'
                          }
                        >
                          {sortConfig.column === column && sortConfig.direction === 'asc' && '↑'}
                          {sortConfig.column === column && sortConfig.direction === 'desc' && '↓'}
                          {!(sortConfig.column === column && sortConfig.direction) && '⇅'}
                        </button>
                        <button
                          onClick={() => moveColumn(column, -1)}
                          className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300 hover:bg-gray-800"
                          aria-label={`Move ${column} left`}
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveColumn(column, 1)}
                          className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300 hover:bg-gray-800"
                          aria-label={`Move ${column} right`}
                        >
                          →
                        </button>
                      </div>
                    </div>
                    <input
                      value={columnSubtitles[column] ?? ''}
                      onChange={(event) => updateColumnSubtitle(column, event.target.value)}
                      placeholder=""
                      className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-1.5 py-0.5 text-[10px] font-normal normal-case text-gray-300 outline-none placeholder:text-gray-600"
                      aria-label={`Subtitle for ${column}`}
                    />
                  </th>
                ))}
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => (
                <tr key={row.id} className="border-t border-gray-800 align-top hover:bg-gray-800/40">
                  <td className="w-16 border-r border-gray-800 px-3 py-2 text-xs text-gray-500">{index + 1}</td>
                  {columns.map((column) => (
                    <td key={column} className="min-w-[180px] border-r border-gray-800 px-2 py-2">
                      <input
                        value={row.row_data?.[column] ?? ''}
                        onChange={(event) => updateRowLocal(row.id, column, event.target.value)}
                        onBlur={() => saveRow({
                          ...row,
                          row_data: {
                            ...(row.row_data || {}),
                            [column]: row.row_data?.[column] ?? '',
                          },
                        })}
                        className={`w-full rounded border border-gray-700 px-2 py-1 text-sm text-white outline-none ${getIntelligenceHeatClass(column, row.row_data?.[column] ?? '')}`}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      onClick={() => selectForChat(row)}
                      className="mr-2 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      Use in chat
                    </button>
                    <button
                      onClick={() => saveRow(row)}
                      className="mr-2 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && sortedRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-sm text-gray-500">
                    {rows.length === 0
                      ? 'No rows yet. Import your Google Sheet once, then edit directly here.'
                      : 'No rows match your search filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-gray-950/95 px-4 py-2 backdrop-blur sm:px-6 lg:px-8">
        <div
          ref={bottomScrollRef}
          className="overflow-x-auto overflow-y-hidden rounded-md border border-gray-800 bg-gray-900"
          style={{ scrollbarGutter: 'stable both-edges' }}
        >
          <div style={{ height: 1 }} />
        </div>
      </div>

      {headerContextMenu && (
        <div
          className="fixed z-50 min-w-[220px] rounded-md border border-gray-700 bg-gray-900 p-1 shadow-2xl"
          style={{ left: headerContextMenu.x, top: headerContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="w-full rounded px-3 py-2 text-left text-sm text-gray-100 hover:bg-gray-800"
            onClick={async () => {
              const name = window.prompt(`New column to add right of ${headerContextMenu.column}`) || '';
              await createColumn(name, headerContextMenu.column);
            }}
          >
            Add column on right
          </button>
        </div>
      )}
    </div>
  );
}