import React, { useState, useEffect } from 'react';
import {
  ChefHat,
  Clock,
  Printer,
  CheckCircle2,
  Flame,
  Coffee,
  AlertCircle,
  RefreshCw,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { kotRepository } from '../../services/repositories/kotRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { printService, formatReceiptSequence } from '../../services/printing/printService';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { KOT_STATUS, KOT_STATUS_CONFIG, KOT_TYPE } from '../../constants/orderStatus';
import { APP_CONFIG } from '../../config/appConfig';

export const KitchenPage = () => {
  const { user } = useAuth();

  const [kots, setKots] = useState([]);
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // ACTIVE (New/Preparing), or ALL, or READY
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Big popup state for item-by-item dish prep tracking
  const [selectedKotDetail, setSelectedKotDetail] = useState(null);
  const [preparedItemsByKot, setPreparedItemsByKot] = useState({});

  const loadKOTs = async () => {
    try {
      setLoading(true);
      const data = await kotRepository.getKOTs({
        station: selectedStation === 'ALL' ? undefined : selectedStation
      });
      setKots(data);

      // Keep selectedKotDetail in sync if open
      if (selectedKotDetail) {
        const fresh = data.find((k) => k.id === selectedKotDetail.id);
        if (fresh) setSelectedKotDetail(fresh);
      }
    } catch (err) {
      console.error('Failed to load kitchen tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKOTs();
    const timer = setInterval(() => {
      loadKOTs();
    }, 8000);
    return () => clearInterval(timer);
  }, [selectedStation]);

  const handleUpdateStatus = async (kot, newStatus) => {
    setActionLoadingId(kot.id);
    try {
      const actor = { id: user?.id || 'kitchen', name: user?.name || 'Chef' };
      await kotRepository.updateKOTStatus(kot.id, newStatus, actor);

      // Propagate to linked order
      await orderRepository.updateStatusFromKitchen(kot.orderId, newStatus, actor);

      await loadKOTs();

      // Update modal view if currently open
      if (selectedKotDetail && selectedKotDetail.id === kot.id) {
        setSelectedKotDetail((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleItemPrepared = (kotId, itemIndex) => {
    setPreparedItemsByKot((prev) => {
      const currentKotItems = prev[kotId] || {};
      return {
        ...prev,
        [kotId]: {
          ...currentKotItems,
          [itemIndex]: !currentKotItems[itemIndex],
        },
      };
    });
  };

  const handleMarkAllItemsPrepared = (kot) => {
    if (!kot || !Array.isArray(kot.items)) return;
    const allTrue = {};
    kot.items.forEach((_, idx) => {
      allTrue[idx] = true;
    });
    setPreparedItemsByKot((prev) => ({
      ...prev,
      [kot.id]: allTrue,
    }));
  };

  const handlePrint = (kot) => {
    printService.printKOT(kot, null, { tableNo: kot.tableNo });
  };

  // Filter KOTs
  const displayedKOTs = kots.filter((k) => {
    if (statusFilter === 'ACTIVE') {
      return k.status === KOT_STATUS.NEW || k.status === KOT_STATUS.PREPARING;
    }
    if (statusFilter === 'READY') {
      return k.status === KOT_STATUS.READY;
    }
    return true;
  });

  const getElapsedTimeMinutes = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return Math.max(0, diff);
  };

  // Calculations for current detail modal
  const currentKotPreparedMap = selectedKotDetail ? (preparedItemsByKot[selectedKotDetail.id] || {}) : {};
  const currentTotalItems = selectedKotDetail?.items?.length || 0;
  const currentPreparedCount = selectedKotDetail?.items
    ? selectedKotDetail.items.filter((_, idx) => currentKotPreparedMap[idx]).length
    : 0;
  const allCurrentItemsPrepared = currentTotalItems > 0 && currentPreparedCount === currentTotalItems;
  const prepProgressPct = currentTotalItems > 0 ? Math.round((currentPreparedCount / currentTotalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kitchen Display System (KDS)"
        subtitle="Live chef tickets queue, station-wise dish dispatching, item-by-item preparation checkoff, and thermal printing"
      >
        <Button variant="secondary" icon={RefreshCw} onClick={loadKOTs} loading={loading}>
          Refresh Queue
        </Button>
      </PageHeader>

      {/* Filter Tabs: Station & Status */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Stations */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedStation('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              selectedStation === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Stations
          </button>
          {APP_CONFIG.DEFAULT_KITCHEN_STATIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStation(s.name)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedStation === s.name
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Status Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar shrink-0 text-xs">
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${
              statusFilter === 'ACTIVE' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Active Tickets ({kots.filter((k) => k.status === KOT_STATUS.NEW || k.status === KOT_STATUS.PREPARING).length})
          </button>
          <button
            onClick={() => setStatusFilter('READY')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${
              statusFilter === 'READY' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Ready ({kots.filter((k) => k.status === KOT_STATUS.READY).length})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${
              statusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Tickets
          </button>
        </div>
      </div>

      {/* Tickets Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
          Loading kitchen tickets...
        </div>
      ) : displayedKOTs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <ChefHat className="w-12 h-12 text-slate-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-base font-bold text-slate-800">Kitchen Queue is Clear</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No active food tickets waiting in this station. Incoming confirmed orders will appear instantly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedKOTs.map((kot) => {
            const elapsed = getElapsedTimeMinutes(kot.createdAt);
            const isCooking = kot.status === KOT_STATUS.PREPARING;
            const isReady = kot.status === KOT_STATUS.READY;

            const kotPrepMap = preparedItemsByKot[kot.id] || {};
            const prepCount = (kot.items || []).filter((_, i) => kotPrepMap[i]).length;
            const totalItems = kot.items?.length || 0;

            return (
              <div
                key={kot.id}
                onClick={() => setSelectedKotDetail(kot)}
                className={`bg-white rounded-2xl border shadow-xs hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden cursor-pointer ${
                  kot.status === KOT_STATUS.NEW
                    ? 'border-blue-300 ring-2 ring-blue-100 hover:border-blue-500'
                    : isCooking
                    ? 'border-orange-300 ring-2 ring-orange-100 hover:border-orange-500'
                    : 'border-slate-200 hover:border-emerald-400'
                }`}
              >
                {/* Top Status Bar */}
                <div
                  className={`px-4 py-2 text-xs font-bold flex items-center justify-between ${
                    kot.status === KOT_STATUS.NEW
                      ? 'bg-blue-600 text-white'
                      : isCooking
                      ? 'bg-orange-500 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isCooking ? <Flame className="w-4 h-4 animate-bounce" /> : <ChefHat className="w-4 h-4" />}
                    <span>{kot.kotNo}</span>
                    {kot.revision > 1 && (
                      <span className="bg-white/20 px-1.5 py-0.2 rounded text-[10px]">
                        REV #{kot.revision}
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    {elapsed}m ago
                  </span>
                </div>

                {/* Body Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  {/* Table & Order Subheader */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</span>
                      <h4 className="text-xl font-black text-slate-800">
                        {kot.tableNo ? `Table ${kot.tableNo}` : 'Take Away / Direct'}
                      </h4>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order</span>
                      <p className="text-xs font-bold text-slate-700 font-mono">
                        {formatReceiptSequence(kot.orderNo || kot.orderNumber || kot.orderId)}
                      </p>
                      <p className="text-[10px] text-slate-400">{kot.captainName || 'Staff'}</p>
                    </div>
                  </div>

                  {/* Modification Note Banner */}
                  {kot.type === KOT_TYPE.MODIFICATION && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                      <b>Modification delta:</b> {kot.notes || kot.modificationReason || 'Dish adjustment'}
                    </div>
                  )}

                  {/* Preparation progress indicator if cooking */}
                  {isCooking && (
                    <div className="bg-orange-50/70 p-2.5 rounded-xl border border-orange-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-orange-900">
                        <span>Preparation Progress:</span>
                        <span>{prepCount} of {totalItems} items prepared</span>
                      </div>
                      <div className="w-full bg-orange-200/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${totalItems > 0 ? (prepCount / totalItems) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dishes List (Without price) */}
                  <div className="divide-y divide-slate-100 text-xs space-y-2 py-1">
                    {(kot.items || []).map((itm, iIdx) => {
                      const isPrepared = Boolean(kotPrepMap[iIdx]);
                      return (
                        <div key={iIdx} className="pt-2 first:pt-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-base font-black text-blue-600 w-8 shrink-0">
                              {itm.quantity}x
                            </span>
                            <span className={`font-bold text-sm flex-1 leading-tight ${isPrepared ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {itm.name || itm.productName}
                            </span>
                            {isCooking && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleItemPrepared(kot.id, iIdx);
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors shrink-0 ${
                                  isPrepared
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                                }`}
                              >
                                {isPrepared ? '✓ Prepared' : 'Mark Done'}
                              </button>
                            )}
                          </div>
                          {itm.notes && (
                            <div className="ml-8 mt-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 inline-block">
                              * {itm.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Station Badge & Print */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {kot.station || 'Main Kitchen'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrint(kot);
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Ticket
                    </button>
                  </div>
                </div>

                {/* Bottom Workflow Action Buttons */}
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  {kot.status === KOT_STATUS.NEW ? (
                    <Button
                      variant="primary"
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      icon={Flame}
                      loading={actionLoadingId === kot.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(kot, KOT_STATUS.PREPARING);
                      }}
                    >
                      Start Preparing
                    </Button>
                  ) : isCooking ? (
                    <Button
                      variant="success"
                      className="w-full"
                      icon={CheckCircle2}
                      loading={actionLoadingId === kot.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(kot, KOT_STATUS.READY);
                      }}
                    >
                      Mark Dishes Ready
                    </Button>
                  ) : (
                    <div className="text-center py-1 text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Ready for Pickup by Captain</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Large KOT Detail & Item-by-Item Preparation Modal */}
      {selectedKotDetail && (
        <Modal
          isOpen={Boolean(selectedKotDetail)}
          onClose={() => setSelectedKotDetail(null)}
          title={`KOT Prep Station: ${selectedKotDetail.kotNo}`}
          subtitle={`${selectedKotDetail.tableNo ? `Table ${selectedKotDetail.tableNo}` : 'Direct Order'} • Order ${formatReceiptSequence(selectedKotDetail.orderNo || selectedKotDetail.orderNumber || selectedKotDetail.orderId)} • Captain: ${selectedKotDetail.captainName || 'Staff'}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-5">
            {/* Top Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">KOT Status</span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{selectedKotDetail.status}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Location / Table</span>
                <span className="font-extrabold text-blue-700 text-sm mt-0.5 block">
                  {selectedKotDetail.tableNo ? `Table ${selectedKotDetail.tableNo}` : 'Take Away'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kitchen Station</span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{selectedKotDetail.station || 'Main Kitchen'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Time Elapsed</span>
                <span className="font-mono font-bold text-slate-700 text-sm mt-0.5 block">
                  {getElapsedTimeMinutes(selectedKotDetail.createdAt)} mins ago
                </span>
              </div>
            </div>

            {/* Modification banner if any */}
            {selectedKotDetail.type === KOT_TYPE.MODIFICATION && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Modification Reason: {selectedKotDetail.notes || selectedKotDetail.modificationReason || 'Customer requested extra items'}</span>
              </div>
            )}

            {/* Preparation Progress Bar if in PREPARING */}
            {selectedKotDetail.status === KOT_STATUS.PREPARING && (
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-900">
                    <Flame className="w-4 h-4 text-orange-600 animate-pulse" />
                    <span>Cooking in Progress: {currentPreparedCount} of {currentTotalItems} items prepared ({prepProgressPct}%)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMarkAllItemsPrepared(selectedKotDetail)}
                    className="text-xs font-bold text-orange-700 hover:text-orange-900 bg-white px-2.5 py-1 rounded-lg border border-orange-200 transition-colors shadow-2xs"
                  >
                    Mark All Prepared
                  </button>
                </div>
                <div className="w-full bg-orange-200/70 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-emerald-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${prepProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Item-by-item Dish Preparation Checklist (Without Prices) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Ordered Dishes for Kitchen Prep ({selectedKotDetail.items?.length || 0} items)
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Click dish to mark as prepared</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                {(selectedKotDetail.items || []).map((itm, idx) => {
                  const isChecked = Boolean(currentKotPreparedMap[idx]);
                  const canCheck = selectedKotDetail.status === KOT_STATUS.PREPARING;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (canCheck) handleToggleItemPrepared(selectedKotDetail.id, idx);
                      }}
                      className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                        canCheck ? 'cursor-pointer hover:bg-slate-50' : ''
                      } ${isChecked ? 'bg-emerald-50/40' : ''}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {canCheck ? (
                          <button
                            type="button"
                            className="text-slate-400 hover:text-emerald-600 shrink-0"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </button>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                            {idx + 1}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 shrink-0">
                              {itm.quantity}x
                            </span>
                            <h5
                              className={`text-sm font-bold truncate ${
                                isChecked ? 'line-through text-slate-400 font-normal' : 'text-slate-800'
                              }`}
                            >
                              {itm.name || itm.productName}
                            </h5>
                          </div>

                          {itm.notes && (
                            <div className="mt-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 inline-block">
                              Chef Note: {itm.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {canCheck && (
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isChecked ? 'Ready' : 'In Prep'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                variant="secondary"
                icon={Printer}
                onClick={() => handlePrint(selectedKotDetail)}
              >
                Print Ticket
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {selectedKotDetail.status === KOT_STATUS.NEW ? (
                  <Button
                    variant="primary"
                    className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
                    icon={Flame}
                    loading={actionLoadingId === selectedKotDetail.id}
                    onClick={() => handleUpdateStatus(selectedKotDetail, KOT_STATUS.PREPARING)}
                  >
                    Start Preparation
                  </Button>
                ) : selectedKotDetail.status === KOT_STATUS.PREPARING ? (
                  <Button
                    variant="success"
                    className="w-full sm:w-auto ring-2 ring-emerald-300 shadow-md font-bold"
                    icon={CheckCircle2}
                    loading={actionLoadingId === selectedKotDetail.id}
                    onClick={() => handleUpdateStatus(selectedKotDetail, KOT_STATUS.READY)}
                  >
                    {allCurrentItemsPrepared ? '✓ All Items Prepared — Mark Ready for Serve' : 'Mark KOT Ready for Serve'}
                  </Button>
                ) : (
                  <div className="text-emerald-700 font-bold text-xs flex items-center gap-1.5 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>KOT Ready for Pickup by Captain</span>
                  </div>
                )}
                <Button variant="secondary" onClick={() => setSelectedKotDetail(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
