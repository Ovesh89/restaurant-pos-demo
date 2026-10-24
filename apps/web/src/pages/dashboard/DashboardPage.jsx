import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coffee,
  ShoppingBag,
  BellRing,
  ChefHat,
  Receipt,
  TrendingUp,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useRestaurant } from '../../context/RestaurantContext';
import { tableRepository } from '../../services/repositories/tableRepository';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { userRepository } from '../../services/repositories/userRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { kotRepository } from '../../services/repositories/kotRepository';
import { billRepository, BILL_STATUS } from '../../services/repositories/billRepository';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { PERMISSIONS } from '../../constants/permissions';
import { ORDER_STATUS, KOT_STATUS } from '../../constants/orderStatus';

export const DashboardPage = () => {
  const { user, role, hasPermission, hasAnyPermission } = useAuth();
  const { restaurantName, branchName, logo } = useRestaurant();
  const { t, formatNumber, formatCurrency } = useTranslation();
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [tables, products, categories, users, orders, kots, bills] = await Promise.all([
          tableRepository.getTables(),
          productRepository.getProducts(),
          categoryRepository.getCategories(),
          userRepository.getUsers(),
          orderRepository.getOrders(),
          kotRepository.getKOTs(),
          billRepository.getBills()
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
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 overflow-hidden">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-white/95 p-1.5 shadow-lg shadow-black/20 shrink-0 flex items-center justify-center border border-white/20">
            <img src={logo} alt={restaurantName} className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-blue-500/30 border border-blue-400/30 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold text-blue-100 mb-1 sm:mb-2 backdrop-blur-xs max-w-full">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">{restaurantName} • {t('dashboard.subtitle', null, 'Operations Live')}</span>
            </div>
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-black tracking-tight truncate">
              {t('dashboard.welcomeBack', null, 'Welcome back')}, {user?.name}!
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-xl truncate sm:overflow-visible sm:whitespace-normal">
              <span className="font-semibold text-white">{branchName}</span> •{' '}
              <span className="font-bold underline capitalize">{role}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons: 2*2 Grid on Mobile, Flex on Desktop */}
        <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:flex-wrap md:gap-2.5 shrink-0">
          {hasPermission(PERMISSIONS.ORDER_CREATE) && (
            <Button
              variant="secondary"
              onClick={() => navigate('/orders/new')}
              icon={ShoppingBag}
              className="bg-white text-blue-900 hover:bg-blue-50 font-bold border-none w-full h-10 sm:h-auto md:w-auto justify-center text-[11px] sm:text-xs py-0 sm:py-2.5 px-2 text-center"
            >
              <span className="sm:hidden">Take Order</span>
              <span className="hidden sm:inline">{t('dashboard.newOrderAction', null, 'Take Order')}</span>
            </Button>
          )}
          {hasPermission(PERMISSIONS.ORDER_CONFIRM) && (
            <Button
              variant="secondary"
              onClick={() => navigate('/reception')}
              icon={BellRing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 w-full h-10 sm:h-auto md:w-auto justify-center text-[11px] sm:text-xs py-0 sm:py-2.5 px-2 text-center"
            >
              <span className="sm:hidden">Approvals ({formatNumber(stats.waitingConfirmation)})</span>
              <span className="hidden sm:inline">{t('dashboard.receptionAction', null, 'Approval Queue')} ({formatNumber(stats.waitingConfirmation)})</span>
            </Button>
          )}
          {hasPermission(PERMISSIONS.KOT_VIEW) && (
            <Button
              variant="secondary"
              onClick={() => navigate('/kitchen')}
              icon={ChefHat}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 w-full h-10 sm:h-auto md:w-auto justify-center text-[11px] sm:text-xs py-0 sm:py-2.5 px-2 text-center"
            >
              <span className="sm:hidden">Kitchen KDS</span>
              <span className="hidden sm:inline">{t('dashboard.kitchenAction', null, 'Kitchen KDS')}</span>
            </Button>
          )}
          {hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]) && (
            <Button
              variant="success"
              onClick={() => navigate('/billing')}
              icon={Receipt}
              className="font-bold border border-emerald-400/40 shadow-md w-full h-10 sm:h-auto md:w-auto justify-center text-[11px] sm:text-xs py-0 sm:py-2.5 px-2 text-center"
            >
              <span className="sm:hidden">Billing Desk</span>
              <span className="hidden sm:inline">{t('dashboard.billingDeskAction', null, 'Billing Desk')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Primary Stat Grid (2*2 on Mobile, 4 columns on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5">
        <StatCard
          title={t('dashboard.activeOrders', null, 'Active Orders')}
          mobileTitle="Active Orders"
          value={loading ? '...' : formatNumber(stats.activeOrders)}
          subtitle={`${formatNumber(stats.waitingConfirmation)} ${t('dashboard.waitingApproval', null, 'waiting approval')}`}
          mobileSubtitle={`${formatNumber(stats.waitingConfirmation)} waiting`}
          icon={ShoppingBag}
          color="blue"
          onClick={() => navigate('/orders')}
        />

        <StatCard
          title={t('dashboard.kotsCooking', null, 'Cooking in Kitchen')}
          mobileTitle="Kitchen KOTs"
          value={loading ? '...' : formatNumber(stats.kotsPreparing)}
          subtitle={t('kitchen.pendingKots', null, 'KOTs currently on cook stations')}
          mobileSubtitle={`${formatNumber(stats.kotsPreparing)} cooking`}
          icon={ChefHat}
          color="amber"
          onClick={() => navigate('/kitchen')}
        />

        <StatCard
          title={t('dashboard.todaySales', null, "Today's Settled Sales")}
          mobileTitle="Settled Sales"
          value={loading ? '...' : formatCurrency(stats.todaySales)}
          subtitle={`${formatNumber(stats.paidBillsCount)} ${t('dashboard.paidBills', null, 'invoices settled')}`}
          mobileSubtitle={`${formatNumber(stats.paidBillsCount)} settled`}
          icon={TrendingUp}
          color="emerald"
          onClick={() => navigate('/orders/history')}
        />

        <StatCard
          title={t('nav.tableFloor', null, 'Floor Tables')}
          mobileTitle="Floor Tables"
          value={loading ? '...' : formatNumber(stats.totalTables)}
          subtitle={`${formatNumber(stats.availableTables)} ${t('common.available', null, 'open')}, ${formatNumber(stats.occupiedTables)} ${t('common.occupied', null, 'occupied')}`}
          mobileSubtitle={`${formatNumber(stats.availableTables)} free • ${formatNumber(stats.occupiedTables)} occ`}
          icon={Coffee}
          color="purple"
          onClick={() => navigate('/tables')}
        />
      </div>

      {/* Full-Width Operational Lifecycle Navigators (2*2 Grid on Mobile, 3 columns on Desktop) */}
      <div className="w-full space-y-4 sm:space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-6 shadow-sm">
          <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-0.5 sm:mb-1">{t('dashboard.quickLinks', null, 'Operational Lifecycle')}</h2>
          <p className="text-xs text-slate-500 mb-3 sm:mb-5">
            {t('dashboard.subtitle', null, 'Select module according to your workstation role.')}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
            {hasPermission(PERMISSIONS.ORDER_CREATE) && (
              <div
                onClick={() => navigate('/orders/new')}
                className="group p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/40 cursor-pointer transition-all flex flex-col sm:flex-row items-start gap-2 sm:gap-4 h-full min-h-[105px] sm:min-h-0 justify-between"
              >
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-blue-100 text-blue-700 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1 w-full">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-700 flex items-center justify-between gap-1">
                    <span className="sm:hidden truncate">Order Entry</span>
                    <span className="hidden sm:inline truncate">{t('dashboard.newOrderAction', null, 'Captain Order Entry')}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shrink-0" />
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2">
                    <span className="sm:hidden">Take table orders</span>
                    <span className="hidden sm:inline">{t('orders.createOrderSubtitle', null, 'Table-first order taking with category tabs and notes.')}</span>
                  </p>
                </div>
              </div>
            )}

            {hasPermission(PERMISSIONS.ORDER_CONFIRM) && (
              <div
                onClick={() => navigate('/reception')}
                className="group p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/40 cursor-pointer transition-all flex flex-col sm:flex-row items-start gap-2 sm:gap-4 h-full min-h-[105px] sm:min-h-0 justify-between"
              >
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-amber-100 text-amber-700 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
                  <BellRing className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1 w-full">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-amber-700 flex items-center justify-between gap-1">
                    <span className="sm:hidden truncate">Approvals</span>
                    <span className="hidden sm:inline truncate">{t('nav.orderApproval', null, 'Reception Approvals')}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shrink-0" />
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2">
                    <span className="sm:hidden">Confirm & dispatch</span>
                    <span className="hidden sm:inline">{t('reception.subtitle', null, 'Confirm submitted orders & automatically dispatch KOTs.')}</span>
                  </p>
                </div>
              </div>
            )}

            {hasPermission(PERMISSIONS.KOT_VIEW) && (
              <div
                onClick={() => navigate('/kitchen')}
                className="group p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-orange-400 bg-slate-50/50 hover:bg-orange-50/40 cursor-pointer transition-all flex flex-col sm:flex-row items-start gap-2 sm:gap-4 h-full min-h-[105px] sm:min-h-0 justify-between"
              >
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-orange-100 text-orange-700 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
                  <ChefHat className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1 w-full">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-orange-700 flex items-center justify-between gap-1">
                    <span className="sm:hidden truncate">Kitchen KDS</span>
                    <span className="hidden sm:inline truncate">{t('nav.kitchenKds', null, 'Kitchen Display (KDS)')}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shrink-0" />
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2">
                    <span className="sm:hidden">Cook & serve queue</span>
                    <span className="hidden sm:inline">{t('kitchen.subtitle', null, 'Station-wise cook tickets, ready markers & thermal print.')}</span>
                  </p>
                </div>
              </div>
            )}

            {hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]) && (
              <div
                onClick={() => navigate('/billing')}
                className="group p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/40 cursor-pointer transition-all flex flex-col sm:flex-row items-start gap-2 sm:gap-4 h-full min-h-[105px] sm:min-h-0 justify-between"
              >
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1 w-full">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-700 flex items-center justify-between gap-1">
                    <span className="sm:hidden truncate">Billing Desk</span>
                    <span className="hidden sm:inline truncate">{t('nav.billingDesk', null, 'Billing & Cashier')}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shrink-0" />
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2">
                    <span className="sm:hidden">Settle & print bills</span>
                    <span className="hidden sm:inline">{t('billing.subtitle', null, 'Generate bills, discounts, split payments (UPI/Cash/Card).')}</span>
                  </p>
                </div>
              </div>
            )}

            {hasPermission(PERMISSIONS.TABLE_VIEW) && (
              <div
                onClick={() => navigate('/tables')}
                className="group p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/40 cursor-pointer transition-all flex flex-col sm:flex-row items-start gap-2 sm:gap-4 h-full min-h-[105px] sm:min-h-0 justify-between"
              >
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-700 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
                  <Coffee className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1 w-full">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-indigo-700 flex items-center justify-between gap-1">
                    <span className="sm:hidden truncate">Floor Tables</span>
                    <span className="hidden sm:inline truncate">{t('nav.tableFloor', null, 'Table Floor Map')}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shrink-0" />
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2">
                    <span className="sm:hidden">Floor map & seating</span>
                    <span className="hidden sm:inline">{t('tables.subtitle', null, 'Check table occupation, seating pax, and take direct orders.')}</span>
                  </p>
                </div>
              </div>
            )}

            {hasPermission(PERMISSIONS.REPORT_VIEW) && (
              <div
                onClick={() => navigate('/reports')}
                className="group p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/40 cursor-pointer transition-all flex flex-col sm:flex-row items-start gap-2 sm:gap-4 h-full min-h-[105px] sm:min-h-0 justify-between"
              >
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-blue-100 text-blue-700 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1 w-full">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-700 flex items-center justify-between gap-1">
                    <span className="sm:hidden truncate">Sales Reports</span>
                    <span className="hidden sm:inline truncate">{t('nav.reportsAnalytics', null, 'Sales & Performance Reports')}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shrink-0" />
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2">
                    <span className="sm:hidden">Revenue & stats</span>
                    <span className="hidden sm:inline">{t('reports.subtitle', null, 'Revenue breakdowns, top selling dishes & captain sales.')}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
