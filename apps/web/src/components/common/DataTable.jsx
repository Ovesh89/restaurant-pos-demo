import React from 'react';
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
}) => {
  const { t } = useTranslation();
  const defaultEmptyMsg = emptyMessage || t('common.noRecords', null, 'No records found.');

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
              {columns.map((col, index) => (
                <th
                  key={index}
                  className={`px-3 py-3 sm:px-4 sm:py-3.5 text-xs font-bold uppercase tracking-wider text-slate-600 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {data.map((row, rowIndex) => (
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
