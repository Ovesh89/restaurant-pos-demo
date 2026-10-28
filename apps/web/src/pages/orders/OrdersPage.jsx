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
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowLeft,
  ArrowRight,
  XCircle,
  Check,
  Receipt,
  Play,
  PauseCircle
} from 'lucide-react';
import { orderRepository } from '../../services/repositories/orderRepository';
import { kotRepository } from '../../services/repositories/kotRepository';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { printService, formatReceiptSequence } from '../../services/printing/printService';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { ORDER_STATUS, ORDER_STATUS_CONFIG, getOrderStatusConfig } from '../../constants/orderStatus';
import { PERMISSIONS } from '../../constants/permissions';
import { useTranslation } from '../../hooks/useTranslation';

export const OrdersPage = () => {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const { t, formatNumber, formatCurrency } = useTranslation();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [orderTypeFilter, setOrderTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

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

  // Reject Order Modal
  const [rejectOrderTarget, setRejectOrderTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Status Action Modal
  const [statusActionTarget, setStatusActionTarget] = useState(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [statusActionError, setStatusActionError] = useState('');
  const [statusModalKots, setStatusModalKots] = useState([]);
  const [statusModalKotsLoading, setStatusModalKotsLoading] = useState(false);
  const [servingKotId, setServingKotId] = useState(null);

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
  const [activatingOrderId, setActivatingOrderId] = useState(null);

  const getResolvedStatus = (sf) => {
    if (sf === 'ACTIVE') {
      return [
        ORDER_STATUS.DRAFT,
        ORDER_STATUS.HOLD,
        ORDER_STATUS.SUBMITTED,
        ORDER_STATUS.WAITING_CONFIRMATION,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.KOT_SENT,
        ORDER_STATUS.PREPARING,
        ORDER_STATUS.READY,
        ORDER_STATUS.SERVED,
        ORDER_STATUS.BILLING,
        ORDER_STATUS.BILL_PENDING,
      ];
    }
    if (sf === 'HOLD') {
      return [ORDER_STATUS.HOLD, ORDER_STATUS.DRAFT];
    }
    if (sf === ORDER_STATUS.COMPLETED || sf === 'COMPLETED') {
      return ORDER_STATUS.COMPLETED;
    }
    if (sf === ORDER_STATUS.CANCELLED || sf === 'CANCELLED') {
      return ORDER_STATUS.CANCELLED;
    }
    if (sf === ORDER_STATUS.REJECTED || sf === 'REJECTED') {
      return ORDER_STATUS.REJECTED;
    }
    if (sf === 'ALL') {
      return undefined;
    }
    return sf;
  };

  const handleActivateAndSendKot = async (order) => {
    const orderTargetId = order.id || order._id || order.orderNo || order.orderNumber;
    setActivatingOrderId(orderTargetId);
    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      await orderRepository.confirmOrder(orderTargetId, actor);
      if (selectedOrder && (selectedOrder.id === orderTargetId || selectedOrder._id === orderTargetId || selectedOrder.orderNo === orderTargetId)) {
        const fresh = await orderRepository.getOrder(orderTargetId).catch(() => null);
        if (fresh) setSelectedOrder(fresh);
      }
      if (statusActionTarget && (statusActionTarget.id === orderTargetId || statusActionTarget._id === orderTargetId || statusActionTarget.orderNo === orderTargetId)) {
        setStatusActionTarget(null);
      }
      await loadOrders(page, limit);
    } catch (err) {
      alert(err.message || 'Failed to activate order and create KOT.');
    } finally {
      setActivatingOrderId(null);
    }
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

  const handleOpenReject = (order) => {
    setRejectOrderTarget(order);
    setRejectReason('');
    setRejectError('');
  };

  const handleConfirmReject = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError('Mandatory rejection reason required.');
      return;
    }

    setRejectLoading(true);
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Staff' };
      const orderTargetId = rejectOrderTarget.id || rejectOrderTarget._id || rejectOrderTarget.orderNo || rejectOrderTarget.orderNumber;
      await orderRepository.rejectOrder(orderTargetId, rejectReason.trim(), actor);
      setRejectOrderTarget(null);
      await loadOrders();
    } catch (err) {
      setRejectError(err.message || 'Failed to reject order.');
    } finally {
      setRejectLoading(false);
    }
  };

  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case ORDER_STATUS.WAITING_CONFIRMATION:
      case ORDER_STATUS.DRAFT:
      case ORDER_STATUS.HOLD:
        return ORDER_STATUS.KOT_SENT;
      case ORDER_STATUS.CONFIRMED:
      case ORDER_STATUS.KOT_SENT:
        return ORDER_STATUS.PREPARING;
      case ORDER_STATUS.PREPARING:
        return ORDER_STATUS.READY;
      case ORDER_STATUS.READY:
        return ORDER_STATUS.SERVED;
      default:
        return null;
    }
  };

  const handleOpenStatusModal = async (order) => {
    setStatusActionTarget(order);
    setStatusActionError('');
    setStatusModalKots(order.kots || []);
    setStatusModalKotsLoading(true);
    try {
      const orderTargetId = order.id || order._id || order.orderNo || order.orderNumber;
      const kots = await kotRepository.getKOTs({ orderId: orderTargetId });
      setStatusModalKots(kots || []);
    } catch (err) {
      console.error('Failed to load KOTs for status modal:', err);
    } finally {
      setStatusModalKotsLoading(false);
    }
  };

  const handleServeSingleKot = async (kot) => {
    const kotTargetId = kot.id || kot._id;
    setServingKotId(kotTargetId);
    setStatusActionError('');
    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      await kotRepository.updateKOTStatus(kotTargetId, 'SERVED', actor);

      const orderTargetId = statusActionTarget.id || statusActionTarget._id || statusActionTarget.orderNo || statusActionTarget.orderNumber;
      const freshKots = await kotRepository.getKOTs({ orderId: orderTargetId });
      setStatusModalKots(freshKots || []);

      // Check if all active KOTs are now SERVED:
      const activeKots = (freshKots || []).filter((k) => k.status !== 'CANCELLED');
      const allServed = activeKots.length > 0 && activeKots.every((k) => k.status === 'SERVED');

      if (allServed) {
        await orderRepository.updateOrderStatus(orderTargetId, ORDER_STATUS.SERVED);
        setStatusActionTarget((prev) => (prev ? { ...prev, status: ORDER_STATUS.SERVED } : null));
      }

      await loadOrders(page, limit);
    } catch (err) {
      setStatusActionError(err.message || 'Failed to mark KOT as served.');
    } finally {
      setServingKotId(null);
    }
  };

  const handleAdvanceStatus = async (order, targetStatus = null) => {
    const next = targetStatus || getNextStatus(order.status);
    if (!next) {
      if (order.status === ORDER_STATUS.SERVED) {
        navigate(`/billing?orderId=${order.id || order._id}`);
      }
      return;
    }

    setStatusActionLoading(true);
    setStatusActionError('');
    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      const orderTargetId = order.id || order._id || order.orderNo || order.orderNumber;
      if (next === ORDER_STATUS.KOT_SENT || next === ORDER_STATUS.CONFIRMED) {
        await orderRepository.confirmOrder(orderTargetId, actor);
      } else {
        await orderRepository.updateOrderStatus(orderTargetId, next);
      }

      // If advancing to SERVED, all KOTs move to SERVED
      if (next === ORDER_STATUS.SERVED) {
        setStatusModalKots((prev) =>
          prev.map((k) => (k.status !== 'CANCELLED' ? { ...k, status: 'SERVED' } : k))
        );
      } else {
        const freshKots = await kotRepository.getKOTs({ orderId: orderTargetId });
        setStatusModalKots(freshKots || []);
      }

      setStatusActionTarget((prev) => (prev ? { ...prev, status: next } : null));
      await loadOrders(page, limit);
    } catch (err) {
      setStatusActionError(err.message || 'Failed to update order status.');
    } finally {
      setStatusActionLoading(false);
    }
  };

  const handleOpenRemoveItem = (item) => {
    setItemToRemove(item);
    setRemoveItemReason('');
    setRemoveItemError('');
  };

  const handleConfirmRemoveItem = async (e) => {
    e.preventDefault();
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
    const activeItems = (order.items || []).filter((i) => (i.status || 'ACTIVE') !== 'CANCELLED');
    setModifiedItems(JSON.parse(JSON.stringify(activeItems)));
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
        return prev.map((item, index) =>
          index === idx
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
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
    if (modifiedItems.length === 0) {
      setModError('Order cannot have 0 dishes. Cancel order instead.');
      return;
    }

    setModLoading(true);
    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      const orderTargetId = modifyingOrder.id || modifyingOrder._id || modifyingOrder.orderNo || modifyingOrder.orderNumber;
      const cleanModReason = modificationReason.trim() || 'Dish modification requested by guest';
      await orderRepository.modifyOrderItems(
        orderTargetId,
        modifiedItems,
        cleanModReason,
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
      header: t('orders.orderId', null, 'Order #'),
      accessor: 'orderNo',
      className: 'w-28 font-mono font-extrabold text-blue-700',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenDetails(row)}
          className="font-mono font-extrabold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer text-left flex items-center gap-1 group"
          title="Click to view live order details"
        >
          <span>{formatReceiptSequence(row.orderNo || row.orderNumber)}</span>
          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )
    },
    {
      header: t('tables.tableNumber', null, 'Table / Source'),
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
          const typeLabel = row.orderType === 'TAKEAWAY' ? t('common.takeaway', null, 'Take Away') : row.orderType;

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
            <span className="font-extrabold text-slate-800 text-sm">
              {row.tableNo ? `${t('tables.tableNumber', null, 'Table')} ${formatNumber(row.tableNo)}` : '-'}
            </span>
            {row.customerName && (
              <p className="text-[11px] text-slate-500 font-medium">{row.customerName}</p>
            )}
          </div>
        );
      }
    },
    {
      header: t('orders.captain', null, 'Captain'),
      accessor: 'captainName',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.captainName}</span>
        </div>
      )
    },
    {
      header: t('orders.itemsCount', { count: '' }, 'Dishes'),
      accessor: 'items',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {formatNumber(row.items?.reduce((a, b) => a + b.quantity, 0))} ({formatNumber(row.items?.length)})
        </span>
      )
    },
    {
      header: t('common.subtotal', null, 'Subtotal (INR)'),
      accessor: 'subtotal',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(row.subtotal)}</span>
      )
    },
    {
      header: t('common.status', null, 'Status'),
      accessor: 'status',
      render: (row) => {
        const config = getOrderStatusConfig(row.status, t);
        const isTerminal = row.status === ORDER_STATUS.COMPLETED || row.status === ORDER_STATUS.CANCELLED || row.status === ORDER_STATUS.REJECTED;
        return (
          <button
            type="button"
            onClick={() => {
              if (!isTerminal) {
                handleOpenStatusModal(row);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${config.color} ${!isTerminal ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 hover:shadow-xs transition-all active:scale-95' : ''}`}
            title={!isTerminal ? 'Click to advance status, approve, or reject' : config.label}
          >
            <span>{config.label}</span>
            {!isTerminal && <ArrowRight className="w-3 h-3 opacity-60" />}
          </button>
        );
      }
    },
    {
      header: t('common.time', null, 'Time'),
      accessor: 'createdAt',
      className: 'text-xs text-slate-400 font-mono',
      render: (row) => new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    {
      header: t('common.actions', null, 'Actions'),
      align: 'right',
      render: (row) => {
        const isCompleted = row.status === ORDER_STATUS.COMPLETED || row.status === ORDER_STATUS.CANCELLED || row.status === ORDER_STATUS.REJECTED;
        const isReady = row.status === ORDER_STATUS.READY;
        const isHold = row.status === ORDER_STATUS.HOLD || row.status === ORDER_STATUS.DRAFT || Boolean(row.held);

        return (
          <div className="flex items-center justify-end gap-1.5">
            {(isHold || row.status === ORDER_STATUS.WAITING_CONFIRMATION) && (
              <Button
                variant="primary"
                size="sm"
                icon={Play}
                className="bg-emerald-600 hover:bg-emerald-700 font-bold shadow-2xs text-white"
                loading={activatingOrderId === (row.id || row._id || row.orderNo)}
                onClick={() => handleActivateAndSendKot(row)}
                title={row.status === ORDER_STATUS.WAITING_CONFIRMATION ? 'Approve and generate KOT for Kitchen' : 'Activate this Hold order and generate KOT for Kitchen'}
              >
                {row.status === ORDER_STATUS.WAITING_CONFIRMATION ? 'Approve & Send KOT' : 'Activate & Send KOT'}
              </Button>
            )}

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

            {!isCompleted && (
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
                onClick={() => handleOpenReject(row)}
                title="Reject Order & Release Table"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}

            {!isCompleted && (
              <button
                onClick={() => handleOpenCancel(row)}
                title="Cancel Order & Release Table"
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
        title={t('orders.title', null, 'Live Restaurant Orders')}
        subtitle={t('orders.subtitle', null, 'Manage ongoing table orders, modification deltas, kitchen state, and cancellations')}
      >
        <Button
          variant="secondary"
          icon={Clock}
          onClick={() => navigate('/orders/history')}
          className="h-11 sm:h-auto w-full sm:w-auto justify-center text-xs font-bold whitespace-nowrap"
        >
          <span className="sm:hidden">Order History</span>
          <span className="hidden sm:inline">{t('orders.historyTitle', null, 'Order History & Closed Invoices')}</span>
        </Button>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => navigate('/orders/new')}
          className="h-11 sm:h-auto w-full sm:w-auto justify-center text-xs font-bold whitespace-nowrap"
        >
          <span className="sm:hidden">Take Order</span>
          <span className="hidden sm:inline">{t('orders.newOrder', null, 'Take New Order')}</span>
        </Button>
      </PageHeader>

      {/* Filter Tabs & Quick Search */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Mobile Filter Toggle Header */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
            className="flex-1 flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">
                Filter: <span className="text-blue-700">{statusFilter === 'ALL' ? 'All History' : statusFilter}</span>
                {orderTypeFilter !== 'ALL' && ` • ${orderTypeFilter}`}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-slate-400">
              <span className="text-[11px] font-semibold">{isMobileFiltersOpen ? 'Collapse' : 'Expand'}</span>
              {isMobileFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
        </div>

        {/* Collapsible Content on Mobile (Always visible on md:flex) */}
        <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4`}>
          {/* Status Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-1.5 sm:overflow-x-auto pb-1 text-xs no-scrollbar pos-tag-grid">
            {[
              { id: 'ACTIVE', label: t('dashboard.activeOrders', null, 'Active Orders') },
              { id: 'HOLD', label: t('orders.holdOrders', null, 'Hold Orders') },
              { id: ORDER_STATUS.WAITING_CONFIRMATION, label: t('dashboard.waitingApproval', null, 'Waiting Approval') },
              { id: ORDER_STATUS.KOT_SENT, label: t('orders.kotSent', null, 'KOT Sent') },
              { id: ORDER_STATUS.PREPARING, label: t('common.preparing', null, 'In Kitchen') },
              { id: ORDER_STATUS.READY, label: t('common.ready', null, 'Ready to Serve') },
              { id: ORDER_STATUS.SERVED, label: t('common.served', null, 'Served') },
              { id: ORDER_STATUS.COMPLETED, label: t('orders.completedOrders', null, 'Completed') },
              { id: ORDER_STATUS.CANCELLED, label: t('orders.cancelledOrders', null, 'Cancelled') },
              { id: ORDER_STATUS.REJECTED, label: t('orders.rejectedOrders', null, 'Rejected Orders') },
              { id: 'ALL', label: t('common.all', null, 'All History') }
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

          {/* Order Type & Search (Visible when expanded or on desktop) */}
          <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:items-center pos-filter-grid">
            <select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
              className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              <option value="ALL">{t('common.all', null, 'All Order Types')}</option>
              <option value="DINE_IN">{t('common.dineIn', null, 'Dine In (Tables)')}</option>
              <option value="TAKEAWAY">{t('common.takeaway', null, 'Take Away')}</option>
              <option value="ZOMATO">Zomato</option>
              <option value="SWIGGY">Swiggy</option>
              <option value="ONLINE_OTHER">Online Other</option>
            </select>

            <div className="w-full sm:w-64">
              <Input
                icon={Search}
                placeholder={t('orders.searchMenu', null, 'Search order #, table, captain...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Quick Search Bar when Collapsed on Mobile */}
        {!isMobileFiltersOpen && (
          <div className="block md:hidden">
            <Input
              icon={Search}
              placeholder={t('orders.searchMenu', null, 'Search order #, table, captain...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Desktop / Tablet List/Table View */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={orders.filter((o) => {
            if (orderTypeFilter === 'ALL') return true;
            return (o.orderType || 'DINE_IN') === orderTypeFilter;
          })}
          loading={loading}
          emptyMessage={t('common.noRecords', null, 'No table orders found for this filter.')}
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
      </div>

      {/* Mobile-Only Grid/Card View (Optimized for Mobile Screens & Web-View App) */}
      <div className="block md:hidden">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
            <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading live orders...')}</p>
          </div>
        ) : orders.filter((o) => orderTypeFilter === 'ALL' || (o.orderType || 'DINE_IN') === orderTypeFilter).length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm font-medium">
            {t('common.noRecords', null, 'No table orders found for this filter.')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {orders
                .filter((o) => orderTypeFilter === 'ALL' || (o.orderType || 'DINE_IN') === orderTypeFilter)
                .map((row) => {
                  const isCompleted =
                    row.status === ORDER_STATUS.COMPLETED ||
                    row.status === ORDER_STATUS.CANCELLED ||
                    row.status === ORDER_STATUS.REJECTED;
                  const isHold = row.status === ORDER_STATUS.HOLD;
                  const isReady = row.status === ORDER_STATUS.READY;
                  const isServedOrBilling =
                    row.status === ORDER_STATUS.SERVED ||
                    row.status === ORDER_STATUS.BILLING ||
                    row.status === ORDER_STATUS.PAYMENT_PENDING;
                  const totalItemsCount = row.items?.reduce((acc, it) => acc + (it.quantity || 0), 0) || 0;
                  const dishNamesPreview = (row.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ');

                  return (
                    <div
                      key={row.id}
                      onClick={() => handleOpenDetails(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenDetails(row);
                        }
                      }}
                      title="Tap order to view full details & KOT tickets"
                      className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md cursor-pointer active:scale-[0.99] select-none"
                    >
                      <div>
                        {/* Top Bar: Order Sequence + Table / Channel Badge + Time */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 flex items-center gap-1">
                              {formatReceiptSequence(row.orderNo)}
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                            </span>
                            {row.orderType && row.orderType !== 'DINE_IN' ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                {row.orderType === 'TAKEAWAY' ? t('orders.takeaway', null, 'Take Away') : row.orderType}
                                {row.onlineOrderRef ? ` #${row.onlineOrderRef}` : ''}
                              </span>
                            ) : (
                              <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {t('orders.table', null, 'Table')} {row.tableNo}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>
                              {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Status & Subtotal Row */}
                        <div className="flex items-center justify-between my-2.5">
                          <button
                            type="button"
                            disabled={isCompleted}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStatusModal(row);
                            }}
                            title={isCompleted ? undefined : 'Tap to change order status'}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-transform active:scale-95 ${
                              row.status === ORDER_STATUS.HOLD
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : row.status === ORDER_STATUS.READY
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : row.status === ORDER_STATUS.COMPLETED
                                ? 'bg-slate-100 text-slate-700'
                                : row.status === ORDER_STATUS.CANCELLED || row.status === ORDER_STATUS.REJECTED
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                row.status === ORDER_STATUS.HOLD
                                  ? 'bg-amber-500 animate-pulse'
                                  : row.status === ORDER_STATUS.READY
                                  ? 'bg-emerald-500 animate-pulse'
                                  : row.status === ORDER_STATUS.COMPLETED
                                  ? 'bg-slate-400'
                                  : row.status === ORDER_STATUS.CANCELLED || row.status === ORDER_STATUS.REJECTED
                                  ? 'bg-rose-500'
                                  : 'bg-blue-500 animate-pulse'
                              }`}
                            />
                            <span>
                              {row.status === ORDER_STATUS.BILLING
                                ? 'In Billing'
                                : (row.status?.replace('_', ' ') || 'ACTIVE')}
                            </span>
                            {!isCompleted && <ChevronRight className="w-3 h-3 text-slate-400" />}
                          </button>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              {t('billing.subtotalAmount', null, 'Subtotal')}
                            </span>
                            <span className="text-base font-black text-slate-900">
                              {formatCurrency(row.subtotal || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Guest / Captain & Dish Breakdown Preview */}
                        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 text-xs text-slate-600 mb-3 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 truncate">
                              {row.customerName ||
                                (row.orderType !== 'DINE_IN'
                                  ? t('orders.walkinGuest', null, 'Walk-in Guest')
                                  : `Captain: ${row.captainName || 'Staff'}`)}
                            </span>
                            <span className="font-mono text-slate-500 shrink-0 font-bold">
                              {row.items?.length || 0} {t('orders.dishes', null, 'dishes')} ({totalItemsCount} {t('orders.dishes', null, 'items')})
                            </span>
                          </div>
                          {dishNamesPreview && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                              {dishNamesPreview}
                            </p>
                          )}
                          {isHold && row.notes && (
                            <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                              Hold Note: {row.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Touch-Friendly Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        {/* Priority Prominent Button */}
                        {(isHold || row.status === ORDER_STATUS.WAITING_CONFIRMATION) && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Play}
                            loading={activatingOrderId === (row.id || row._id || row.orderNo)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateAndSendKot(row);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 shadow-xs"
                          >
                            {row.status === ORDER_STATUS.WAITING_CONFIRMATION ? 'Approve & Send KOT' : t('orders.activateHoldOrder', null, 'Activate & Send KOT')}
                          </Button>
                        )}

                        {isReady && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={CheckCircle}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkServed(row);
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 shadow-xs"
                          >
                            Mark Served
                          </Button>
                        )}

                        {isServedOrBilling && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Receipt}
                            onClick={(e) => {
                              e.stopPropagation();
                              const tId = row.tableId;
                              const oId = row.id;
                              if (tId) {
                                navigate(`/billing?tableId=${tId}`);
                              } else {
                                navigate(`/billing?orderId=${oId}`);
                              }
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 shadow-xs"
                          >
                            Settle Bill
                          </Button>
                        )}

                        {/* Secondary Actions Toolbar */}
                        <div className="flex items-center justify-between gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenDetails(row)}
                            className="flex-1 text-xs justify-center"
                          >
                            {t('common.details', null, 'Details')}
                          </Button>

                          {!isCompleted && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Edit2}
                              onClick={() => handleOpenModify(row)}
                              className="flex-1 text-xs justify-center"
                            >
                              Modify
                            </Button>
                          )}

                          {!isCompleted && (
                            <button
                              onClick={() => handleOpenReject(row)}
                              title="Reject Order"
                              className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors border border-slate-200 shrink-0"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          {!isCompleted && (
                            <button
                              onClick={() => handleOpenCancel(row)}
                              title="Cancel Order"
                              className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors border border-slate-200 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Mobile Pagination */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <Pagination
                currentPage={pagination?.page || page}
                totalPages={pagination?.totalPages || 1}
                totalItems={pagination?.total || orders.filter((o) => orderTypeFilter === 'ALL' || (o.orderType || 'DINE_IN') === orderTypeFilter).length}
                pageSize={pagination?.limit || limit}
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
            </div>
          </div>
        )}
      </div>

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
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="primary" size="md">{selectedOrder.status}</Badge>
                  {(selectedOrder.status === ORDER_STATUS.HOLD || selectedOrder.status === ORDER_STATUS.DRAFT || selectedOrder.held) && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Play}
                      className="bg-emerald-600 hover:bg-emerald-700 font-bold shadow-2xs text-white"
                      loading={activatingOrderId === (selectedOrder.id || selectedOrder._id || selectedOrder.orderNo)}
                      onClick={() => handleActivateAndSendKot(selectedOrder)}
                    >
                      Activate &amp; Create KOT
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Subtotal Amount</span>
                <p className="text-xl font-black text-slate-900">₹{selectedOrder.subtotal?.toLocaleString()}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              {(() => {
                const activeDishes = (selectedOrder.items || []).filter((i) => (i.status || 'ACTIVE') !== 'CANCELLED');
                const cancelledDishes = (selectedOrder.items || []).filter((i) => (i.status || 'ACTIVE') === 'CANCELLED');
                const isSettled = selectedOrder.status === ORDER_STATUS.COMPLETED || selectedOrder.status === ORDER_STATUS.PAID;

                return (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
                          Order Dishes
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0">
                          {activeDishes.length} Active {activeDishes.length === 1 ? 'Dish' : 'Dishes'}
                        </span>
                      </div>
                      {!isSettled && (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Remove dish recalculates total &amp; pending bill
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      {activeDishes.map((item, idx) => (
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
                      ))}
                    </div>

                    {cancelledDishes.length > 0 && (
                      <div className="mt-3 pt-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Cancelled / Removed Dishes
                          </h5>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                            {cancelledDishes.length}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs bg-slate-50/50">
                          {cancelledDishes.map((item, idx) => (
                            <div key={item.lineId || item.productId || idx} className="p-2.5 flex items-center justify-between text-slate-400">
                              <div className="flex-1">
                                <span className="line-through font-medium">{item.name}</span>
                                <span className="text-[10px] ml-2">({item.quantity}x @ ₹{item.unitPrice})</span>
                              </div>
                              <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-200">
                                CANCELLED
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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
                  {orderKOTs.map((kot) => {
                    const isKotCancelled = kot.status === 'CANCELLED' || kot.type === 'CANCELLATION';
                    return (
                      <div
                        key={kot.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          isKotCancelled
                            ? 'border-rose-200 bg-rose-50/30'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-black font-mono ${isKotCancelled ? 'text-rose-700' : 'text-blue-700'}`}>
                              {kot.kotNo}
                            </span>
                            <span className="font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                              {kot.type} Rev #{kot.revision}
                            </span>
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                isKotCancelled
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'text-slate-600'
                              }`}
                            >
                              [{kot.status}]
                            </span>
                          </div>
                          <p className="text-slate-500 mt-1">
                            {kot.items.map((i) => {
                              const isItemCancelled = isKotCancelled || i.status === 'CANCELLED' || i.cancelled;
                              return (
                                <span key={i.productId || i.name} className={`mr-2 ${isItemCancelled ? 'line-through text-slate-400' : ''}`}>
                                  {i.quantity}x {i.name || i.productName}
                                  {isItemCancelled && ' [Cancelled]'}
                                </span>
                              );
                            })}
                          </p>
                        </div>

                        <button
                          onClick={() => printService.printKOT(kot, selectedOrder, { tableNo: selectedOrder.tableNo })}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 bg-white p-2 rounded-lg border border-slate-200 shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100 pos-modal-actions">
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
              <Button variant="secondary" className="w-full sm:w-auto sm:ml-auto" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
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
              Reason for Removal (Optional)
            </label>
            <textarea
              rows="3"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
              placeholder="e.g. Guest changed mind, dish out of stock, incorrect dish added..."
              value={removeItemReason}
              onChange={(e) => setRemoveItemReason(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
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

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setCancelOrderTarget(null)}>
              Abort
            </Button>
            <Button type="submit" variant="danger" className="w-full sm:w-auto" loading={cancelLoading}>
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
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 whitespace-nowrap">Order Dishes</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200 whitespace-nowrap">
                    {modifiedItems.length} {modifiedItems.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>
                <span className="text-xs font-extrabold text-blue-700 whitespace-nowrap">
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
                  onClear={() => setQuickAddSearch('')}
                />
              </div>

              {/* Category Pills Navigation (Wrapped & Scrollable) */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs max-h-36 sm:max-h-40 overflow-y-auto pr-1">
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
              Reason for Dish Modification (Optional)
            </label>
            <textarea
              rows="2"
              className="block w-full rounded-lg border border-slate-300 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              placeholder="e.g. Guests requested additional beverages or extra portion..."
              value={modificationReason}
              onChange={(e) => setModificationReason(e.target.value)}
            ></textarea>
          </div>

          <div className="text-xs text-slate-500 pt-1 pb-0.5">
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

          <div className="flex flex-col-reverse sm:flex-row justify-end items-center gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
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
        </form>
      </Modal>

      {/* Reject Order Modal */}
      <Modal
        isOpen={Boolean(rejectOrderTarget)}
        onClose={() => setRejectOrderTarget(null)}
        title={t('reception.rejectOrder', null, 'Reject Order & Release Table')}
        subtitle={`${t('orders.orderId', null, 'Order')} #${rejectOrderTarget?.orderNo || rejectOrderTarget?.orderNumber} • ${rejectOrderTarget?.tableNo ? `Table ${rejectOrderTarget.tableNo}` : 'Take Away'}`}
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
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
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Guest cancelled before kitchen preparation, duplicate entry, etc."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            Rejecting this order will immediately cancel linked KOTs and release Table {rejectOrderTarget?.tableNo || ''} to Available.
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setRejectOrderTarget(null)}>
              {t('common.cancel', null, 'Cancel')}
            </Button>
            <Button type="submit" variant="danger" className="w-full sm:w-auto" loading={rejectLoading}>
              {t('reception.rejectOrder', null, 'Confirm Rejection')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Status Action & Progression Modal */}
      <Modal
        isOpen={Boolean(statusActionTarget)}
        onClose={() => setStatusActionTarget(null)}
        title={`Order Status: ${formatReceiptSequence(statusActionTarget?.orderNo || statusActionTarget?.orderNumber)}`}
        subtitle={`${statusActionTarget?.tableNo ? `Table ${statusActionTarget.tableNo}` : statusActionTarget?.orderType} • Current: ${getOrderStatusConfig(statusActionTarget?.status, t).label}`}
      >
        {statusActionTarget && (
          <div className="space-y-4">
            {statusActionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                {statusActionError}
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold uppercase">Current Status</span>
                {(() => {
                  const cfg = getOrderStatusConfig(statusActionTarget.status, t);
                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>

              {/* Next status progression button */}
              {(statusActionTarget.status === ORDER_STATUS.HOLD || statusActionTarget.status === ORDER_STATUS.DRAFT || statusActionTarget.held) ? (
                <div className="pt-2 border-t border-slate-200">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-3 flex items-start gap-2.5">
                    <PauseCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">Order is currently on Hold</p>
                      <p className="text-[11px] text-amber-700">Activate this order to immediately create the KOT and send it to the kitchen queue.</p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    className="w-full font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    loading={statusActionLoading || activatingOrderId === (statusActionTarget.id || statusActionTarget._id || statusActionTarget.orderNo)}
                    onClick={() => handleActivateAndSendKot(statusActionTarget)}
                  >
                    <Play className="w-4 h-4" />
                    <span>Activate &amp; Create KOT</span>
                  </Button>
                </div>
              ) : getNextStatus(statusActionTarget.status) && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Quick advance to next stage:</p>
                  <Button
                    variant="primary"
                    className="w-full font-bold flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
                    loading={statusActionLoading}
                    onClick={() => handleAdvanceStatus(statusActionTarget)}
                  >
                    <span>Advance to {getOrderStatusConfig(getNextStatus(statusActionTarget.status), t).label}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {[ORDER_STATUS.SERVED, ORDER_STATUS.BILLING, ORDER_STATUS.PAYMENT_PENDING].includes(statusActionTarget.status) && (
                <div className="pt-2 border-t border-slate-200">
                  <Button
                    variant="success"
                    className="w-full font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    onClick={() => navigate(`/billing?orderId=${statusActionTarget.id || statusActionTarget._id}`)}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Proceed to Billing & Settle Invoice</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Linked KOTs with Individual Serve Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kitchen Order Tickets ({statusModalKots.filter((k) => k.status !== 'CANCELLED').length})
                </span>
                {statusModalKots.some((k) => k.status === 'READY') && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                    Food Ready to Serve
                  </span>
                )}
              </div>

              {statusModalKotsLoading ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  Loading KOT tickets...
                </div>
              ) : statusModalKots.filter((k) => k.status !== 'CANCELLED').length === 0 ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  No active KOT tickets for this order.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {statusModalKots
                    .filter((k) => k.status !== 'CANCELLED')
                    .map((kot) => {
                      const isReady = kot.status === 'READY';
                      const isServed = kot.status === 'SERVED';
                      const isServing = servingKotId === (kot.id || kot._id);

                      return (
                        <div
                          key={kot.id || kot._id}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isReady
                              ? 'bg-purple-50/50 border-purple-200 shadow-2xs'
                              : isServed
                              ? 'bg-slate-50/80 border-slate-200 opacity-80'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-xs text-blue-700">
                                {kot.kotNo || kot.kotNumber}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {kot.type || 'NEW'} #{kot.revision || 1}
                              </span>
                              {kot.kitchenStation && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  • {kot.kitchenStation}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                  isServed
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : isReady
                                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                                    : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                              >
                                {kot.status}
                              </span>
                            </div>

                            {/* Dishes summary */}
                            <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                              {(kot.items || [])
                                .map((it) => `${it.productName || it.name} (${it.quantity}x)`)
                                .join(', ')}
                            </p>
                          </div>

                          {/* Serve Action Button */}
                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                            {isServed ? (
                              <span className="w-full sm:w-auto inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                                <Check className="w-3.5 h-3.5" />
                                <span>Served</span>
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant={isReady ? 'success' : 'secondary'}
                                loading={isServing}
                                disabled={statusActionLoading || isServing}
                                onClick={() => handleServeSingleKot(kot)}
                                className={`w-full sm:w-auto font-bold text-xs flex items-center justify-center gap-1.5 ${
                                  isReady
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                    : 'text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                <UtensilsCrossed className="w-3.5 h-3.5" />
                                <span>{isReady ? 'Serve KOT' : 'Mark Served'}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Quick status jumps */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Set Exact Status</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { status: ORDER_STATUS.KOT_SENT, label: 'KOT Sent / Approved' },
                  { status: ORDER_STATUS.PREPARING, label: 'Preparing' },
                  { status: ORDER_STATUS.READY, label: 'Ready' },
                  { status: ORDER_STATUS.SERVED, label: 'Served' },
                ].map((s) => (
                  <button
                    key={s.status}
                    type="button"
                    disabled={statusActionTarget.status === s.status || statusActionLoading}
                    onClick={() => handleAdvanceStatus(statusActionTarget, s.status)}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                      statusActionTarget.status === s.status
                        ? 'bg-blue-50 border-blue-300 text-blue-800 opacity-60 cursor-default'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Critical actions: Approve, Reject, Cancel */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pos-modal-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const tgt = statusActionTarget;
                  setStatusActionTarget(null);
                  handleOpenReject(tgt);
                }}
                className="flex-1 sm:flex-none text-rose-700 border-rose-200 hover:bg-rose-50 font-bold"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Reject Order
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const tgt = statusActionTarget;
                  setStatusActionTarget(null);
                  handleOpenCancel(tgt);
                }}
                className="flex-1 sm:flex-none text-red-700 border-red-200 hover:bg-red-50 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Cancel Order
              </Button>

              <Button variant="ghost" size="sm" className="w-full sm:w-auto sm:ml-auto" onClick={() => setStatusActionTarget(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
