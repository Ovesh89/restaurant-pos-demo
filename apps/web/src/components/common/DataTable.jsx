import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Pagination } from './Pagination.jsx';
import { useTranslation } from '../../hooks/useTranslation';

export const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = null,
  pagination = null,
  onPageChange = null,
  onPageSizeChange = null,
  pageSizeOptions = [10, 20, 50, 100],
  sortConfig = null,
  onSort = null,
  defaultSortKey = null,
  defaultSortDirection = 'asc',
}) => {
  const { t } = useTranslation();
  const defaultEmptyMsg = emptyMessage || t('common.noRecords', null, 'No records found.');

  const [internalSort, setInternalSort] = useState({
    key: defaultSortKey,
    direction: defaultSortDirection,
  });

  const activeSort = sortConfig || internalSort;

  const handleHeaderClick = (col) => {
    if (col.sortable === false || (!col.accessor && !col.sortKey)) return;
    const colKey = col.sortKey || col.accessor;
    let nextDirection = 'asc';
    if (activeSort.key === colKey) {
      nextDirection = activeSort.direction === 'asc' ? 'desc' : 'asc';
    }
    const nextSort = { key: colKey, direction: nextDirection };
    if (onSort) {
      onSort(colKey, nextDirection);
    } else {
      setInternalSort(nextSort);
    }
  };

  const sortedData = useMemo(() => {
    if (!activeSort.key || !data || data.length === 0) return data;
    const activeCol = columns.find(
      (c) => (c.sortKey || c.accessor) === activeSort.key
    );
    if (!activeCol) return data;

    return [...data].sort((a, b) => {
      let valA, valB;
      if (typeof activeCol.sortValue === 'function') {
        valA = activeCol.sortValue(a);
        valB = activeCol.sortValue(b);
      } else {
        valA = a[activeSort.key];
        valB = b[activeSort.key];
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === '') return 1;
      if (valB === null || valB === undefined || valB === '') return -1;

      // Numeric comparison
      const numA = typeof valA === 'number' ? valA : !isNaN(Number(valA)) && typeof valA !== 'boolean' ? Number(valA) : null;
      const numB = typeof valB === 'number' ? valB : !isNaN(Number(valB)) && typeof valB !== 'boolean' ? Number(valB) : null;

      let res = 0;
      if (numA !== null && numB !== null) {
        res = numA - numB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        const isDateA = /^\d{4}-\d{2}-\d{2}/.test(valA);
        const isDateB = /^\d{4}-\d{2}-\d{2}/.test(valB);
        if (isDateA && isDateB) {
          const tA = new Date(valA).getTime();
          const tB = new Date(valB).getTime();
          if (!isNaN(tA) && !isNaN(tB)) {
            res = tA - tB;
          } else {
            res = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
          }
        } else {
          res = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }
      } else {
        res = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      }

      return activeSort.direction === 'desc' ? -res : res;
    });
  }, [data, activeSort, columns]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
        <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading records...')}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-sm font-medium text-slate-500">{defaultEmptyMsg}</p>
      </div>
    );
  }

  const currentPage = pagination?.page ?? pagination?.currentPage ?? 1;
  const totalPages = pagination?.totalPages ?? pagination?.pages ?? 1;
  const totalItems = pagination?.total ?? pagination?.totalItems ?? data.length;
  const pageSize = pagination?.limit ?? pagination?.pageSize ?? 20;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {columns.map((col, index) => {
                const colKey = col.sortKey || col.accessor;
                const isSortable = col.sortable !== false && Boolean(colKey);
                const isSorted = activeSort.key === colKey;

                return (
                  <th
                    key={index}
                    onClick={() => isSortable && handleHeaderClick(col)}
                    className={`px-3 py-3 sm:px-4 sm:py-3.5 text-xs font-bold uppercase tracking-wider text-slate-600 ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${
                      isSortable
                        ? 'cursor-pointer select-none hover:bg-slate-100/90 transition-colors group'
                        : ''
                    } ${col.className || ''}`}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === 'right'
                          ? 'justify-end w-full'
                          : col.align === 'center'
                          ? 'justify-center w-full'
                          : 'justify-start'
                      }`}
                    >
                      <span>{col.header}</span>
                      {isSortable && (
                        <span className="shrink-0">
                          {isSorted ? (
                            activeSort.direction === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {sortedData.map((row, rowIndex) => (
              <tr key={row.id || rowIndex} className="hover:bg-slate-50/80 transition-colors">
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-3 py-3 sm:px-4 sm:py-3.5 ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.render ? col.render(row, rowIndex) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          disabled={loading}
        />
      )}
    </div>
  );
};
