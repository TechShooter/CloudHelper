'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';

const HIDDEN_COLS_KEY = 'cloudhelper.model-selector-v3.hidden-columns';
const COL_ORDER_KEY = 'cloudhelper.model-selector-v3.column-order';

interface CellMeta {
  backgroundColor?: { red: number; green: number; blue: number } | null;
  hyperlink?: string | null;
}

interface ModelSelectorV3Props {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

function parseNumeric(raw: string): number {
  const n = Number.parseFloat(raw.replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function rgbToBg(c: { red: number; green: number; blue: number }): string {
  const r = Math.round(c.red * 255);
  const g = Math.round(c.green * 255);
  const b = Math.round(c.blue * 255);
  const brightness = (r * 299 + g * 587 + b * 114) / 255000;
  const alpha = brightness < 0.08 || brightness > 0.92 ? 0.3 : 0.6;
  return `rgba(${r},${g},${b},${alpha})`;
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export default function ModelSelectorV3({ selectedModel, onModelSelect }: ModelSelectorV3Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [cellMetas, setCellMetas] = useState<Record<string, CellMeta>[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ column: string | null; direction: 'asc' | 'desc' | null }>({
    column: null,
    direction: null,
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/model-selector-v3');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch model data');
        }

        setHeaders(data.headers || []);
        setRows(data.rows || []);
        setCellMetas(data.cellMetas || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    try {
      const saved = localStorage.getItem(HIDDEN_COLS_KEY);
      if (saved) setHiddenColumns(new Set(JSON.parse(saved)));
      const savedOrder = localStorage.getItem(COL_ORDER_KEY);
      if (savedOrder) setColumnOrder(JSON.parse(savedOrder));
    } catch {
      // ignore
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify([...hiddenColumns]));
    } catch {
      // ignore
    }
  }, [hiddenColumns, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(COL_ORDER_KEY, JSON.stringify(columnOrder));
    } catch {
      // ignore
    }
  }, [columnOrder, isOpen]);

  const orderedHeaders = useMemo(() => {
    if (columnOrder.length === 0) return headers;
    const ordered = columnOrder.filter((h) => headers.includes(h));
    const remaining = headers.filter((h) => !ordered.includes(h));
    return [...ordered, ...remaining];
  }, [headers, columnOrder]);

  const nonEmptyHeaders = useMemo(() => headers.filter((h) => h), [headers]);

  const visibleHeaders = useMemo(
    () => orderedHeaders.filter((h) => h && !hiddenColumns.has(h)),
    [orderedHeaders, hiddenColumns],
  );

  const linkColumns = useMemo(() => {
    const set = new Set<string>();
    if (!rows.length) return set;
    for (const h of visibleHeaders) {
      const urlCount = rows.filter((r) => isUrl(r[h] ?? '')).length;
      if (urlCount > rows.length * 0.3) set.add(h);
    }
    return set;
  }, [visibleHeaders, rows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      Object.values(row).some((val) => String(val || '').toLowerCase().includes(query)),
    );
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) return filteredRows;
    const col = sortConfig.column;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const ra = String(a[col] ?? '').trim();
      const rb = String(b[col] ?? '').trim();
      if (!ra && !rb) return 0;
      if (!ra) return 1;
      if (!rb) return -1;
      const na = parseNumeric(ra);
      const nb = parseNumeric(rb);
      if (Number.isFinite(na) && Number.isFinite(nb)) {
        if (na === nb) return 0;
        return na > nb ? dir : -dir;
      }
      return ra.toLowerCase().localeCompare(rb.toLowerCase()) * dir;
    });
  }, [filteredRows, sortConfig]);

  const intelligenceRange = useMemo(() => {
    const values = rows
      .map((r) => {
        const raw = r.Intelligence ?? r.intelligence ?? '';
        return parseNumeric(raw);
      })
      .filter((v) => Number.isFinite(v));
    if (!values.length) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [rows]);

  const getIntelligenceClass = (value: string) => {
    const n = parseNumeric(value);
    if (!Number.isFinite(n)) return '';
    const { min, max } = intelligenceRange;
    if (max <= min) return 'bg-emerald-500/55 border-emerald-300 text-white font-medium';
    const ratio = (n - min) / (max - min);
    if (ratio <= 0.2) return 'bg-red-500/55 border-red-300 text-white font-medium';
    if (ratio <= 0.4) return 'bg-orange-500/55 border-orange-300 text-white font-medium';
    if (ratio <= 0.6) return 'bg-yellow-400/50 border-yellow-200 text-white font-medium';
    if (ratio <= 0.8) return 'bg-lime-400/50 border-lime-200 text-white font-medium';
    return 'bg-emerald-400/50 border-emerald-200 text-white font-medium';
  };

  const toggleSort = (column: string) => {
    setSortConfig((c) => {
      if (c.column !== column) return { column, direction: 'asc' };
      if (c.direction === 'asc') return { column, direction: 'desc' };
      if (c.direction === 'desc') return { column: null, direction: null };
      return { column, direction: 'asc' };
    });
  };

  const moveColumn = (name: string, dir: -1 | 1) => {
    const idx = visibleHeaders.indexOf(name);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= visibleHeaders.length) return;
    const next = [...visibleHeaders];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setColumnOrder(next);
  };

  const resetColumnOrder = () => {
    setColumnOrder([]);
    try {
      localStorage.removeItem(COL_ORDER_KEY);
    } catch {
      // ignore
    }
  };

  const toggleColumn = (header: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      return next;
    });
  };

  const getCellStyle = (header: string, rowIdx: number, value: string): { className: string; style?: React.CSSProperties } => {
    const isIntelligence = header.toLowerCase() === 'intelligence';
    const meta = cellMetas[rowIdx]?.[header];

    if (meta?.backgroundColor && !isIntelligence) {
      return {
        className: '',
        style: { backgroundColor: rgbToBg(meta.backgroundColor) },
      };
    }

    if (isIntelligence) {
      return { className: getIntelligenceClass(value) };
    }

    return { className: '' };
  };

  const renderCellValue = useCallback((header: string, value: string) => {
    const url = value.trim();
    if (linkColumns.has(header) && isUrl(url)) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-gray-700/60 hover:text-gray-200"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      );
    }
    return <span className="text-gray-200">{value}</span>;
  }, [linkColumns]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-purple-500 hover:shadow-xl hover:shadow-indigo-600/30 active:scale-[0.97] sm:px-4 sm:py-2 sm:text-sm"
      >
        Compare
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex w-full max-w-[95vw] flex-col overflow-hidden rounded-xl border border-gray-700/50 bg-gradient-to-b from-gray-850 to-gray-900 shadow-2xl sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[90vw] xl:max-w-[88vw]" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between border-b border-gray-700/40 px-4 py-3 sm:px-6">
              <h3 className="text-base font-bold text-white sm:text-lg">
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Model</span>
                {' '}Selector
              </h3>
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-700/50 hover:text-gray-200 sm:h-8 sm:w-8"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 sm:mx-6">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-b border-gray-700/30 px-4 py-3 sm:px-6">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="min-w-0 flex-1 rounded-lg border border-gray-600/50 bg-gray-800/60 px-3 py-2 text-sm text-white outline-none transition-all placeholder:text-gray-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="relative">
                <button
                  onClick={() => setShowColumnMenu((prev) => !prev)}
                  className="rounded-lg border border-gray-600/50 bg-gray-800/60 px-3 py-2 text-sm text-gray-300 transition-all hover:border-gray-500/50 hover:bg-gray-700/60"
                >
                  Columns {hiddenColumns.size > 0 && `(${nonEmptyHeaders.length - visibleHeaders.length} hidden)`}
                </button>
                {showColumnMenu && (
                  <div className="absolute right-0 top-full z-30 mt-1 max-h-64 min-w-[200px] overflow-auto rounded-lg border border-gray-600/50 bg-gray-800/95 p-2 shadow-2xl backdrop-blur-sm">
                    {nonEmptyHeaders.map((header) => (
                      <label
                        key={header}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-700/60"
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenColumns.has(header)}
                          onChange={() => toggleColumn(header)}
                          className="accent-indigo-500"
                        />
                        {header}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={resetColumnOrder}
                className="rounded-lg border border-gray-600/50 bg-gray-800/60 px-3 py-2 text-sm text-gray-400 transition-all hover:border-gray-500/50 hover:bg-gray-700/60"
                title="Reset column order"
              >
                ↺
              </button>
            </div>

            {loading && (
              <div className="flex flex-1 items-center justify-center text-gray-400">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
                  <span className="text-sm">Loading model data...</span>
                </div>
              </div>
            )}

            {!loading && !error && (
              <div className="min-h-0 flex-1 overflow-auto rounded-b-lg scrollbar-thick">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="sticky top-0 z-10">
                      <th className="sticky left-0 z-20 border-r border-gray-700 bg-gray-900 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
                        #
                      </th>
                      {visibleHeaders.map((header, idx) => (
                        <th
                          key={header || `hdr-${idx}`}
                          className="whitespace-pre-wrap border-r border-gray-700 bg-gray-900 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-400"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="whitespace-pre-wrap leading-tight">{header}</span>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleColumn(header); }}
                                className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-gray-500 transition-colors hover:bg-gray-700/60 hover:text-gray-200"
                                title="Hide column"
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                              </button>
                              <button
                                onClick={() => toggleSort(header)}
                                className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-gray-500 transition-colors hover:bg-gray-700/60 hover:text-gray-200"
                                title={
                                  sortConfig.column === header && sortConfig.direction
                                    ? `Sorted ${sortConfig.direction}`
                                    : 'Sort'
                                }
                              >
                                {sortConfig.column === header && sortConfig.direction === 'asc' && (
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l-7 7h14l-7-7z"/></svg>
                                )}
                                {sortConfig.column === header && sortConfig.direction === 'desc' && (
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7H5l7 7z"/></svg>
                                )}
                                {!(sortConfig.column === header && sortConfig.direction) && (
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3l-4 4h8l-4-4z"/><path d="M8 21l-4-4h8l-4 4z"/></svg>
                                )}
                              </button>
                              <button
                                onClick={() => moveColumn(header, -1)}
                                className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-gray-500 transition-colors hover:bg-gray-700/60 hover:text-gray-200"
                                title="Move left"
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                              </button>
                              <button
                                onClick={() => moveColumn(header, 1)}
                                className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-gray-500 transition-colors hover:bg-gray-700/60 hover:text-gray-200"
                                title="Move right"
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.length === 0 ? (
                      <tr>
                        <td colSpan={visibleHeaders.length + 1} className="px-4 py-16 text-center text-sm text-gray-500">
                          No models match your search
                        </td>
                      </tr>
                    ) : (
                      sortedRows.map((row, rowIndex) => {
                        const modelId = row.Model || row.Name || `model-${rowIndex}`;
                        const isSelected = row.Model === selectedModel || row.Name === selectedModel;
                        const originalIndex = rows.indexOf(row);

                        return (
                          <tr
                            key={rowIndex}
                            onClick={() => {
                              onModelSelect(modelId);
                              setIsOpen(false);
                            }}
                            className={`border-t border-gray-700/20 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-600/20 hover:bg-indigo-600/30'
                                : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            <td className="sticky left-0 z-10 border-r border-gray-700 bg-gray-900 px-3 py-2.5 text-center text-xs text-gray-500">
                              {rowIndex + 1}
                            </td>
                            {visibleHeaders.map((header, ci) => {
                              const value = row[header] || '';
                              const cellStyle = getCellStyle(header, originalIndex, value);
                              return (
                                <td
                                  key={header || `td-${ci}`}
                                  className={`border-r border-gray-700/20 px-3 py-2.5 text-center whitespace-pre-wrap ${cellStyle.className}`}
                                  style={cellStyle.style}
                                >
                                  {renderCellValue(header, value)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
