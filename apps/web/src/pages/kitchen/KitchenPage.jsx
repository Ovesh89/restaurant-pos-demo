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
  Filter
} from 'lucide-react';
import { kotRepository } from '../../services/repositories/kotRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { printService } from '../../services/printing/printService';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { KOT_STATUS, KOT_STATUS_CONFIG, KOT_TYPE } from '../../constants/orderStatus';
import { APP_CONFIG } from '../../config/appConfig';

export const KitchenPage = () => {
  const { user } = useAuth();

  const [kots, setKots] = useState([]);
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // ACTIVE (New/Preparing), or ALL, or READY
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadKOTs = async () => {
    try {
      setLoading(true);
      const data = await kotRepository.getKOTs({
        station: selectedStation === 'ALL' ? undefined : selectedStation
      });
      setKots(data);
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
    }, 10000);
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
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kitchen Display System (KDS)"
        subtitle="Live chef tickets queue, station-wise dish dispatching, and thermal receipt printing"
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
            const statusConfig = KOT_STATUS_CONFIG[kot.status] || KOT_STATUS_CONFIG[KOT_STATUS.NEW];
            const isCooking = kot.status === KOT_STATUS.PREPARING;
            const isReady = kot.status === KOT_STATUS.READY;

            return (
              <div
                key={kot.id}
                className={`bg-white rounded-2xl border shadow-xs transition-shadow flex flex-col justify-between overflow-hidden ${
                  kot.status === KOT_STATUS.NEW
                    ? 'border-blue-300 ring-2 ring-blue-100'
                    : isCooking
                    ? 'border-orange-300'
                    : 'border-slate-200'
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
                      <h4 className="text-xl font-black text-slate-800">Table {kot.tableNo}</h4>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order</span>
                      <p className="text-xs font-bold text-slate-700">{kot.orderNo}</p>
                      <p className="text-[10px] text-slate-400">{kot.captainName}</p>
                    </div>
                  </div>

                  {/* Modification Note Banner */}
                  {kot.type === KOT_TYPE.MODIFICATION && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                      <b>Modification delta:</b> {kot.modificationReason || 'Dish adjustment'}
                    </div>
                  )}

                  {/* Dishes List */}
                  <div className="divide-y divide-slate-100 text-xs space-y-2 py-1">
                    {kot.items.map((itm, iIdx) => (
                      <div key={iIdx} className="pt-2 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-base font-black text-blue-600 w-8 shrink-0">
                            {itm.quantity}x
                          </span>
                          <span className="font-bold text-slate-800 text-sm flex-1 leading-tight">
                            {itm.name}
                          </span>
                        </div>
                        {itm.notes && (
                          <div className="ml-8 mt-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 inline-block">
                            * {itm.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Station Badge */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {kot.station || 'Main Kitchen'}
                    </span>
                    <button
                      onClick={() => handlePrint(kot)}
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
                      onClick={() => handleUpdateStatus(kot, KOT_STATUS.PREPARING)}
                    >
                      Start Preparing
                    </Button>
                  ) : isCooking ? (
                    <Button
                      variant="success"
                      className="w-full"
                      icon={CheckCircle2}
                      loading={actionLoadingId === kot.id}
                      onClick={() => handleUpdateStatus(kot, KOT_STATUS.READY)}
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
    </div>
  );
};
