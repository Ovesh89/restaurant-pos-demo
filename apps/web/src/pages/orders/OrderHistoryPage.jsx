import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Percent,
  RefreshCw,
  FileDown,
  User,
  Clock,
  Layers,
  Eye,
  UtensilsCrossed,
  Printer,
  X,
  CreditCard,
  Phone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { orderRepository } from '../../services/repositories/orderRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { customerRepository } from '../../services/repositories/customerRepository';
import { printService } from '../../services/printing/printService';
import { useTranslation } from '../../hooks/useTranslation';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { ORDER_STATUS_CONFIG, getOrderStatusConfig } from '../../constants/orderStatus';

export const OrderHistoryPage = () => {
  const { t, formatNumber } = useTranslation();
  // Filter States
  const [datePreset, setDatePreset] = useState('THIS_MONTH'); // TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, LAST_MONTH, CUSTOM_DATE, MONTH_PICKER
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Dropdown Master Data
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Data & View States
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ORDERS'); // ORDERS, CATEGORIES, DAILY
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Initialize date bounds on mount
  useEffect(() => {
    applyPreset('THIS_MONTH');
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const [cats, custs] = await Promise.all([
        categoryRepository.getCategories().catch(() => []),
        customerRepository.getCustomers().catch(() => [])
      ]);
      setCategories(cats || []);
      setCustomers(custs || []);
    } catch (err) {
      console.warn('Failed to load filter metadata:', err);
    }
  };

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    if (preset === 'TODAY') {
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setStartDate(todayStr);
      setEndDate(todayStr);
      setSelectedMonth('');
    } else if (preset === 'YESTERDAY') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      setStartDate(yStr);
      setEndDate(yStr);
      setSelectedMonth('');
    } else if (preset === 'THIS_WEEK') {
      const dayOfWeek = now.getDay(); // 0 is Sunday
      const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diffToMonday);
      const mStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setStartDate(mStr);
      setEndDate(todayStr);
      setSelectedMonth('');
    } else if (preset === 'THIS_MONTH') {
      const monthStr = `${yyyy}-${mm}`;
      const firstDay = `${yyyy}-${mm}-01`;
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setSelectedMonth(monthStr);
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const prevMonth = new Date(yyyy, now.getMonth() - 1, 1);
      const pY = prevMonth.getFullYear();
      const pM = String(prevMonth.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(pY, prevMonth.getMonth() + 1, 0).getDate();
      const monthStr = `${pY}-${pM}`;
      setSelectedMonth(monthStr);
      setStartDate(`${pY}-${pM}-01`);
      setEndDate(`${pY}-${pM}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'MONTH_PICKER') {
      setSelectedMonth(`${yyyy}-${mm}`);
    }
  };

  const handleMonthChange = (mVal) => {
    setSelectedMonth(mVal);
    if (!mVal) return;
    const [y, m] = mVal.split('-');
    const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    setStartDate(`${y}-${m}-01`);
    setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
  };

  const loadHistory = async (overridePage = page, overrideLimit = limit) => {
    try {
      setLoading(true);
      const filters = {
        dateFrom: startDate || undefined,
        dateTo: endDate || undefined,
        month: datePreset === 'MONTH_PICKER' ? selectedMonth : undefined,
        customerId: selectedCustomer !== 'ALL' ? selectedCustomer : undefined,
        categoryId: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: search.trim() || undefined,
        page: overridePage,
        limit: overrideLimit
      };

      const result = await orderRepository.getOrderHistory(filters);
      setHistoryData(result);
    } catch (err) {
      console.error('Failed to load order history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate || endDate || selectedMonth) {
      setPage(1);
      loadHistory(1, limit);
    }
  }, [startDate, endDate, selectedMonth, selectedCustomer, selectedCategory, statusFilter]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadHistory(newPage, limit);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1);
    loadHistory(1, newLimit);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadHistory(1, limit);
  };

  // CSV Export utility
  const handleExportCSV = () => {
    if (!historyData?.orders || historyData.orders.length === 0) {
      alert('No orders to export in current filter.');
      return;
    }

    const headers = [
      'Order Number',
      'Date & Time',
      'Table',
      'Guest Name',
      'Guest Phone',
      'Captain',
      'Status',
      'Total Items',
      'Subtotal',
      'Tax',
      'Discount',
      'Grand Total'
    ];

    const rows = historyData.orders.map((o) => [
      `"${o.orderNo || o.orderNumber}"`,
      `"${new Date(o.createdAt).toLocaleString()}"`,
      `"Table ${o.tableNo || o.tableNumber}"`,
      `"${o.customer?.name || 'Walk-in'}"`,
      `"${o.customer?.mobile || ''}"`,
      `"${o.captainName || ''}"`,
      `"${o.status}"`,
      (o.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0),
      Number(o.subtotal || 0).toFixed(2),
      Number(o.taxTotal || 0).toFixed(2),
      Number(o.discountAmount || 0).toFixed(2),
      Number(o.grandTotal || 0).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Order_History_${startDate || 'start'}_to_${endDate || 'end'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Order List Columns
  const orderColumns = [
    {
      header: t('orders.orderId', null, 'Order #'),
      accessor: 'orderNo',
      className: 'w-24 font-mono font-black text-blue-700',
      render: (row) => (
        <span className="font-mono font-black text-blue-700 hover:underline cursor-pointer" onClick={() => setSelectedOrder(row)}>
          {row.orderNo || row.orderNumber}
        </span>
      )
    },
    {
      header: t('common.time', null, 'Date & Time'),
      accessor: 'createdAt',
      render: (row) => {
        const d = new Date(row.createdAt);
        return (
          <div className="text-xs">
            <span className="font-bold text-slate-800 block">
              {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-slate-400 font-medium">
              {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        );
      }
    },
    {
      header: t('tables.table', null, 'Table'),
      accessor: 'tableNo',
      render: (row) => (
        <span className="font-extrabold text-slate-800 text-sm">{t('orders.table', null, 'Table')} {row.tableNo || row.tableNumber}</span>
      )
    },
    {
      header: t('billing.customerInfo', null, 'Guest / Customer'),
      accessor: 'customer',
      render: (row) => {
        if (!row.customer) {
          return <span className="text-xs text-slate-400 italic">{t('orders.walkinGuest', null, 'Walk-in Guest')}</span>;
        }
        return (
          <div className="text-xs">
            <span className="font-bold text-slate-800 block">{row.customer.name}</span>
            {row.customer.mobile && (
              <span className="text-[11px] font-mono text-slate-500">{row.customer.mobile}</span>
            )}
          </div>
        );
      }
    },
    {
      header: t('menu.productsTitle', null, 'Dishes & Categories'),
      accessor: 'items',
      render: (row) => {
        const items = row.items || [];
        const totalItemsCount = items.reduce((acc, i) => acc + (i.quantity || 1), 0);
        const categoriesSeen = [...new Set(items.map((i) => i.categoryName).filter(Boolean))];
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {categoriesSeen.slice(0, 2).map((cat, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                >
                  {cat}
                </span>
              ))}
              {categoriesSeen.length > 2 && (
                <span className="text-[10px] text-slate-400 font-semibold">
                  +{formatNumber(categoriesSeen.length - 2)} {t('common.more', null, 'more')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 truncate max-w-xs">
              {items.map((i) => `${i.name || i.productName} (x${formatNumber(i.quantity)})`).join(', ')}
            </p>
          </div>
        );
      }
    },
    {
      header: t('orders.status', null, 'Status'),
      accessor: 'status',
      render: (row) => {
        const config = getOrderStatusConfig(row.status, t);
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${config.color}`}>
            {config.label}
          </span>
        );
      }
    },
    {
      header: `${t('reports.totalRevenue', null, 'Total Sales')} (₹)`,
      accessor: 'grandTotal',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-slate-900 text-sm">
          ₹{formatNumber(Number(row.grandTotal || row.subtotal || 0))}
        </span>
      )
    },
    {
      header: t('common.actions', null, 'Actions'),
      align: 'center',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          icon={Eye}
          onClick={() => setSelectedOrder(row)}
        >
          {t('common.details', null, 'Details')}
        </Button>
      )
    }
  ];

  // Category Breakdown Columns
  const categoryColumns = [
    {
      header: t('common.rank', null, 'Rank'),
      className: 'w-12 font-bold text-slate-400',
      render: (_, idx) => `#${formatNumber(idx + 1)}`
    },
    {
      header: t('menu.categoriesTitle', null, 'Menu Category'),
      accessor: 'categoryName',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800 text-sm">{row.categoryName}</span>
        </div>
      )
    },
    {
      header: t('reports.portionsSold', null, 'Portions Sold'),
      accessor: 'quantity',
      className: 'font-mono font-bold text-blue-600',
      render: (row) => `${formatNumber(row.quantity)} ${t('reports.portions', null, 'portions')}`
    },
    {
      header: t('reports.pctNetSales', null, '% of Net Sales'),
      accessor: 'percentage',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${Math.min(row.percentage, 100)}%` }}
            />
          </div>
          <span className="text-xs font-extrabold text-slate-700">{formatNumber(row.percentage)}%</span>
        </div>
      )
    },
    {
      header: `${t('reports.totalRevenue', null, 'Total Revenue')} (₹)`,
      accessor: 'revenue',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-slate-900 text-sm">
          ₹{formatNumber(Number(row.revenue))}
        </span>
      )
    }
  ];

  // Daily Breakdown Columns
  const dailyColumns = [
    {
      header: t('common.date', null, 'Date'),
      accessor: 'date',
      render: (row) => {
        const d = new Date(`${row.date}T00:00:00`);
        return (
          <span className="font-bold text-slate-800 text-sm">
            {d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        );
      }
    },
    {
      header: t('reports.ordersPlaced', null, 'Orders Placed'),
      accessor: 'ordersCount',
      className: 'font-mono font-bold text-slate-700',
      render: (row) => `${formatNumber(row.ordersCount)} ${t('reports.orders', null, 'orders')}`
    },
    {
      header: t('reports.dishesServed', null, 'Dishes Served'),
      accessor: 'itemsCount',
      className: 'font-mono text-slate-600',
      render: (row) => `${formatNumber(row.itemsCount || 0)} ${t('reports.items', null, 'items')}`
    },
    {
      header: `${t('reports.avgOrderValue', null, 'Average Order')} (₹)`,
      accessor: 'sales',
      render: (row) => {
        const aov = row.ordersCount > 0 ? Math.round(Number(row.sales) / row.ordersCount) : 0;
        return <span className="font-mono text-xs text-slate-600">₹{formatNumber(aov)}</span>;
      }
    },
    {
      header: `${t('reports.netSales', null, 'Net Day Sales')} (₹)`,
      accessor: 'sales',
      align: 'right',
      render: (row) => (
        <span className="font-black text-emerald-700 text-sm">
          ₹{formatNumber(Number(row.sales))}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('orders.historyTitle', null, 'Order History & Sales Analytics')}
        subtitle={t('orders.historySubtitle', null, 'Filter historical orders by Date & Month range, explore category breakdown, filter by customer, and review sales totals')}
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={FileDown} onClick={handleExportCSV}>
            {t('reports.exportCsv', null, 'Export CSV')}
          </Button>
          <Button variant="secondary" icon={RefreshCw} onClick={loadHistory} loading={loading}>
            {t('common.refresh', null, 'Refresh')}
          </Button>
        </div>
      </PageHeader>

      {/* Primary KPI Metrics for Date/Month Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('reports.totalRevenue', null, 'Total Net Sales')}
          value={loading ? '...' : `₹${formatNumber(historyData?.summary?.totalSales || 0)}`}
          subtitle={`${formatNumber(historyData?.summary?.validOrdersCount || 0)} ${t('reports.completedOrders', null, 'completed orders')}`}
          icon={TrendingUp}
          color="emerald"
        />

        <StatCard
          title={t('reports.totalBills', null, 'Total Orders Recorded')}
          value={loading ? '...' : String(formatNumber(historyData?.summary?.totalOrders || 0))}
          subtitle={t('reports.withinRange', null, 'Within selected date range')}
          icon={ShoppingBag}
          color="blue"
        />

        <StatCard
          title={t('reports.itemsSold', null, 'Dishes / Items Sold')}
          value={loading ? '...' : `${formatNumber(historyData?.summary?.totalItemsSold || 0)} ${t('reports.portions', null, 'portions')}`}
          subtitle={t('reports.acrossCategories', null, 'Across all menu categories')}
          icon={UtensilsCrossed}
          color="purple"
        />

        <StatCard
          title={t('reports.avgOrderValue', null, 'Average Order Value')}
          value={loading ? '...' : `₹${formatNumber(historyData?.summary?.averageOrderValue || 0)}`}
          subtitle={t('reports.revPerOrder', null, 'Revenue per valid order')}
          icon={DollarSign}
          color="amber"
        />
      </div>

      {/* Date & Range Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
        {/* Quick Range Presets */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> {t('reports.dateRange', null, 'Range')}:
            </span>
            {[
              { id: 'TODAY', label: t('reports.today', null, 'Today') },
              { id: 'YESTERDAY', label: t('reports.yesterday', null, 'Yesterday') },
              { id: 'THIS_WEEK', label: t('reports.thisWeek', null, 'This Week') },
              { id: 'THIS_MONTH', label: t('reports.thisMonth', null, 'This Month') },
              { id: 'LAST_MONTH', label: t('reports.lastMonth', null, 'Last Month') },
              { id: 'MONTH_PICKER', label: t('reports.pickMonth', null, 'Pick Month') },
              { id: 'CUSTOM_DATE', label: t('reports.customDates', null, 'Custom Dates') }
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  datePreset === preset.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold text-slate-400">
            {startDate} {endDate && `to ${endDate}`}
          </span>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Start Date / Month Picker */}
          {datePreset === 'MONTH_PICKER' ? (
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {t('reports.selectMonth', null, 'Select Month')}
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {t('reports.startDate', null, 'Start Date')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setDatePreset('CUSTOM_DATE');
                    setStartDate(e.target.value);
                  }}
                  className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {t('reports.endDate', null, 'End Date')}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setDatePreset('CUSTOM_DATE');
                    setEndDate(e.target.value);
                  }}
                  className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Customer Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {t('billing.customerInfo', null, 'Guest / Customer')}
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">{t('customers.allGuests', null, 'All Customers & Walk-ins')}</option>
              <option value="WALK_IN">{t('customers.walkInOnly', null, 'Walk-in Guests Only')}</option>
              {customers.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name} {c.mobile ? `(${c.mobile})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {t('menu.categoriesTitle', null, 'Menu Category')}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">{t('menu.allCategories', null, 'All Categories')}</option>
              {categories.map((cat) => (
                <option key={cat.id || cat._id} value={cat.id || cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {t('orders.searchOrdersItems', null, 'Search Orders / Items')}
            </label>
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Order #, Table, Dish..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 pl-8 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </form>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 text-xs overflow-x-auto no-scrollbar">
        {[
          { id: 'ORDERS', label: `${t('orders.ordersList', null, 'Orders List')} (${formatNumber(historyData?.orders?.length || 0)})` },
          { id: 'CATEGORIES', label: `${t('reports.categoryBreakdown', null, 'Category Breakdown')} (${formatNumber(historyData?.categoryBreakdown?.length || 0)})` },
          { id: 'DAILY', label: `${t('reports.dailySalesTrend', null, 'Daily Sales Trend')} (${formatNumber(historyData?.dailyBreakdown?.length || 0)} ${t('common.days', null, 'days')})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Orders History Table */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-3">
          <DataTable
            columns={orderColumns}
            data={historyData?.orders || []}
            loading={loading}
            emptyMessage={t('orders.noOrdersMatchingRange', null, 'No orders found matching the selected Date/Month range and filters.')}
            pagination={historyData?.pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handleLimitChange}
          />
        </div>
      )}

      {/* Tab 2: Category Breakdown Table */}
      {activeTab === 'CATEGORIES' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-800 mb-2">{t('reports.categoryPerformance', null, 'Category Sales Performance')}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Revenue distribution and quantity of dishes sold per menu category for the period {startDate} to {endDate}.
            </p>
            <DataTable
              columns={categoryColumns}
              data={historyData?.categoryBreakdown || []}
              loading={loading}
              emptyMessage={t('reports.noCategorySales', null, 'No category sales recorded in this date range.')}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Daily Sales Trend */}
      {activeTab === 'DAILY' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-800 mb-2">{t('reports.dailySalesTrend', null, 'Day-by-Day Sales Summary')}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Daily revenue breakdown, order volume, and average order value throughout the selected range.
            </p>
            <DataTable
              columns={dailyColumns}
              data={historyData?.dailyBreakdown || []}
              loading={loading}
              emptyMessage={t('reports.noDailySales', null, 'No daily sales records found for this period.')}
            />
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`${t('orders.viewDetails', null, 'Order Details')}: ${selectedOrder.orderNo || selectedOrder.orderNumber}`}
          subtitle={`${t('orders.table', null, 'Table')} ${selectedOrder.tableNo || selectedOrder.tableNumber} • Placed on ${new Date(selectedOrder.createdAt).toLocaleString()}`}
          maxWidth="max-w-4xl sm:max-w-5xl"
        >
          <div className="space-y-5">
            {/* Order Overview Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('orders.status', null, 'Status')}</span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{selectedOrder.status}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('orders.captain', null, 'Captain / Server')}</span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{selectedOrder.captainName || 'Staff'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('billing.customerInfo', null, 'Customer')}</span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                  {selectedOrder.customer?.name || t('orders.walkinGuest', null, 'Walk-in Guest')}
                </span>
                {selectedOrder.customer?.mobile && (
                  <span className="text-[11px] text-slate-500 font-mono">{selectedOrder.customer.mobile}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('billing.finalPayable', null, 'Grand Total')}</span>
                <span className="font-black text-blue-700 text-base mt-0.5 block">
                  ₹{formatNumber(Number(selectedOrder.grandTotal || selectedOrder.subtotal || 0))}
                </span>
              </div>
            </div>

            {/* Dishes & Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{t('kitchen.orderedDishes', null, 'Ordered Dishes & Items')}</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">{t('menu.productName', null, 'Dish Name')}</th>
                      <th className="py-2.5 px-3">{t('menu.categoryName', null, 'Category')}</th>
                      <th className="py-2.5 px-3 text-center">{t('common.qty', null, 'Qty')}</th>
                      <th className="py-2.5 px-3 text-right">{t('menu.price', null, 'Unit Price')}</th>
                      <th className="py-2.5 px-3 text-right">{t('common.total', null, 'Line Total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedOrder.items || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{formatNumber(idx + 1)}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {it.name || it.productName}
                          {it.notes && <span className="text-[11px] text-slate-400 font-normal block italic">{it.notes}</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {it.categoryName || 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600">
                          {formatNumber(it.quantity)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          ₹{formatNumber(Number(it.unitPrice || it.price || 0).toFixed(2))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{formatNumber((Number(it.quantity || 1) * Number(it.unitPrice || it.price || 0)).toFixed(2))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{t('billing.subtotalAmount', null, 'Food Subtotal:')}</span>
                <span className="font-mono font-semibold">₹{formatNumber(Number(selectedOrder.subtotal || 0).toFixed(2))}</span>
              </div>
              {Number(selectedOrder.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>{t('billing.discountAmount', null, 'Discount Applied:')}</span>
                  <span className="font-mono">-₹{formatNumber(Number(selectedOrder.discountAmount).toFixed(2))}</span>
                </div>
              )}
              {Number(selectedOrder.taxTotal || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{t('billing.totalTax', null, 'Applicable GST:')}</span>
                  <span className="font-mono font-semibold">₹{formatNumber(Number(selectedOrder.taxTotal).toFixed(2))}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                <span>{t('billing.finalPayable', null, 'Grand Total:')}</span>
                <span className="font-mono text-blue-700">
                  ₹{formatNumber(Number(selectedOrder.grandTotal || selectedOrder.subtotal || 0).toFixed(2))}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="secondary"
                icon={Printer}
                onClick={() => {
                  try {
                    const billData = selectedOrder.bill || {
                      ...selectedOrder,
                      billNo: selectedOrder.bill?.billNumber || selectedOrder.orderNo,
                      items: selectedOrder.items,
                      grandTotal: selectedOrder.grandTotal,
                      subtotal: selectedOrder.subtotal,
                      taxAmount: selectedOrder.taxTotal,
                      discountAmount: selectedOrder.discountAmount,
                    };
                    printService.printInvoice(billData, selectedOrder, selectedOrder.customer);
                  } catch (err) {
                    alert(err.message || 'Unable to print invoice.');
                  }
                }}
              >
                {t('billing.reprint', null, 'Print Invoice')}
              </Button>
              <Button variant="primary" onClick={() => setSelectedOrder(null)}>
                {t('common.close', null, 'Close')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
