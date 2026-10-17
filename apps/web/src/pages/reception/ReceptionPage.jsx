import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Coffee,
  User,
  UtensilsCrossed,
  AlertTriangle,
  RefreshCw,
  Printer,
  ChevronRight
} from 'lucide-react';
import { orderRepository } from '../../services/repositories/orderRepository';
import { kotRepository } from '../../services/repositories/kotRepository';
import { printService } from '../../services/printing/printService';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { ORDER_STATUS, ORDER_STATUS_CONFIG } from '../../constants/orderStatus';

export const ReceptionPage = () => {
  const { user } = useAuth();
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
    // Local mode auto-poll interval for operational queue
    const timer = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirmOrder = async (order) => {
    setActionLoading(true);
    try {
      const actor = { id: user?.id || 'reception', name: user?.name || 'Reception Staff' };
      const { kotTicket } = await orderRepository.confirmOrder(order.id, actor);
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
      setRejectError('Please specify the reason for rejecting this order.');
      return;
    }

    setActionLoading(true);
    try {
      const actor = { id: user?.id || 'reception', name: user?.name || 'Reception Staff' };
      await orderRepository.rejectOrder(selectedOrderToReject.id, rejectionReason, actor);
      setIsRejectModalOpen(false);
      await loadData();
    } catch (err) {
      setRejectError(err.message || 'Failed to reject order.');
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
        title="Reception Order Approval"
        subtitle="Review and confirm incoming captain table orders to automatically dispatch KOT tickets to the kitchen"
      >
        <Button variant="secondary" icon={RefreshCw} onClick={loadData} loading={loading}>
          Refresh Queue
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Orders Waiting Confirmation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Waiting Confirmation Queue</span>
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center">
                {pendingOrders.length}
              </span>
            </h2>
            <span className="text-xs text-slate-500">Auto-updating live queue</span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
              Loading orders...
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-60" />
              <h3 className="text-base font-bold text-slate-800">All Orders Processed</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No orders waiting for reception approval right now. New captain orders will appear here automatically.
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
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-black text-sm">
                        T-{ord.tableNo}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-800">{ord.orderNo}</span>
                          <Badge variant="warning" size="sm">WAITING APPROVAL</Badge>
                        </div>
                        <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" /> Captain: <b>{ord.captainName}</b>
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
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center">
                            {item.quantity}x
                          </span>
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                            <span className="text-[10px] text-slate-400 ml-2 font-mono">[{item.station}]</span>
                            {item.notes && (
                              <p className="text-[11px] text-blue-600 italic mt-0.5">
                                * Instruction: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="font-bold text-slate-800 text-sm">
                          ₹{item.quantity * item.unitPrice}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order-level note */}
                  {ord.notes && (
                    <div className="mb-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs text-amber-800 italic">
                      <b>Order Note:</b> {ord.notes}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center justify-between sm:justify-start">
                      <span className="text-xs text-slate-500">Order Subtotal:</span>
                      <span className="ml-1.5 text-base font-black text-slate-900">₹{ord.subtotal}</span>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleOpenReject(ord)}
                        className="text-red-600 hover:bg-red-50 border-red-200 flex-1 sm:flex-none"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={CheckCircle2}
                        disabled={actionLoading}
                        onClick={() => handleConfirmOrder(ord)}
                        className="flex-1 sm:flex-none"
                      >
                        Confirm & Send KOT
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Recent KOT Activity Feed */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800">Recent KOT Tickets Dispatched</h2>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            {activeKOTs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No KOTs generated yet.</p>
            ) : (
              activeKOTs.map((kot) => (
                <div key={kot.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-blue-700 font-mono">{kot.kotNo}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-semibold text-slate-700">
                    <span>Table {kot.tableNo}</span>
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 capitalize">
                      {kot.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    {kot.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </div>

                  <div className="pt-2 border-t border-slate-200/50 flex items-center justify-end">
                    <button
                      onClick={() => handlePrintKOT(kot)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Receipt
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Order"
        subtitle={`Specify why ${selectedOrderToReject?.orderNo} (Table ${selectedOrderToReject?.tableNo}) is being returned`}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          {rejectError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {rejectError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Rejection Reason (Mandatory)
            </label>
            <textarea
              rows="3"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
              placeholder="e.g. Items 86/out of stock, kitchen station closing, incorrect table selected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
              autoFocus
            ></textarea>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={actionLoading}>
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
