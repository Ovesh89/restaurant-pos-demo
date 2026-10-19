import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  disabled = false,
  className = ''
}) => {
  const { t, formatNumber } = useTranslation();

  const safePage = Math.max(1, Number(currentPage) || 1);
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safeTotalItems = Math.max(0, Number(totalItems) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 20);

  const startItem = safeTotalItems === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const endItem = Math.min(safePage * safePageSize, safeTotalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      if (safePage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', safeTotalPages);
      } else if (safePage >= safeTotalPages - 3) {
        pages.push(
          1,
          '...',
          safeTotalPages - 4,
          safeTotalPages - 3,
          safeTotalPages - 2,
          safeTotalPages - 1,
          safeTotalPages
        );
      } else {
        pages.push(
          1,
          '...',
          safePage - 1,
          safePage,
          safePage + 1,
          '...',
          safeTotalPages
        );
      }
    }
    return pages;
  };

  const handlePageClick = (page) => {
    if (disabled || page === safePage || page < 1 || page > safeTotalPages) return;
    onPageChange?.(page);
  };

  const handleSizeChange = (e) => {
    if (disabled) return;
    const newSize = parseInt(e.target.value, 10) || safePageSize;
    onPageSizeChange?.(newSize);
  };

  if (safeTotalItems === 0 && safeTotalPages <= 1) {
    return null;
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-600 select-none ${className}`}
    >
      {/* Range and Total Info (English numerals) */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span className="font-medium text-slate-500">
          {t('common.showingOf', {
            start: formatNumber(startItem),
            end: formatNumber(endItem),
            total: formatNumber(safeTotalItems)
          })}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <select
              value={safePageSize}
              onChange={handleSizeChange}
              disabled={disabled}
              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md font-semibold text-slate-700 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors disabled:opacity-50 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {formatNumber(opt)} / {t('common.page', null, 'page')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={disabled || safePage <= 1}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="First page"
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => handlePageClick(safePage - 1)}
          disabled={disabled || safePage <= 1}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={t('common.previous', null, 'Previous')}
          aria-label={t('common.previous', null, 'Previous page')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-slate-400 font-bold select-none"
                >
                  …
                </span>
              );
            }

            const isCurrent = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePageClick(p)}
                disabled={disabled}
                className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                } disabled:opacity-50`}
              >
                {formatNumber(p)}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => handlePageClick(safePage + 1)}
          disabled={disabled || safePage >= safeTotalPages}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={t('common.next', null, 'Next')}
          aria-label={t('common.next', null, 'Next page')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => handlePageClick(safeTotalPages)}
          disabled={disabled || safePage >= safeTotalPages}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Last page"
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
