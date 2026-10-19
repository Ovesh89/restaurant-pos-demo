import React, { useState, useEffect } from 'react';
import { Search, Filter, ClipboardList, Shield, RefreshCw, Clock, Trash2, CheckCircle2 } from 'lucide-react';
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
  const [purging, setPurging] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState(null);
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

  const handleManualPurge = async () => {
    if (!window.confirm('Run retention cleanup now to purge all audit logs older than 30 days (1 month)?')) {
      return;
    }
    try {
      setPurging(true);
      const res = await auditRepository.cleanupOldLogs(30);
      const count = res?.deletedCount ?? res?.data?.deletedCount ?? 0;
      setPurgeNotice(`Retention cleanup completed: ${count} log(s) older than 30 days were removed.`);
      setTimeout(() => setPurgeNotice(null), 7000);
      await loadLogs(1, limit);
    } catch (err) {
      console.error('Manual purge failed:', err);
      alert('Failed to execute retention purge: ' + (err.message || 'Unknown error'));
    } finally {
      setPurging(false);
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            icon={Trash2}
            onClick={handleManualPurge}
            loading={purging}
            title="Purge logs older than 30 days immediately"
            className="text-slate-600 hover:text-rose-600 hover:border-rose-300"
          >
            Purge &gt; 30 Days
          </Button>
          <Button variant="secondary" icon={RefreshCw} onClick={loadLogs} loading={loading}>
            Refresh Trail
          </Button>
        </div>
      </PageHeader>

      {/* Retention Policy Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <span>30-Day Retention Policy Enforced</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-blue-700/90 text-[11px] mt-0.5">
              Operational logs are recorded strictly for 1 month (30 days). Older records are automatically removed daily at 12:00 AM midnight.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-blue-800 bg-white/80 px-2.5 py-1 rounded-md border border-blue-200 self-start sm:self-auto">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>Auto-purge: Daily @ 12:00 AM</span>
        </div>
      </div>

      {/* Success Notification for Manual Purge */}
      {purgeNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-2xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{purgeNotice}</span>
        </div>
      )}

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
