import React, { useState, useEffect } from 'react';
import { Search, Filter, ClipboardList, Shield, RefreshCw, Clock, Trash2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { auditRepository } from '../../services/repositories/auditRepository';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { useTranslation } from '../../hooks/useTranslation';

export const AuditPage = () => {
  const { t, formatNumber } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
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
      header: t('audit.timestamp', 'Timestamp'),
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
      header: t('audit.actor', 'Actor / User'),
      accessor: 'actorName',
      render: (row) => (
        <span className="font-bold text-slate-800 text-xs">
          {row.actorName}
        </span>
      )
    },
    {
      header: t('audit.action', 'Action'),
      accessor: 'action',
      render: (row) => (
        <Badge variant={getActionBadgeVariant(row.action)} size="sm">
          {row.action}
        </Badge>
      )
    },
    {
      header: t('audit.entity', 'Entity'),
      accessor: 'entityType',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
          {row.entityType}
        </span>
      )
    },
    {
      header: t('audit.details', 'Details & Operational Audit Notes'),
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
        title={t('audit.title', 'Operational Audit Trail')}
        subtitle={t('audit.subtitle', 'Immutable chronological history of all security, pricing, and administrative events')}
      >
        <Button
          variant="outline"
          icon={Trash2}
          onClick={handleManualPurge}
          loading={purging}
          title="Purge logs older than 30 days immediately"
          className="h-11 w-full justify-center text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-300"
        >
          {t('audit.purgeOld', 'Purge > 30 Days')}
        </Button>
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={loadLogs}
          loading={loading}
          className="h-11 w-full justify-center text-xs font-bold"
        >
          {t('audit.refreshTrail', 'Refresh Trail')}
        </Button>
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

      {/* Mobile Filter Toggle Header */}
      <div className="md:hidden flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 truncate">
              {actionFilter || t('common.all', 'All Event Actions')}
            </div>
            <div className="text-[10px] text-slate-500 font-medium truncate">
              {formatNumber(pagination?.total ?? logs.length)} {t('common.total', 'Total Logs')}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shrink-0"
        >
          <span>{isMobileFiltersOpen ? t('common.collapse', 'Collapse') : t('common.filter', 'Filters')}</span>
          {isMobileFiltersOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className={`bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex-col md:flex md:flex-row md:items-center gap-2.5 sm:gap-3 ${isMobileFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-72 flex gap-2">
          <Input
            icon={Search}
            placeholder={t('common.search', 'Search details or actor...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <div className="w-full sm:w-56">
          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            options={[
              { value: '', label: t('common.all', 'All Event Actions') },
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

        <div className="w-full sm:w-auto sm:ml-auto text-xs text-slate-500 font-semibold text-right sm:text-left">
          {t('common.total', 'Total Logs')}: {formatNumber(pagination?.total ?? logs.length)}
        </div>
      </div>

      {/* Desktop / Tablet Table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={logs}
          loading={loading}
          emptyMessage={t('audit.noLogs', 'No audit log entries match your filter.')}
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

      {/* Mobile-Only Grid/Card View (Optimized for Mobile Screens & Web-View App) */}
      <div className="block md:hidden">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
            <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading audit logs...')}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm font-medium">
            {t('audit.noLogs', 'No audit log entries match your filter.')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              {logs.map((row) => {
                const d = new Date(row.timestamp);
                const dateStr = d.toLocaleDateString();
                const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                return (
                  <div
                    key={row.id || row._id || `${row.timestamp}-${row.action}`}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md"
                  >
                    <div>
                      {/* Header: Action badge & Timestamp */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <Badge variant={getActionBadgeVariant(row.action)} size="sm">
                          {row.action}
                        </Badge>

                        <div className="text-right text-[11px] text-slate-400 font-mono">
                          <span>{dateStr}</span> <span className="text-slate-600 font-semibold">{timeStr}</span>
                        </div>
                      </div>

                      {/* Actor & Entity row */}
                      <div className="my-2 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          Actor: {row.actorName}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {row.entityType}
                        </span>
                      </div>

                      {/* Details & Reason */}
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 text-xs text-slate-700 space-y-1">
                        <p className="leading-relaxed">{row.details}</p>
                        {row.reason && (
                          <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 font-medium">
                            Reason: {row.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Pagination */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <Pagination
                currentPage={pagination?.page || page}
                totalPages={pagination?.totalPages || 1}
                totalItems={pagination?.total || logs.length}
                pageSize={pagination?.limit || limit}
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
          </div>
        )}
      </div>
    </div>
  );
};
