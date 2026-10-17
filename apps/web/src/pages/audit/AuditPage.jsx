import React, { useState, useEffect } from 'react';
import { Search, Filter, ClipboardList, Shield, RefreshCw } from 'lucide-react';
import { auditRepository } from '../../services/repositories/auditRepository';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';

export const AuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState(null);

  const loadLogs = async (overridePage = page, overrideLimit = limit) => {
    try {
      setLoading(true);
      const data = await auditRepository.getAuditLogs({
        action: actionFilter || undefined,
        search: search.trim() || undefined,
        page: overridePage,
        limit: overrideLimit,
      });
      setLogs(data);
      setPagination(
        data.pagination || {
          total: data.length,
          page: overridePage,
          limit: overrideLimit,
          totalPages: Math.max(1, Math.ceil(data.length / overrideLimit)),
        }
      );
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadLogs(1, limit);
  }, [actionFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadLogs(1, limit);
  };

  const getActionBadgeVariant = (action) => {
    if (action.includes('PRICE') || action.includes('CANCEL') || action.includes('DEACTIVATED')) {
      return 'danger';
    }
    if (action.includes('CREATED') || action.includes('ACTIVATED') || action.includes('LOGIN')) {
      return 'success';
    }
    if (action.includes('UPDATED') || action.includes('STATUS')) {
      return 'primary';
    }
    return 'default';
  };

  const columns = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      className: 'w-40 font-mono text-xs text-slate-500',
      render: (row) => (
        <span>
          {new Date(row.timestamp).toLocaleDateString()}{' '}
          <span className="font-semibold text-slate-700">
            {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </span>
      )
    },
    {
      header: 'Actor / User',
      accessor: 'actorName',
      render: (row) => (
        <span className="font-bold text-slate-800 text-xs">
          {row.actorName}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (row) => (
        <Badge variant={getActionBadgeVariant(row.action)} size="sm">
          {row.action}
        </Badge>
      )
    },
    {
      header: 'Entity',
      accessor: 'entityType',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
          {row.entityType}
        </span>
      )
    },
    {
      header: 'Details & Operational Audit Notes',
      accessor: 'details',
      render: (row) => (
        <div className="text-xs text-slate-700 max-w-xl">
          <p>{row.details}</p>
          {row.reason && (
            <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-medium">
              Reason: {row.reason}
            </p>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Audit Trail"
        subtitle="Immutable chronological history of all security, pricing, and administrative events"
      >
        <Button variant="secondary" icon={RefreshCw} onClick={loadLogs} loading={loading}>
          Refresh Trail
        </Button>
      </PageHeader>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-72 flex gap-2">
          <Input
            icon={Search}
            placeholder="Search details or actor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <div className="w-full sm:w-56">
          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            options={[
              { value: '', label: 'All Event Actions' },
              { value: 'USER_LOGIN', label: 'USER_LOGIN' },
              { value: 'PRODUCT_PRICE_CHANGED', label: 'PRODUCT_PRICE_CHANGED' },
              { value: 'PRODUCT_CREATED', label: 'PRODUCT_CREATED' },
              { value: 'PRODUCT_MARKED_AVAILABLE', label: 'PRODUCT_MARKED_AVAILABLE' },
              { value: 'PRODUCT_MARKED_UNAVAILABLE', label: 'PRODUCT_MARKED_UNAVAILABLE' },
              { value: 'TABLE_CREATED', label: 'TABLE_CREATED' },
              { value: 'TABLE_STATUS_CHANGED', label: 'TABLE_STATUS_CHANGED' },
              { value: 'CATEGORY_CREATED', label: 'CATEGORY_CREATED' },
              { value: 'ROLE_PERMISSIONS_UPDATED', label: 'ROLE_PERMISSIONS_UPDATED' }
            ]}
          />
        </div>

        <div className="sm:ml-auto text-xs text-slate-500 font-semibold text-right sm:text-left">
          Total Logs: {pagination?.total ?? logs.length} entries
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        emptyMessage="No audit log entries match your filter."
        pagination={pagination}
        onPageChange={(p) => {
          setPage(p);
          loadLogs(p, limit);
        }}
        onPageSizeChange={(l) => {
          setLimit(l);
          setPage(1);
          loadLogs(1, l);
        }}
      />
    </div>
  );
};
