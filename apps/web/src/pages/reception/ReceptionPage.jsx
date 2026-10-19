import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  User,
  UtensilsCrossed,
  RefreshCw,
  Printer,
  ChevronRight
} from 'lucide-react';
import { orderRepository } from '../../services/repositories/orderRepository';
import { kotRepository } from '../../services/repositories/kotRepository';
import { printService } from '../../services/printing/printService';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { ORDER_STATUS } from '../../constants/orderStatus';

export const ReceptionPage = () => {
  const { user } = useAuth();
  const { t, formatNumber, formatCurrency } = useTranslation();
  const navigate = useNavigate();

  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeKOTs, setActiveKOTs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedOrderToReject, setSelectedOrderToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pending, kots] = await Promise.all([
        orderRepository.getOrders({ status: ORDER_STATUS.WAITING_CONFIRMATION }),
        kotRepository.getKOTs()
      ]);
      setPendingOrders(pending);
      setActiveKOTs(kots.slice(0, 8)); // recent KOTs
    } catch (err) {
      console.error('Failed to load reception queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirmOrder = async (order) => {
    setActionLoading(true);
    try {
      const actor = { id: user?.id || 'reception', name: user?.name || 'Reception Staff' };
      await orderRepository.confirmOrder(order.id, actor);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (order) => {
    setSelectedOrderToReject(order);
    setRejectionReason('');
    setRejectError('');
    setIsRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setRejectError(t('reception.rejectionReasonPrompt', null, 'Please specify the reason for rejecting this order.'));
      return;
    }

    setActionLoading(true);
    try {
      const actor = { id: user?.id || 'reception', name: user?.name || 'Reception Staff' };
      await orderRepository.rejectOrder(selectedOrderToReject.id, rejectionReason, actor);
      setIsRejectModalOpen(false);
      await loadData();
    } catch (err) {
      setRejectError(err.message || t('common.error', null, 'Failed to reject order.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintKOT = (kot) => {
    printService.printKOT(kot, null, { tableNo: kot.tableNo });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reception.title', null, 'Reception Order Approval')}
        subtitle={t('reception.subtitle', null, 'Review and confirm incoming captain table orders to automatically dispatch KOT tickets to the kitchen')}
      >
        <Button variant="secondary" icon={RefreshCw} onClick={loadData} loading={loading}>
          {t('common.refresh', null, 'Refresh')}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Orders Waiting Confirmation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>{t('reception.pendingQueue', null, 'Waiting Confirmation Queue')}</span>
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center font-mono">
                {formatNumber(pendingOrders.length)}
              </span>
            </h2>
            <span className="text-xs text-slate-500">{t('reception.confirmOrderNotice', null, 'Auto-updating live queue')}</span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
              {t('common.loading', null, 'Loading orders...')}
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-60" />
              <h3 className="text-base font-bold text-slate-800">{t('reception.noPending', null, 'All Orders Processed')}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('reception.noPending', null, 'No orders waiting for reception approval right now.')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl border border-amber-200 p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>

                  {/* Order Header */}
                  <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-black text-sm font-mono">
                        T-{formatNumber(ord.tableNo)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-800 font-mono">{ord.orderNo}</span>
                          <Badge variant="warning" size="sm">{t('dashboard.waitingApproval', null, 'WAITING APPROVAL')}</Badge>
                        </div>
                        <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" /> {t('orders.captain', null, 'Captain')}: <b>{ord.captainName}</b>
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="py-3 divide-y divide-slate-100 text-xs">
                    {ord.items.map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center font-mono">
                            {formatNumber(item.quantity)}x
                          </span>
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                            <span className="text-[10px] text-slate-400 ml-2 font-mono">[{item.station}]</span>
                            {item.notes && (
                              <p className="text-[11px] text-blue-600 italic mt-0.5">
                                * {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="font-bold text-slate-800 text-sm">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order-level note */}
                  {ord.notes && (
                    <div className="mb-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs text-amber-800 italic">
                      <b>{t('common.notes', null, 'Notes')}:</b> {ord.notes}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center justify-between sm:justify-start">
                      <span className="text-xs text-slate-500">{t('common.subtotal', null, 'Order Subtotal')}:</span>
                      <span className="ml-1.5 text-base font-black text-slate-900">{formatCurrency(ord.subtotal)}</span>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleOpenReject(ord)}
                        className="text-red-600 hover:bg-red-50 border-red-200 flex-1 sm:flex-none"
                      >
                        {t('reception.rejectOrder', null, 'Reject')}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={actionLoading}
                        onClick={() => handleConfirmOrder(ord)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1 sm:flex-none"
                      >
                        {t('reception.approveOrder', null, 'Approve & Fire KOT')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Live KOT Dispatch Audit Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-slate-500" />
              <span>{t('dashboard.liveKitchenQueue', null, 'Recent KOT Dispatches')}</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">({formatNumber(activeKOTs.length)})</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 divide-y divide-slate-100 shadow-xs max-h-[600px] overflow-y-auto">
            {activeKOTs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">{t('kitchen.noActiveTickets', null, 'No recent KOTs generated.')}</p>
            ) : (
              activeKOTs.map((kot) => (
                <div key={kot.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-blue-700">{kot.kotNo}</span>
                    <Badge variant={kot.status === 'READY' ? 'success' : 'default'} size="sm">
                      {kot.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600 font-semibold flex items-center justify-between">
                    <span>{t('tables.tableNumber', null, 'Table')} {formatNumber(kot.tableNo || '-')}</span>
                    <button
                      onClick={() => handlePrintKOT(kot)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1 font-bold"
                    >
                      <Printer className="w-3 h-3" /> {t('common.print', null, 'Print')}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {kot.items.map((i) => `${formatNumber(i.quantity)}x ${i.name}`).join(', ')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reject Order Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title={t('reception.rejectOrder', null, 'Reject Order')}
        subtitle={`${t('orders.orderId', null, 'Order')} #${selectedOrderToReject?.orderNo} • ${t('tables.tableNumber', null, 'Table')} ${formatNumber(selectedOrderToReject?.tableNo)}`}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          {rejectError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
              {rejectError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('common.reason', null, 'Rejection Reason')} <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('reception.rejectionReasonPrompt', null, 'e.g. Dish unavailable, customer cancelled before cooking, etc.')}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsRejectModalOpen(false)}>
              {t('common.cancel', null, 'Cancel')}
            </Button>
            <Button type="submit" variant="danger" loading={actionLoading}>
              {t('reception.rejectOrder', null, 'Confirm Rejection')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
