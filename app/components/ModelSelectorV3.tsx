'use client';

import { useEffect, useMemo, useState } from 'react';

const HIDDEN_COLS_KEY = 'cloudhelper.model-selector-v3.hidden-columns';

interface ModelSelectorV3Props {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

export default function ModelSelectorV3({ selectedModel, onModelSelect }: ModelSelectorV3Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);

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
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    try {
      const saved = localStorage.getItem(HIDDEN_COLS_KEY);
      if (saved) {
        setHiddenColumns(new Set(JSON.parse(saved)));
      }
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

  const visibleHeaders = useMemo(
    () => headers.filter((h) => !hiddenColumns.has(h)),
    [headers, hiddenColumns],
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      Object.values(row).some((val) => String(val || '').toLowerCase().includes(query)),
    );
  }, [rows, searchQuery]);

  const toggleColumn = (header: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(header)) {
        next.delete(header);
      } else {
        next.add(header);
      }
      return next;
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
      >
        Compare
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Model Selector v3</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded bg-red-500/20 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mb-4 flex items-center gap-3">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="flex-1 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
              />
              <div className="relative">
                <button
                  onClick={() => setShowColumnMenu((prev) => !prev)}
                  className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Columns {hiddenColumns.size > 0 && `(${headers.length - visibleHeaders.length} hidden)`}
                </button>
                {showColumnMenu && (
                  <div className="absolute right-0 top-full z-30 mt-1 max-h-64 min-w-[200px] overflow-auto rounded border border-gray-700 bg-gray-900 p-2 shadow-2xl">
                    {headers.map((header) => (
                      <label
                        key={header}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-200 hover:bg-gray-800"
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
            </div>

            {loading && (
              <div className="flex items-center justify-center py-20 text-gray-400">
                Loading model data...
              </div>
            )}

            {!loading && !error && (
              <div className="flex-1 overflow-auto rounded border border-gray-700">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-gray-900">
                      <th className="sticky left-0 z-20 bg-gray-900 border-r border-gray-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        #
                      </th>
                      {visibleHeaders.map((header) => (
                        <th
                          key={header}
                          className="whitespace-nowrap border-r border-gray-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={visibleHeaders.length + 1} className="px-4 py-12 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, rowIndex) => {
                        const modelId = row.Model || row.Name || `model-${rowIndex}`;
                        const isSelected = row.Model === selectedModel || row.Name === selectedModel;

                        return (
                          <tr
                            key={rowIndex}
                            onClick={() => {
                              onModelSelect(modelId);
                              setIsOpen(false);
                            }}
                            className={`border-t border-gray-700 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-600/30 hover:bg-indigo-600/40'
                                : 'hover:bg-gray-700/50'
                            }`}
                          >
                            <td className="sticky left-0 z-10 bg-gray-800 border-r border-gray-700 px-3 py-2 text-gray-500">
                              {rowIndex + 1}
                            </td>
                            {visibleHeaders.map((header) => (
                              <td
                                key={header}
                                className="border-r border-gray-700 px-3 py-2 text-gray-200 whitespace-nowrap"
                              >
                                {row[header] || ''}
                              </td>
                            ))}
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
