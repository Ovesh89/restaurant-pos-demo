import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coffee,
  UtensilsCrossed,
  Layers,
  Users,
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  BellRing,
  ChefHat,
  Receipt,
  TrendingUp,
  IndianRupee
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { tableRepository } from '../../services/repositories/tableRepository';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { userRepository } from '../../services/repositories/userRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { kotRepository } from '../../services/repositories/kotRepository';
import { billRepository, BILL_STATUS } from '../../services/repositories/billRepository';
import { auditRepository } from '../../services/repositories/auditRepository';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { PERMISSIONS } from '../../constants/permissions';
import { ORDER_STATUS, KOT_STATUS } from '../../constants/orderStatus';

export const DashboardPage = () => {
  const { user, role, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTables: 0,
    availableTables: 0,
    occupiedTables: 0,
    activeOrders: 0,
    waitingConfirmation: 0,
    kotsPreparing: 0,
    totalProducts: 0,
    totalStaff: 0,
    todaySales: 0,
    paidBillsCount: 0,
    pendingBillsCount: 0,
    totalDiscount: 0
  });
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [tables, products, categories, users, orders, kots, bills, logs] = await Promise.all([
          tableRepository.getTables(),
          productRepository.getProducts(),
          categoryRepository.getCategories(),
          userRepository.getUsers(),
          orderRepository.getOrders(),
          kotRepository.getKOTs(),
          billRepository.getBills(),
          auditRepository.getAuditLogs()
        ]);

        const availTables = tables.filter((t) => t.status === 'AVAILABLE' && t.isActive).length;
        const occTables = tables.filter((t) => t.status !== 'AVAILABLE' && t.isActive).length;
        const activeOrds = orders.filter(
          (o) =>
            o.status !== ORDER_STATUS.COMPLETED &&
            o.status !== ORDER_STATUS.CANCELLED &&
            o.status !== ORDER_STATUS.REJECTED
        ).length;
        const waitingApproval = orders.filter((o) => o.status === ORDER_STATUS.WAITING_CONFIRMATION).length;
        const cookingKOTs = kots.filter((k) => k.status === KOT_STATUS.PREPARING).length;

        const paidBills = bills.filter((b) => b.status === BILL_STATUS.PAID);
        const pendingBills = bills.filter((b) => b.status === BILL_STATUS.PENDING);
        const sales = paidBills.reduce((acc, b) => acc + (b.grandTotal || 0), 0);
        const discounts = bills.reduce((acc, b) => acc + (b.discountAmount || 0), 0);

        setStats({
          totalTables: tables.length,
          availableTables: availTables,
          occupiedTables: occTables,
          activeOrders: activeOrds,
          waitingConfirmation: waitingApproval,
          kotsPreparing: cookingKOTs,
          totalProducts: products.length,
          totalStaff: users.filter((u) => u.isActive).length,
          todaySales: sales,
          paidBillsCount: paidBills.length,
          pendingBillsCount: pendingBills.length,
          totalDiscount: discounts
        });

        setRecentLogs(logs.slice(0, 6));
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/95 p-1.5 shadow-lg shadow-black/20 shrink-0 flex items-center justify-center border border-white/20">
            <img src="/logo.png" alt="Green Garden Pure Veg Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/30 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-semibold text-blue-100 mb-1.5 sm:mb-2 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="truncate">Green Garden Pure Veg • Operations Live</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-xl">
              Logged into <span className="font-semibold text-white">Main Branch (Gandhinagar)</span> as{' '}
              <span className="font-bold underline capitalize">{role}</span>. Complete dining, kitchen & billing flow active.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-2.5 shrink-0">
          {hasPermission(PERMISSIONS.ORDER_CREATE) && (
            <Button
              variant="secondary"
              onClick={() => navigate('/orders/new')}
              icon={ShoppingBag}
              className="bg-white text-blue-900 hover:bg-blue-50 font-bold border-none"
            >
              Take Order
            </Button>
          )}
          {hasPermission(PERMISSIONS.ORDER_CONFIRM) && (
            <Button
              variant="secondary"
              onClick={() => navigate('/reception')}
              icon={BellRing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              Approval Queue ({stats.waitingConfirmation})
            </Button>
          )}
          {hasPermission(PERMISSIONS.KOT_VIEW) && (
            <Button
              variant="secondary"
              onClick={() => navigate('/kitchen')}
              icon={ChefHat}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              Kitchen KDS
            </Button>
          )}
          {hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]) && (
            <Button
              variant="success"
              onClick={() => navigate('/billing')}
              icon={Receipt}
              className="font-bold border border-emerald-400/40 shadow-md"
            >
              Billing Desk
            </Button>
          )}
        </div>
      </div>

      {/* Primary Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        <StatCard
          title="Active Orders"
          value={loading ? '...' : `${stats.activeOrders}`}
          subtitle={`${stats.waitingConfirmation} waiting reception review`}
          icon={ShoppingBag}
          color="blue"
        />

        <StatCard
          title="Cooking in Kitchen"
          value={loading ? '...' : `${stats.kotsPreparing}`}
          subtitle="KOTs currently on cook stations"
          icon={ChefHat}
          color="amber"
        />

        <StatCard
          title="Today's Settled Sales"
          value={loading ? '...' : `₹${stats.todaySales.toLocaleString('en-IN')}`}
          subtitle={`${stats.paidBillsCount} invoices settled today`}
          icon={TrendingUp}
          color="emerald"
        />

        <StatCard
          title="Floor Tables"
          value={loading ? '...' : `${stats.totalTables}`}
          subtitle={`${stats.availableTables} open, ${stats.occupiedTables} occupied`}
          icon={Coffee}
          color="purple"
        />
      </div>

      {/* Two Column Section: Quick Access & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Operational Navigators */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-1">Operational Lifecycle</h2>
            <p className="text-xs text-slate-500 mb-5">
              Select module according to your workstation role.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hasPermission(PERMISSIONS.ORDER_CREATE) && (
                <div
                  onClick={() => navigate('/orders/new')}
                  className="group p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/40 cursor-pointer transition-all flex items-start gap-4"
                >
                  <div className="p-3 rounded-xl bg-blue-100 text-blue-700 group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 flex items-center gap-1">
                      Captain Order Entry
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Table-first order taking with category tabs and notes.
                    </p>
                  </div>
                </div>
              )}

              {hasPermission(PERMISSIONS.ORDER_CONFIRM) && (
                <div
                  onClick={() => navigate('/reception')}
                  className="group p-4 rounded-xl border border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/40 cursor-pointer transition-all flex items-start gap-4"
                >
                  <div className="p-3 rounded-xl bg-amber-100 text-amber-700 group-hover:scale-105 transition-transform">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-amber-700 flex items-center gap-1">
                      Reception Approvals
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Confirm submitted orders & automatically dispatch KOTs.
                    </p>
                  </div>
                </div>
              )}

              {hasPermission(PERMISSIONS.KOT_VIEW) && (
                <div
                  onClick={() => navigate('/kitchen')}
                  className="group p-4 rounded-xl border border-slate-200 hover:border-orange-400 bg-slate-50/50 hover:bg-orange-50/40 cursor-pointer transition-all flex items-start gap-4"
                >
                  <div className="p-3 rounded-xl bg-orange-100 text-orange-700 group-hover:scale-105 transition-transform">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-orange-700 flex items-center gap-1">
                      Kitchen Display (KDS)
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Station-wise cook tickets, ready markers & thermal print.
                    </p>
                  </div>
                </div>
              )}

              {hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]) && (
                <div
                  onClick={() => navigate('/billing')}
                  className="group p-4 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/40 cursor-pointer transition-all flex items-start gap-4"
                >
                  <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 flex items-center gap-1">
                      Billing & Cashier
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Generate bills, discounts, split payments (UPI/Cash/Card).
                    </p>
                  </div>
                </div>
              )}

              {hasPermission(PERMISSIONS.TABLE_VIEW) && (
                <div
                  onClick={() => navigate('/tables')}
                  className="group p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/40 cursor-pointer transition-all flex items-start gap-4"
                >
                  <div className="p-3 rounded-xl bg-indigo-100 text-indigo-700 group-hover:scale-105 transition-transform">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 flex items-center gap-1">
                      Table Floor Map
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Check table occupation, seating pax, and take direct orders.
                    </p>
                  </div>
                </div>
              )}

              {hasPermission(PERMISSIONS.REPORT_VIEW) && (
                <div
                  onClick={() => navigate('/reports')}
                  className="group p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/40 cursor-pointer transition-all flex items-start gap-4"
                >
                  <div className="p-3 rounded-xl bg-blue-100 text-blue-700 group-hover:scale-105 transition-transform">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 flex items-center gap-1">
                      Sales & Performance Reports
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Revenue breakdowns, top selling dishes & captain sales.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Live Audit Snippet */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Operational Log</h2>
                <p className="text-xs text-slate-500">Live order & kitchen events</p>
              </div>
              {hasPermission(PERMISSIONS.AUDIT_VIEW) && (
                <button
                  onClick={() => navigate('/audit')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  View All
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-xs text-slate-400">Loading activity...</p>
            ) : recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400">No events logged yet.</p>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-700">{log.action}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 line-clamp-2">{log.details}</p>
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{log.actorName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
