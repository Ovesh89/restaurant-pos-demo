import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  UtensilsCrossed,
  User,
  ShoppingBag,
  Calendar,
  Percent,
  RefreshCw,
  Wallet,
  ArrowUpRight
} from 'lucide-react';
import { reportRepository } from '../../services/repositories/reportRepository';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { DataTable } from '../../components/common/DataTable';
import { useTranslation } from '../../hooks/useTranslation';

export const ReportsPage = () => {
  const { t, formatNumber, formatCurrency } = useTranslation();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // OVERVIEW, ITEMS, CAPTAINS, PAYMENTS

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await reportRepository.getSalesReport();
      setReportData(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const itemColumns = [
    {
      header: t('reports.rank', 'Rank'),
      accessor: 'name',
      className: 'w-12 font-bold text-slate-400',
      render: (_, idx) => `#${formatNumber(idx + 1)}`
    },
    {
      header: t('menu.productName', 'Dish / Item Name'),
      accessor: 'name',
      render: (row) => <span className="font-bold text-slate-800 text-sm">{row.name}</span>
    },
    {
      header: t('reports.quantitySold', 'Quantity Sold'),
      accessor: 'quantity',
      className: 'font-mono font-bold text-blue-600',
      render: (row) => `${formatNumber(row.quantity)} ${t('reports.portions', 'portions')}`
    },
    {
      header: t('reports.revenueGenerated', 'Revenue Generated'),
      accessor: 'revenue',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-slate-900 text-sm">
          {formatCurrency(row.revenue)}
        </span>
      )
    }
  ];

  const captainColumns = [
    {
      header: t('reports.rank', 'Rank'),
      accessor: 'name',
      className: 'w-12 font-bold text-slate-400',
      render: (_, idx) => `#${formatNumber(idx + 1)}`
    },
    {
      header: t('orders.captain', 'Captain Name'),
      accessor: 'name',
      render: (row) => <span className="font-bold text-slate-800 text-sm">{row.name}</span>
    },
    {
      header: t('reports.ordersServed', 'Orders Served'),
      accessor: 'ordersCount',
      className: 'font-mono text-slate-600',
      render: (row) => `${formatNumber(row.ordersCount)} ${t('orders.orders', 'tables')}`
    },
    {
      header: t('reports.totalSales', 'Total Sales'),
      accessor: 'totalSales',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-slate-900 text-sm">
          {formatCurrency(row.totalSales)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title', 'Restaurant Operational Reports')}
        subtitle={t('reports.subtitle', 'Financial sales analytics, payment mode collection, top menu dishes, and captain performance')}
      >
        <Button variant="secondary" icon={RefreshCw} onClick={loadReports} loading={loading}>
          {t('reports.refreshAnalytics', 'Refresh Analytics')}
        </Button>
      </PageHeader>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('reports.totalRevenue', 'Total Net Sales')}
          value={loading ? '...' : formatCurrency(reportData?.totalNetSales || 0)}
          subtitle={`${formatNumber(reportData?.totalOrdersCount || 0)} ${t('orders.completedOrders', 'completed orders')}`}
          icon={TrendingUp}
          color="emerald"
        />

        <StatCard
          title={t('billing.subtotalAmount', 'Gross Food Subtotal')}
          value={loading ? '...' : formatCurrency(reportData?.totalSubtotal || 0)}
          subtitle="Pre-discount & pre-tax"
          icon={ShoppingBag}
          color="blue"
        />

        <StatCard
          title={t('billing.totalTax', 'Total GST Collected')}
          value={loading ? '...' : formatCurrency(reportData?.totalTax || 0)}
          subtitle="CGST (2.5%) + SGST (2.5%)"
          icon={DollarSign}
          color="purple"
        />

        <StatCard
          title={t('billing.discountAmount', 'Discounts Given')}
          value={loading ? '...' : formatCurrency(reportData?.totalDiscount || 0)}
          subtitle="Promotional & goodwill"
          icon={Percent}
          color="amber"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 text-xs overflow-x-auto no-scrollbar">
        {[
          { id: 'OVERVIEW', label: t('reports.paymentBreakdown', 'Payment Mode Breakup') },
          { id: 'ITEMS', label: t('reports.categoryPerformance', 'Top Dish Sales') },
          { id: 'CAPTAINS', label: t('reports.captainPerformance', 'Captain Performance') }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab View */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('payment.upi', 'UPI / QR Code')}</span>
            <h3 className="text-2xl font-black text-blue-600 mt-1">
              {formatCurrency(reportData?.paymentBreakdown?.UPI || 0)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Instant online transfers</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('payment.cash', 'Cash Currency')}</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {formatCurrency(reportData?.paymentBreakdown?.CASH || 0)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Cash drawer receipts</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('payment.card', 'Cards (Debit/Credit)')}</span>
            <h3 className="text-2xl font-black text-purple-600 mt-1">
              {formatCurrency(reportData?.paymentBreakdown?.CARD || 0)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">POS card swipe machines</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('payment.other', 'Other Modes')}</span>
            <h3 className="text-2xl font-black text-slate-700 mt-1">
              {formatCurrency(reportData?.paymentBreakdown?.OTHER || 0)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Vouchers / Cheques</p>
          </div>
        </div>
      )}

      {activeTab === 'ITEMS' && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-800">{t('reports.categoryPerformance', 'Dish Sales Ranking')}</h3>
          <DataTable
            columns={itemColumns}
            data={reportData?.itemSales || []}
            loading={loading}
            emptyMessage={t('reports.noDishSales', 'No dish sales recorded yet.')}
          />
        </div>
      )}

      {activeTab === 'CAPTAINS' && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-800">{t('reports.captainPerformance', 'Captain Sales Ranking')}</h3>
          <DataTable
            columns={captainColumns}
            data={reportData?.captainSales || []}
            loading={loading}
            emptyMessage={t('reports.noCaptainSales', 'No captain sales recorded yet.')}
          />
        </div>
      )}
    </div>
  );
};
