import React, { useState, useEffect } from 'react';
import {
  Clock,
  DollarSign,
  TrendingUp,
  CreditCard,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  Receipt,
  FileText,
  UserCheck
} from 'lucide-react';
import { shiftRepository, SHIFT_STATUS, CASH_MOVEMENT_TYPE } from '../../services/repositories/shiftRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { useTranslation } from '../../hooks/useTranslation';

export const ShiftsPage = () => {
  const { user } = useAuth();
  const { t, formatNumber, formatCurrency } = useTranslation();

  const [activeShift, setActiveShift] = useState(null);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [pastShifts, setPastShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyPagination, setHistoryPagination] = useState(null);

  // Open Shift Modal State
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('2000');
  const [openError, setOpenError] = useState('');
  const [openLoading, setOpenLoading] = useState(false);

  // Cash In/Out Modal State
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashType, setCashType] = useState(CASH_MOVEMENT_TYPE.IN);
  const [cashAmount, setCashAmount] = useState('');
  const [cashReason, setCashReason] = useState('');
  const [cashError, setCashError] = useState('');
  const [cashLoading, setCashLoading] = useState(false);

  // Close Shift / Day End Modal State
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [actualCashCount, setActualCashCount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeError, setCloseError] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);

  // Selected Shift Detail Modal
  const [selectedShift, setSelectedShift] = useState(null);

  const loadShiftData = async (overridePage = historyPage, overrideLimit = historyLimit) => {
    try {
      setLoading(true);
      const [openS, allS] = await Promise.all([
        shiftRepository.getActiveShift(),
        shiftRepository.getShifts({ page: overridePage, limit: overrideLimit })
      ]);
      setActiveShift(openS);
      setPastShifts(allS);
      setHistoryPagination(
        allS.pagination || {
          total: allS.length,
          page: overridePage,
          limit: overrideLimit,
          totalPages: Math.max(1, Math.ceil(allS.length / overrideLimit))
        }
      );

      if (openS) {
        const sum = await shiftRepository.getShiftLiveSummary(openS.id);
        setShiftSummary(sum);
        setActualCashCount(sum.expectedCash.toString());
      } else {
        setShiftSummary(null);
      }
    } catch (err) {
      console.error('Failed to load shifts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftData();
  }, []);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setOpenError('');
    setOpenLoading(true);
    try {
      const cashier = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      await shiftRepository.openShift({
        openingFloat: Number(openingFloat) || 0,
        cashier
      });
      setIsOpenModalOpen(false);
      await loadShiftData();
    } catch (err) {
      setOpenError(err.message || 'Error opening shift');
    } finally {
      setOpenLoading(false);
    }
  };

  const handleRecordCash = async (e) => {
    e.preventDefault();
    if (!activeShift) return;
    setCashError('');
    setCashLoading(true);
    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      await shiftRepository.recordCashMovement({
        shiftId: activeShift.id,
        type: cashType,
        amount: Number(cashAmount),
        reason: cashReason,
        actor
      });
      setIsCashModalOpen(false);
      setCashAmount('');
      setCashReason('');
      await loadShiftData();
    } catch (err) {
      setCashError(err.message || 'Error recording cash');
    } finally {
      setCashLoading(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!activeShift) return;
    setCloseError('');
    setCloseLoading(true);
    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      await shiftRepository.closeShift({
        shiftId: activeShift.id,
        actualCash: Number(actualCashCount),
        notes: closeNotes,
        actor
      });
      setIsCloseModalOpen(false);
      setCloseNotes('');
      await loadShiftData();
    } catch (err) {
      setCloseError(err.message || 'Error closing shift');
    } finally {
      setCloseLoading(false);
    }
  };

  const shiftColumns = [
    {
      header: t('shifts.currentShift', 'Shift #'),
      accessor: 'shiftNo',
      className: 'font-mono font-bold text-blue-600',
      render: (row) => `#${formatNumber(row.shiftNo)}`
    },
    {
      header: t('orders.captain', 'Cashier / Operator'),
      accessor: 'cashierName',
      render: (row) => <span className="font-semibold text-slate-800">{row.cashierName}</span>
    },
    {
      header: t('shifts.openedAt', 'Opened At'),
      accessor: 'openedAt',
      className: 'text-xs text-slate-500',
      render: (row) => new Date(row.openedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    },
    {
      header: t('shifts.closedAt', 'Closed At'),
      accessor: 'closedAt',
      className: 'text-xs text-slate-500',
      render: (row) => (row.closedAt ? new Date(row.closedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : `— ${t('common.active', 'Active')} —`)
    },
    {
      header: t('shifts.openingFloat', 'Opening Float'),
      accessor: 'openingFloat',
      render: (row) => formatCurrency(row.openingFloat || 0)
    },
    {
      header: t('shifts.expectedCash', 'Expected Cash'),
      accessor: 'expectedCash',
      render: (row) => formatCurrency(row.expectedCash || 0)
    },
    {
      header: t('shifts.actualCash', 'Actual Count'),
      accessor: 'actualCash',
      render: (row) => (row.status === SHIFT_STATUS.CLOSED ? formatCurrency(row.actualCash || 0) : '—')
    },
    {
      header: t('shifts.difference', 'Variance'),
      accessor: 'cashVariance',
      render: (row) => {
        if (row.status !== SHIFT_STATUS.CLOSED) return '—';
        const v = row.cashVariance || 0;
        if (v === 0) return <span className="font-bold text-emerald-600">{formatCurrency(0)} (Matched)</span>;
        if (v > 0) return <span className="font-bold text-blue-600">+{formatCurrency(v)} (Surplus)</span>;
        return <span className="font-bold text-rose-600">-{formatCurrency(Math.abs(v))} (Shortage)</span>;
      }
    },
    {
      header: t('common.status', 'Status'),
      accessor: 'status',
      render: (row) => (
        <Badge variant={row.status === SHIFT_STATUS.OPEN ? 'success' : 'default'} size="sm">
          {row.status === SHIFT_STATUS.OPEN ? t('common.open', 'Open') : t('common.closed', 'Closed')}
        </Badge>
      )
    },
    {
      header: t('common.actions', 'Action'),
      accessor: 'id',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedShift(row)}>
          {t('orders.viewDetails', 'Details')}
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('shifts.title', 'Shift & Register Management')}
        subtitle={t('shifts.subtitle', 'Cash drawer reconciliation, mid-shift cash drops, expected vs actual cash counts, and Day-End close')}
      >
        {!activeShift && (
          <Button variant="primary" icon={Unlock} onClick={() => setIsOpenModalOpen(true)}>
            {t('shifts.startShift', 'Open New Shift')}
          </Button>
        )}
      </PageHeader>

      {/* Active Shift Overview Banner */}
      {activeShift ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    {t('shifts.currentShift', 'Active Shift')} #{formatNumber(activeShift.shiftNo)}
                  </h3>
                  <Badge variant="success" size="sm">OPEN REGISTER</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Opened by <span className="font-bold text-slate-700">{activeShift.cashierName}</span> at{' '}
                  {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (
                  {new Date(activeShift.openedAt).toLocaleDateString()})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <Button
                variant="secondary"
                icon={Plus}
                onClick={() => {
                  setCashType(CASH_MOVEMENT_TYPE.IN);
                  setIsCashModalOpen(true);
                }}
              >
                Cash In / Drop
              </Button>
              <Button
                variant="secondary"
                icon={Minus}
                onClick={() => {
                  setCashType(CASH_MOVEMENT_TYPE.OUT);
                  setIsCashModalOpen(true);
                }}
              >
                Cash Out (Petty)
              </Button>
              <Button
                variant="danger"
                icon={Lock}
                onClick={() => setIsCloseModalOpen(true)}
              >
                {t('shifts.closeShift', 'Close Shift / Day End')}
              </Button>
            </div>
          </div>

          {/* Shift Metrics */}
          {shiftSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={t('shifts.expectedCash', 'Expected Cash in Drawer')}
                value={formatCurrency(shiftSummary.expectedCash)}
                subtitle={`Opening Float ${formatCurrency(activeShift.openingFloat)} + Cash Sales ${formatCurrency(shiftSummary.cashSales)}`}
                icon={DollarSign}
                color="emerald"
              />
              <StatCard
                title={t('reports.totalSales', 'Total Shift Sales')}
                value={formatCurrency(shiftSummary.totalSales)}
                subtitle={`${formatNumber(shiftSummary.billCount)} invoices settled in this shift`}
                icon={TrendingUp}
                color="blue"
              />
              <StatCard
                title={t('payment.upi', 'UPI Payments')}
                value={formatCurrency(shiftSummary.upiSales)}
                subtitle="Instant bank transfers"
                icon={CreditCard}
                color="purple"
              />
              <StatCard
                title={t('payment.card', 'Card Payments')}
                value={formatCurrency(shiftSummary.cardSales)}
                subtitle="POS card terminal payments"
                icon={CreditCard}
                color="amber"
              />
            </div>
          )}

          {/* Cash In / Out Log */}
          {activeShift.cashMovements?.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Mid-Shift Cash Movements</h4>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden text-xs">
                {activeShift.cashMovements.map((m) => (
                  <div key={m.id} className="p-3 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <Badge variant={m.type === CASH_MOVEMENT_TYPE.IN ? 'success' : 'danger'} size="sm">
                        {m.type === CASH_MOVEMENT_TYPE.IN ? 'Cash In' : 'Cash Out'}
                      </Badge>
                      <span className="font-semibold text-slate-700 ml-2">{m.reason}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-800">
                        {m.type === CASH_MOVEMENT_TYPE.IN ? '+' : '-'}{formatCurrency(m.amount)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50/60 border border-amber-200 rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Active Cashier Shift</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The register is currently closed. Open a new cashier shift with an opening cash float to begin taking table payments and tracking reconciliation.
          </p>
          <Button variant="primary" icon={Unlock} onClick={() => setIsOpenModalOpen(true)}>
            {t('shifts.startShift', 'Open New Shift')}
          </Button>
        </div>
      )}

      {/* Shifts History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-800">Shift History & Reconciliation Logs</h3>
        <DataTable
          columns={shiftColumns}
          data={pastShifts}
          loading={loading}
          emptyMessage="No shift history recorded yet."
          pagination={historyPagination}
          onPageChange={(p) => {
            setHistoryPage(p);
            loadShiftData(p, historyLimit);
          }}
          onPageSizeChange={(l) => {
            setHistoryLimit(l);
            setHistoryPage(1);
            loadShiftData(1, l);
          }}
        />
      </div>

      {/* Open Shift Modal */}
      <Modal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        title={t('shifts.startShift', 'Open New Register Shift')}
        subtitle="Declare the physical opening float inside the cash drawer"
      >
        <form onSubmit={handleOpenShift} className="space-y-4">
          {openError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {openError}
            </div>
          )}

          <Input
            label={`${t('shifts.openingFloat', 'Opening Cash Float')} (₹)`}
            type="number"
            min="0"
            step="10"
            required
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            helperText="Starting balance in notes and coins inside drawer"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsOpenModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={openLoading}>
              {t('shifts.startShift', 'Open Shift')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cash Movement Modal */}
      <Modal
        isOpen={isCashModalOpen}
        onClose={() => setIsCashModalOpen(false)}
        title={cashType === CASH_MOVEMENT_TYPE.IN ? 'Record Cash In' : 'Record Cash Out'}
        subtitle="Mid-shift cash injection or safe drop expense"
      >
        <form onSubmit={handleRecordCash} className="space-y-4">
          {cashError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {cashError}
            </div>
          )}

          <Input
            label={`${t('billing.finalPayable', 'Amount')} (₹)`}
            type="number"
            min="1"
            required
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
          />

          <Input
            label={t('tables.transferReason', 'Reason / Narration')}
            placeholder="e.g. Petty cash for dairy, safe drop to manager"
            required
            value={cashReason}
            onChange={(e) => setCashReason(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsCashModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={cashLoading}>
              {t('common.save', 'Save Movement')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Close Shift Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title={t('shifts.closeShift', 'Close Register Shift (Day End)')}
        subtitle="Count the physical currency in the cash drawer and reconcile with expected totals"
      >
        <form onSubmit={handleCloseShift} className="space-y-4">
          {closeError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {closeError}
            </div>
          )}

          {shiftSummary && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('shifts.openingFloat', 'Opening Float')}:</span>
                <span className="font-bold text-slate-800">{formatCurrency(activeShift?.openingFloat || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('shifts.cashCollected', 'Cash Invoices Collected')}:</span>
                <span className="font-bold text-slate-800">+{formatCurrency(shiftSummary.cashSales)}</span>
              </div>
              {shiftSummary.totalCashIn > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash In (Drops):</span>
                  <span className="font-bold text-slate-800">+{formatCurrency(shiftSummary.totalCashIn)}</span>
                </div>
              )}
              {shiftSummary.totalCashOut > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Out (Petty Expenses):</span>
                  <span className="font-bold text-slate-800">-{formatCurrency(shiftSummary.totalCashOut)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm">
                <span>{t('shifts.expectedCash', 'System Expected Cash')}:</span>
                <span className="text-blue-700">{formatCurrency(shiftSummary.expectedCash)}</span>
              </div>
            </div>
          )}

          <Input
            label={`${t('shifts.actualCash', 'Actual Physical Cash Count')} (₹)`}
            type="number"
            min="0"
            required
            value={actualCashCount}
            onChange={(e) => setActualCashCount(e.target.value)}
            helperText="Count physical notes and coins in the drawer right now"
          />

          {shiftSummary && (
            <div className="text-xs">
              {Number(actualCashCount) - shiftSummary.expectedCash === 0 ? (
                <p className="text-emerald-600 font-bold">✓ Cash matches system calculation perfectly.</p>
              ) : Number(actualCashCount) - shiftSummary.expectedCash > 0 ? (
                <p className="text-blue-600 font-bold">
                  Surplus: +{formatCurrency(Number(actualCashCount) - shiftSummary.expectedCash)} above system expected.
                </p>
              ) : (
                <p className="text-rose-600 font-bold">
                  Shortage: -{formatCurrency(Math.abs(Number(actualCashCount) - shiftSummary.expectedCash))} below system expected.
                </p>
              )}
            </div>
          )}

          <Input
            label="Closing Notes / Discrepancy Reason"
            placeholder="Explain any variance or handover instructions"
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsCloseModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="danger" loading={closeLoading}>
              {t('shifts.closeShift', 'Confirm Close & Lock Shift')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Selected Shift Detail Modal */}
      <Modal
        isOpen={!!selectedShift}
        onClose={() => setSelectedShift(null)}
        title={`Shift Summary: #${formatNumber(selectedShift?.shiftNo)}`}
        subtitle={`Cashier: ${selectedShift?.cashierName} • Status: ${selectedShift?.status}`}
      >
        {selectedShift && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="text-slate-400 block">{t('shifts.openedAt', 'Opened')}</span>
                <span className="font-bold text-slate-800">{new Date(selectedShift.openedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('shifts.closedAt', 'Closed')}</span>
                <span className="font-bold text-slate-800">
                  {selectedShift.closedAt ? new Date(selectedShift.closedAt).toLocaleString() : t('common.open', 'Still Open')}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 p-3 border border-slate-200 rounded-xl">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('shifts.openingFloat', 'Opening Float')}:</span>
                <span className="font-bold">{formatCurrency(selectedShift.openingFloat || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('reports.totalSales', 'Total Settled Sales')}:</span>
                <span className="font-bold">{formatCurrency(selectedShift.salesSummary?.totalSales || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('shifts.cashCollected', 'Cash Sales')}:</span>
                <span className="font-bold">{formatCurrency(selectedShift.salesSummary?.cashSales || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('shifts.upiCollected', 'UPI Sales')}:</span>
                <span className="font-bold">{formatCurrency(selectedShift.salesSummary?.upiSales || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('shifts.cardCollected', 'Card Sales')}:</span>
                <span className="font-bold">{formatCurrency(selectedShift.salesSummary?.cardSales || 0)}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between font-extrabold text-sm">
                <span>{t('shifts.expectedCash', 'Expected Cash')}:</span>
                <span>{formatCurrency(selectedShift.expectedCash || 0)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm">
                <span>{t('shifts.actualCash', 'Actual Counted')}:</span>
                <span>{formatCurrency(selectedShift.actualCash || 0)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm">
                <span>{t('shifts.difference', 'Cash Variance')}:</span>
                <span className={selectedShift.cashVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {selectedShift.cashVariance >= 0 ? '+' : ''}{formatCurrency(selectedShift.cashVariance || 0)}
                </span>
              </div>
            </div>

            {selectedShift.notes && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                <span className="font-bold block">Closing Notes:</span>
                <p>{selectedShift.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedShift(null)}>
                {t('common.close', 'Close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
