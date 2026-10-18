import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Coffee,
  Clock,
  User,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  UtensilsCrossed,
  Printer,
  Layers,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { orderRepository } from '../../services/repositories/orderRepository';
import { kotRepository } from '../../services/repositories/kotRepository';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { printService } from '../../services/printing/printService';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { ORDER_STATUS, ORDER_STATUS_CONFIG } from '../../constants/orderStatus';
import { PERMISSIONS } from '../../constants/permissions';

export const OrdersPage = () => {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [orderTypeFilter, setOrderTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState(null);

  // View Details Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderKOTs, setOrderKOTs] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Cancel Single Line Item Modal
  const [itemToRemove, setItemToRemove] = useState(null);
  const [removeItemReason, setRemoveItemReason] = useState('');
  const [removeItemError, setRemoveItemError] = useState('');
  const [removeItemLoading, setRemoveItemLoading] = useState(false);

  // Cancel Order Modal
  const [cancelOrderTarget, setCancelOrderTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Modify Order Modal
  const [modifyingOrder, setModifyingOrder] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('CATEGORIES');
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [modifiedItems, setModifiedItems] = useState([]);
  const [modificationReason, setModificationReason] = useState('');
  const [modError, setModError] = useState('');
  const [modLoading, setModLoading] = useState(false);

  const getResolvedStatus = (sf) => {
    if (sf === 'ACTIVE') {
      return [
        ORDER_STATUS.DRAFT,
        ORDER_STATUS.WAITING_CONFIRMATION,
        ORDER_STATUS.SUBMITTED,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.KOT_SENT,
        ORDER_STATUS.PREPARING,
        ORDER_STATUS.READY,
        ORDER_STATUS.SERVED,
        ORDER_STATUS.BILLING,
        ORDER_STATUS.BILL_PENDING,
      ];
    }
    if (sf === 'WAITING') {
      return ORDER_STATUS.WAITING_CONFIRMATION;
    }
    if (sf === 'ALL') {
      return undefined;
    }
    return sf;
  };

  const loadOrders = async (overridePage = page, overrideLimit = limit) => {
    try {
      setLoading(true);
      const data = await orderRepository.getOrders({
        status: getResolvedStatus(statusFilter),
        search: search.trim() || undefined,
        page: overridePage,
        limit: overrideLimit,
      });
      setOrders(data);
      setPagination(
        data.pagination || {
          total: data.length,
          page: overridePage,
          limit: overrideLimit,
          totalPages: Math.max(1, Math.ceil(data.length / overrideLimit)),
        }
      );
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadOrders(1, limit);
  }, [statusFilter, search]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadOrders(page, limit);
    }, 15000);
    return () => clearInterval(timer);
  }, [page, limit, statusFilter, search]);

  const handleOpenDetails = async (order) => {
    setSelectedOrder(order);
    setDetailsLoading(true);
    try {
      const orderTargetId = order.id || order._id || order.orderNo || order.orderNumber;
      const kots = await kotRepository.getKOTs({ orderId: orderTargetId });
      setOrderKOTs(kots);
    } catch (err) {
      console.error('Failed to load linked KOTs:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleMarkServed = async (order) => {
    try {
      const actor = { id: user?.id || 'captain', name: user?.name || 'Staff' };
      const orderTargetId = order.id || order._id || order.orderNo || order.orderNumber;
      await orderRepository.markAsServed(orderTargetId, actor);
      await loadOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenCancel = (order) => {
    setCancelOrderTarget(order);
    setCancelReason('');
    setCancelError('');
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setCancelError('Mandatory cancellation reason required.');
      return;
    }

    setCancelLoading(true);
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Staff' };
      const orderTargetId = cancelOrderTarget.id || cancelOrderTarget._id || cancelOrderTarget.orderNo || cancelOrderTarget.orderNumber;
      await orderRepository.cancelOrder(orderTargetId, cancelReason, actor);
      setCancelOrderTarget(null);
      await loadOrders();
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel order.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleOpenRemoveItem = (item) => {
    setItemToRemove(item);
    setRemoveItemReason('');
    setRemoveItemError('');
  };

  const handleConfirmRemoveItem = async (e) => {
    e.preventDefault();
    if (!removeItemReason.trim()) {
      setRemoveItemError('Mandatory reason is required to remove this dish.');
      return;
    }
    if (!itemToRemove || !selectedOrder) return;

    setRemoveItemLoading(true);
    setRemoveItemError('');
    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      const orderTargetId = selectedOrder.id || selectedOrder._id || selectedOrder.orderNo || selectedOrder.orderNumber;
      const updatedOrder = await orderRepository.cancelOrderItem(
        orderTargetId,
        itemToRemove.lineId || itemToRemove.productId,
        removeItemReason.trim(),
        actor
      );

      // Refresh selected order modal view
      setSelectedOrder(updatedOrder);
      setItemToRemove(null);

      // Refresh linked KOTs if any
      try {
        const kots = await kotRepository.getKOTs({ orderId: orderTargetId });
        setOrderKOTs(kots);
      } catch (kotErr) {
        console.warn('Failed to refresh linked KOTs:', kotErr);
      }

      // Refresh table list
      await loadOrders();
    } catch (err) {
      console.error('Failed to remove item from order:', err);
      setRemoveItemError(err.message || 'Failed to remove dish from order.');
    } finally {
      setRemoveItemLoading(false);
    }
  };

  // Modification flow
  const handleOpenModify = async (order) => {
    setModifyingOrder(order);
    setModifiedItems(JSON.parse(JSON.stringify(order.items || [])));
    setModificationReason('');
    setModError('');
    setQuickAddSearch('');
    setActiveCategory('CATEGORIES');
    try {
      const [prods, cats] = await Promise.all([
        productRepository.getProducts({ onlyAvailable: true }),
        categoryRepository.getCategories(false)
      ]);
      setAvailableProducts(prods || []);
      setCategories(cats || []);
    } catch (err) {
      console.error('Failed to load menu products/categories for order modification:', err);
    }
  };

  const handleAddDishToModified = (prod) => {
    const prodCat = categories.find((c) => (c.id || c._id) === (prod.categoryId || prod.category));
    const kotRequired = prod.kotRequired !== undefined
      ? prod.kotRequired
      : (prodCat?.kotRequired !== undefined ? prodCat.kotRequired : true);

    const targetProductId = prod.id || prod._id;

    setModifiedItems((prev) => {
      const idx = prev.findIndex((i) => (i.productId || i.id || i._id) === targetProductId);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      } else {
        return [
          ...prev,
          {
            lineId: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            productId: targetProductId,
            categoryId: prod.categoryId || prod.category || null,
            name: prod.name,
            code: prod.code,
            quantity: 1,
            unitPrice: prod.price,
            taxRate: prod.taxRate || 5,
            station: prod.station || 'Main Curry',
            notes: '',
            kotRequired
          }
        ];
      }
    });
  };

  const handleAdjustModQty = (productId, delta) => {
    setModifiedItems((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId || item.id === productId || item._id === productId) {
            const n = item.quantity + delta;
            return n > 0 ? { ...item, quantity: n } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveModItem = (productId) => {
    setModifiedItems((prev) => prev.filter((i) => i.productId !== productId && i.id !== productId && i._id !== productId));
  };

  const filteredQuickProducts = availableProducts.filter((p) => {
    const matchesSearch =
      !quickAddSearch.trim() ||
      p.name?.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
      p.code?.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
      p.station?.toLowerCase().includes(quickAddSearch.toLowerCase());

    const matchesCategory =
      activeCategory === 'ALL' ||
      activeCategory === 'CATEGORIES' ||
      p.categoryId === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const getModificationChanges = () => {
    if (!modifyingOrder) return { added: 0, updated: 0, removed: 0, deltaCount: 0, requiresKot: false };
    const origMap = new Map((modifyingOrder.items || []).map((i) => [i.productId || i.id || i._id, i.quantity]));
    const newMap = new Map(modifiedItems.map((i) => [i.productId || i.id || i._id, i.quantity]));

    let added = 0;
    let updated = 0;
    let removed = 0;
    let requiresKot = false;

    for (const item of modifiedItems) {
      const pId = item.productId || item.id || item._id;
      const qty = item.quantity;
      const prodCat = categories.find((c) => (c.id || c._id) === (item.categoryId || item.category));
      const itemKotReq = item.kotRequired !== undefined
        ? item.kotRequired
        : (prodCat?.kotRequired !== undefined ? prodCat.kotRequired : true);

      if (!origMap.has(pId)) {
        added++;
        if (itemKotReq) requiresKot = true;
      } else if (origMap.get(pId) !== qty) {
        updated++;
        if (itemKotReq) requiresKot = true;
      }
    }
    for (const [pId] of origMap.entries()) {
      if (!newMap.has(pId)) {
        removed++;
        requiresKot = true;
      }
    }
    return { added, updated, removed, deltaCount: added + updated + removed, requiresKot };
  };

  const handleSubmitModification = async (e) => {
    e.preventDefault();
    if (!modificationReason.trim()) {
      setModError('Mandatory reason required for modifying order items.');
      return;
    }
    if (modifiedItems.length === 0) {
      setModError('Order cannot have 0 dishes. Cancel order instead.');
      return;
    }

    setModLoading(true);
    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      const orderTargetId = modifyingOrder.id || modifyingOrder._id || modifyingOrder.orderNo || modifyingOrder.orderNumber;
      await orderRepository.modifyOrderItems(
        orderTargetId,
        modifiedItems,
        modificationReason,
        actor
      );
      setModifyingOrder(null);
      await loadOrders();
    } catch (err) {
      setModError(err.message || 'Error modifying items.');
    } finally {
      setModLoading(false);
    }
  };

  const columns = [
    {
      header: 'Order #',
      accessor: 'orderNo',
      className: 'w-24 font-mono font-extrabold text-blue-700'
    },
    {
      header: 'Table / Source',
      accessor: 'tableNo',
      render: (row) => {
        if (row.orderType && row.orderType !== 'DINE_IN') {
          const typeBadgeStyles = {
            TAKEAWAY: 'bg-amber-50 text-amber-800 border-amber-200',
            ZOMATO: 'bg-rose-50 text-rose-800 border-rose-200',
            SWIGGY: 'bg-orange-50 text-orange-800 border-orange-200',
            ONLINE_OTHER: 'bg-purple-50 text-purple-800 border-purple-200',
          };
          const badgeClass = typeBadgeStyles[row.orderType] || 'bg-slate-100 text-slate-800 border-slate-200';
          const typeLabel = row.orderType === 'TAKEAWAY' ? 'Take Away' : row.orderType;

          return (
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-black border ${badgeClass}`}>
                {typeLabel}
              </span>
              {row.onlineOrderRef && (
                <p className="text-[11px] font-mono font-bold text-slate-600 mt-0.5">#{row.onlineOrderRef}</p>
              )}
              {row.customerName && (
                <p className="text-[11px] text-slate-500 font-medium">{row.customerName}</p>
              )}
            </div>
          );
        }

        return (
          <div>
            <span className="font-extrabold text-slate-800 text-sm">Table {row.tableNo || '-'}</span>
            {row.customerName && (
              <p className="text-[11px] text-slate-500 font-medium">{row.customerName}</p>
            )}
          </div>
        );
      }
    },
    {
      header: 'Captain',
      accessor: 'captainName',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.captainName}</span>
        </div>
      )
    },
    {
      header: 'Dishes',
      accessor: 'items',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.items?.reduce((a, b) => a + b.quantity, 0)} items ({row.items?.length} dishes)
        </span>
      )
    },
    {
      header: 'Subtotal (INR)',
      accessor: 'subtotal',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-slate-900 text-sm">₹{row.subtotal?.toLocaleString()}</span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const config = ORDER_STATUS_CONFIG[row.status] || { label: row.status, color: 'bg-slate-100 text-slate-700' };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${config.color}`}>
            {config.label}
          </span>
        );
      }
    },
    {
      header: 'Time',
      accessor: 'createdAt',
      className: 'text-xs text-slate-400 font-mono',
      render: (row) => new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const isCompleted = row.status === ORDER_STATUS.COMPLETED || row.status === ORDER_STATUS.CANCELLED;
        const isReady = row.status === ORDER_STATUS.READY;

        return (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => handleOpenDetails(row)}
              title="View Order Details"
              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>

            {isReady && (
              <Button
                variant="success"
                size="sm"
                onClick={() => handleMarkServed(row)}
              >
                Mark Served
              </Button>
            )}

            {!isCompleted && row.status !== ORDER_STATUS.WAITING_CONFIRMATION && (
              <Button
                variant="secondary"
                size="sm"
                icon={Edit2}
                title="Modify dishes or add items"
                onClick={() => handleOpenModify(row)}
              >
                Modify
              </Button>
            )}

            {!isCompleted && (
              <button
                onClick={() => handleOpenCancel(row)}
                title="Cancel Order with Reason"
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Restaurant Orders"
        subtitle="Manage ongoing table orders, modification deltas, kitchen state, and cancellations"
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={Clock} onClick={() => navigate('/orders/history')}>
            Order History & Analytics
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/orders/new')}>
            Take New Order
          </Button>
        </div>
      </PageHeader>

      {/* Filter Tabs */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Status Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'ACTIVE', label: 'Active Orders' },
            { id: 'WAITING', label: 'Waiting Approval' },
            { id: ORDER_STATUS.KOT_SENT, label: 'KOT Sent' },
            { id: ORDER_STATUS.PREPARING, label: 'In Kitchen' },
            { id: ORDER_STATUS.READY, label: 'Ready to Serve' },
            { id: ORDER_STATUS.SERVED, label: 'Served' },
            { id: 'ALL', label: 'All History' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Order Type & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <select
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value)}
            className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">All Order Types</option>
            <option value="DINE_IN">Dine In (Tables)</option>
            <option value="TAKEAWAY">Take Away</option>
            <option value="ZOMATO">Zomato</option>
            <option value="SWIGGY">Swiggy</option>
            <option value="ONLINE_OTHER">Online Other</option>
          </select>

          <div className="w-full sm:w-64">
            <Input
              icon={Search}
              placeholder="Search order #, table, captain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <DataTable
        columns={columns}
        data={orders.filter((o) => {
          if (orderTypeFilter === 'ALL') return true;
          return (o.orderType || 'DINE_IN') === orderTypeFilter;
        })}
        loading={loading}
        emptyMessage="No table orders found for this filter."
        pagination={pagination}
        onPageChange={(p) => {
          setPage(p);
          loadOrders(p, limit);
        }}
        onPageSizeChange={(l) => {
          setLimit(l);
          setPage(1);
          loadOrders(1, l);
        }}
      />

      {/* View Order Details & KOT Tickets Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Order Details: ${selectedOrder?.orderNo}`}
        subtitle={`${selectedOrder?.orderType && selectedOrder.orderType !== 'DINE_IN' ? (selectedOrder.orderType === 'TAKEAWAY' ? 'Take Away' : selectedOrder.orderType) : `Table ${selectedOrder?.tableNo}`} • Captain: ${selectedOrder?.captainName || 'Staff'}`}
        maxWidth="max-w-2xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Order Status Bar */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500">Current Order State</span>
                <div className="mt-1">
                  <Badge variant="primary" size="md">{selectedOrder.status}</Badge>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Subtotal Amount</span>
                <p className="text-xl font-black text-slate-900">₹{selectedOrder.subtotal?.toLocaleString()}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Canonical Order Dishes (Captured Prices)
                </h4>
                {selectedOrder.status !== ORDER_STATUS.COMPLETED && selectedOrder.status !== ORDER_STATUS.PAID && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    Remove dish recalculates total &amp; pending bill
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {selectedOrder.items?.map((item, idx) => {
                  const isSettled = selectedOrder.status === ORDER_STATUS.COMPLETED || selectedOrder.status === ORDER_STATUS.PAID;
                  return (
                    <div key={item.lineId || item.productId || idx} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                          {item.kotRequired === false && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                              No KOT
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 font-mono">
                          ({item.quantity}x @ ₹{item.unitPrice})
                        </span>
                        {item.notes && (
                          <p className="text-[11px] text-blue-600 italic mt-0.5">* {item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-slate-900 text-sm">
                          ₹{item.quantity * item.unitPrice}
                        </span>
                        {!isSettled && (
                          <button
                            type="button"
                            onClick={() => handleOpenRemoveItem(item)}
                            title="Remove dish from order (recalculates pending bill)"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Associated KOT Tickets */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Operational KOT Tickets ({orderKOTs.length})
              </h4>
              {detailsLoading ? (
                <p className="text-xs text-slate-400">Loading KOT tickets...</p>
              ) : orderKOTs.length === 0 ? (
                <p className="text-xs text-slate-400">No KOT tickets issued yet (Order may be in draft/waiting state or KOT not required).</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {orderKOTs.map((kot) => (
                    <div key={kot.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-blue-700 font-mono">{kot.kotNo}</span>
                          <span className="font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                            {kot.type} Rev #{kot.revision}
                          </span>
                          <span className="text-slate-500 font-bold capitalize">[{kot.status}]</span>
                        </div>
                        <p className="text-slate-500 mt-1">
                          {kot.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      </div>

                      <button
                        onClick={() => printService.printKOT(kot, selectedOrder, { tableNo: selectedOrder.tableNo })}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 bg-white p-2 rounded-lg border border-slate-200"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
              {hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]) &&
                selectedOrder.status !== ORDER_STATUS.CANCELLED &&
                selectedOrder.status !== ORDER_STATUS.REJECTED &&
                selectedOrder.status !== ORDER_STATUS.COMPLETED && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      const tId = selectedOrder.tableId;
                      const oId = selectedOrder.id;
                      setSelectedOrder(null);
                      if (tId) {
                        navigate(`/billing?tableId=${tId}`);
                      } else {
                        navigate(`/billing?orderId=${oId}`);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    Proceed to Billing & Pay
                  </Button>
                )}
              <div className="sm:ml-auto">
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setSelectedOrder(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Remove Single Dish Modal */}
      <Modal
        isOpen={!!itemToRemove}
        onClose={() => setItemToRemove(null)}
        title="Remove Dish from Order"
        subtitle={`Remove "${itemToRemove?.name}" (${itemToRemove?.quantity}x @ ₹${itemToRemove?.unitPrice})`}
      >
        <form onSubmit={handleConfirmRemoveItem} className="space-y-4">
          {removeItemError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {removeItemError}
            </div>
          )}

          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
            <p className="font-bold">Item Removal Impact</p>
            <p className="mt-1">
              Removing this dish will deduct <b>₹{(itemToRemove?.quantity || 1) * (itemToRemove?.unitPrice || 0)}</b> from the order total and automatically recalculate any unsettled bill.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Removal (Mandatory)
            </label>
            <textarea
              rows="3"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
              placeholder="e.g. Guest changed mind, dish out of stock, incorrect dish added..."
              value={removeItemReason}
              onChange={(e) => setRemoveItemReason(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setItemToRemove(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={removeItemLoading}>
              Confirm Removal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        isOpen={!!cancelOrderTarget}
        onClose={() => setCancelOrderTarget(null)}
        title="Cancel Order"
        subtitle={`Mandatory audit reason required to cancel ${cancelOrderTarget?.orderNo}`}
      >
        <form onSubmit={handleConfirmCancel} className="space-y-4">
          {cancelError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {cancelError}
            </div>
          )}

          <div className="bg-red-50/60 p-3 rounded-xl border border-red-200 text-xs text-red-800">
            <p className="font-bold">Cancellation Warning</p>
            <p className="mt-0.5">
              Cancelling this order will release Table {cancelOrderTarget?.tableNo} back to AVAILABLE and cancel any active kitchen tickets. This action cannot be reversed.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Order Cancellation (Mandatory)
            </label>
            <textarea
              rows="3"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
              placeholder="e.g. Guests left before preparation, duplicate order entered..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
              autoFocus
            ></textarea>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setCancelOrderTarget(null)}>
              Abort
            </Button>
            <Button type="submit" variant="danger" loading={cancelLoading}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modify Order Items Modal (Generates Delta KOT) */}
      <Modal
        isOpen={!!modifyingOrder}
        onClose={() => setModifyingOrder(null)}
        title={`Modify Order Dishes: ${modifyingOrder?.orderNo}`}
        subtitle="Add, reduce or remove dishes. A modification delta KOT will be dispatched to the kitchen."
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSubmitModification} className="space-y-4">
          {modError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {modError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Current Items in Order (5 of 12 cols on desktop) */}
            <div className="lg:col-span-5 border border-slate-200 rounded-2xl p-3.5 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Order Dishes</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                    {modifiedItems.length} {modifiedItems.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>
                <span className="text-xs font-extrabold text-blue-700">
                  ₹{modifiedItems.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0)}
                </span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-200/80 text-xs max-h-[360px] overflow-y-auto pr-1">
                {modifiedItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <p className="font-semibold">No dishes in this order</p>
                    <p className="text-[11px] mt-0.5">Pick dishes from Quick Add to add them</p>
                  </div>
                ) : (
                  modifiedItems.map((itm) => {
                    const orig = modifyingOrder?.items?.find((o) => o.productId === itm.productId);
                    const isNew = !orig;
                    const qtyChange = isNew ? itm.quantity : itm.quantity - orig.quantity;

                    return (
                      <div key={itm.productId} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-800 text-xs truncate">{itm.name}</p>
                            {itm.kotRequired === false && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                No KOT
                              </span>
                            )}
                            {isNew ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                + NEW
                              </span>
                            ) : qtyChange !== 0 ? (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-black border ${
                                  qtyChange > 0
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                {qtyChange > 0 ? `+${qtyChange}` : qtyChange}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                            ₹{itm.unitPrice} each • <span className="font-bold text-slate-600">₹{itm.quantity * itm.unitPrice}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAdjustModQty(itm.productId, -1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-black text-slate-700 hover:bg-slate-100 active:scale-95 shadow-2xs"
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="font-black px-1.5 min-w-[20px] text-center text-xs">
                            {itm.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustModQty(itm.productId, 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-black text-slate-700 hover:bg-slate-100 active:scale-95 shadow-2xs"
                            title="Increase quantity"
                          >
                            +
                          </button>
                          {isNew && (
                            <button
                              type="button"
                              onClick={() => handleRemoveModItem(itm.productId)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 ml-0.5 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Order summary note */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total Dishes: <strong className="text-slate-800">{modifiedItems.reduce((a, b) => a + b.quantity, 0)}</strong></span>
                <span>Table: <strong className="text-slate-800">Table {modifyingOrder?.tableNo}</strong></span>
              </div>
            </div>

            {/* Right Column: Quick Add Dish with Categories and Filter (7 of 12 cols on desktop) */}
            <div className="lg:col-span-7 border border-slate-200 rounded-2xl p-3.5 bg-white space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Quick Add Dish</h4>
                  <span className="text-[11px] font-bold text-slate-400">
                    ({availableProducts.length} dishes available)
                  </span>
                </div>
              </div>

              {/* Search & Filter Input */}
              <div className="relative">
                <Input
                  icon={Search}
                  placeholder="Filter dishes by name, code or station..."
                  value={quickAddSearch}
                  onChange={(e) => setQuickAddSearch(e.target.value)}
                />
                {quickAddSearch && (
                  <button
                    type="button"
                    onClick={() => setQuickAddSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Pills Navigation (Wrapped & Scrollable) */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs max-h-28 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory('CATEGORIES')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                    activeCategory === 'CATEGORIES' && !quickAddSearch
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Categories ({categories.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                    activeCategory === 'ALL' || (quickAddSearch && activeCategory === 'CATEGORIES')
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Dishes ({availableProducts.length})
                </button>

                {categories.map((c) => {
                  const count = availableProducts.filter((p) => p.categoryId === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveCategory(c.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                        activeCategory === c.id && !quickAddSearch
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.name} {count > 0 && <span className="opacity-70 font-semibold">({count})</span>}
                    </button>
                  );
                })}
              </div>

              {/* Quick Add Content Area */}
              <div className="border border-slate-100 rounded-xl p-2.5 bg-slate-50/40 min-h-[260px] max-h-[300px] overflow-y-auto pr-1">
                {/* View 1: Categories First Grid (when Categories tab is selected and not searching) */}
                {activeCategory === 'CATEGORIES' && !quickAddSearch ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      Select a Category to View Dishes:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {categories.map((cat) => {
                        const count = availableProducts.filter((p) => p.categoryId === cat.id).length;
                        return (
                          <div
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs cursor-pointer transition-all group flex items-center justify-between"
                          >
                            <div>
                              <h5 className="font-bold text-slate-800 group-hover:text-blue-600 text-xs sm:text-sm">
                                {cat.name}
                              </h5>
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                {count} {count === 1 ? 'dish' : 'dishes'} available
                              </p>
                            </div>
                            <span className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* View 2: Dishes List of Selected Category or Search Results */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1 py-1 text-xs border-b border-slate-200/60 mb-1">
                      <button
                        type="button"
                        onClick={() => setActiveCategory('CATEGORIES')}
                        className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Categories</span>
                      </button>
                      <span className="text-[11px] font-bold text-slate-500">
                        {quickAddSearch
                          ? `Results for "${quickAddSearch}" (${filteredQuickProducts.length})`
                          : `${categories.find((c) => c.id === activeCategory)?.name || 'All Dishes'} (${filteredQuickProducts.length})`}
                      </span>
                    </div>

                    {filteredQuickProducts.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 text-xs space-y-2">
                        <p className="font-semibold">No dishes match your filter.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickAddSearch('');
                            setActiveCategory('CATEGORIES');
                          }}
                          className="text-blue-600 font-bold hover:underline"
                        >
                          View all categories
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 text-xs">
                        {filteredQuickProducts.map((p) => {
                          const inOrder = modifiedItems.find((itm) => itm.productId === p.id);
                          return (
                            <div
                              key={p.id}
                              className="py-2 px-1.5 rounded-lg hover:bg-white flex items-center justify-between gap-2 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-slate-800 truncate text-xs">{p.name}</p>
                                  {(() => {
                                    const cat = categories.find((c) => (c.id || c._id) === (p.categoryId || p.category));
                                    const isKotReq = p.kotRequired !== undefined ? p.kotRequired : (cat?.kotRequired !== undefined ? cat.kotRequired : true);
                                    return !isKotReq ? (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                        No KOT
                                      </span>
                                    ) : null;
                                  })()}
                                  {inOrder && (
                                    <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold text-[10px] shrink-0">
                                      {inOrder.quantity} in order
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                  <span className="font-black text-slate-700">₹{p.price}</span>
                                  {p.code && <span className="font-mono text-[10px]">({p.code})</span>}
                                  {p.station && (
                                    <span className="bg-slate-100 text-slate-500 px-1 rounded text-[10px] font-medium">
                                      {p.station}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddDishToModified(p)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1 shrink-0 active:scale-95 text-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Dish Modification (Mandatory)
            </label>
            <textarea
              rows="2"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              placeholder="e.g. Guests requested additional beverages or extra portion..."
              value={modificationReason}
              onChange={(e) => setModificationReason(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-2 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {(() => {
                const changes = getModificationChanges();
                if (changes.deltaCount === 0) {
                  return <span className="text-slate-400">No dish changes made yet.</span>;
                }
                return (
                  <span className="font-medium text-blue-700">
                    Delta: {changes.added > 0 && `${changes.added} added `}
                    {changes.updated > 0 && `${changes.updated} updated `}
                    {changes.removed > 0 && `${changes.removed} removed `}
                    {!changes.requiresKot && (
                      <span className="ml-1 text-slate-500 font-normal">(No KOT ticket needed)</span>
                    )}
                  </span>
                );
              })()}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button variant="secondary" onClick={() => setModifyingOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={modLoading}>
                {(() => {
                  const changes = getModificationChanges();
                  return changes.requiresKot ? 'Dispatch Delta KOT' : 'Update Order Items';
                })()}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
