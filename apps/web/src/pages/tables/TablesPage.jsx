import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Coffee,
  Edit2,
  Users,
  Layers,
  AlertCircle,
  Receipt,
  ArrowRightLeft,
  ArrowLeft,
  Eye,
  Trash2,
  Printer,
  Search,
  CheckCircle,
  Clock,
  UtensilsCrossed,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  X
} from 'lucide-react';
import { tableRepository } from '../../services/repositories/tableRepository';
import { branchRepository } from '../../services/repositories/branchRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { kotRepository } from '../../services/repositories/kotRepository';
import { printService, formatReceiptSequence } from '../../services/printing/printService';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { TABLE_STATUS_CONFIG, TABLE_STATUS, getTableStatusConfig } from '../../constants/tableStatus';
import { ORDER_STATUS } from '../../constants/orderStatus';
import { PERMISSIONS } from '../../constants/permissions';
import { DiningAreaManager } from '../../components/restaurant/DiningAreaManager.jsx';
import { useTranslation } from '../../hooks/useTranslation';

export const TablesPage = () => {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const { t, formatNumber } = useTranslation();
  const navigate = useNavigate();
  const canManage = hasPermission(PERMISSIONS.TABLE_MANAGE);

  const isCaptain = user?.role === 'captain' || hasPermission('role.captain');
  const [tables, setTables] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState(() => {
    if (user?.role === 'captain') {
      return sessionStorage.getItem('pos_captain_selected_area') || null;
    }
    return 'ALL';
  });
  const [loading, setLoading] = useState(true);

  // Dining Areas Modal State
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);

  // Success Notice State
  const [successMsg, setSuccessMsg] = useState('');

  // Order Details Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [orderKOTs, setOrderKOTs] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Modify Order Modal State
  const [modifyingOrder, setModifyingOrder] = useState(null);
  const [modifiedItems, setModifiedItems] = useState([]);
  const [modificationReason, setModificationReason] = useState('');
  const [availableProducts, setAvailableProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [modError, setModError] = useState('');
  const [modLoading, setModLoading] = useState(false);

  // Add / Edit Table Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [formData, setFormData] = useState({ tableNo: '', areaId: '', capacity: 4 });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Transfer Table State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceTable, setTransferSourceTable] = useState(null);
  const [transferTargetTableId, setTransferTargetTableId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const loadFloor = async () => {
    try {
      setLoading(true);
      const [tList, aList, oList] = await Promise.all([
        tableRepository.getTables(),
        branchRepository.getAreas(),
        orderRepository.getOrders({ limit: 200 }).catch(() => [])
      ]);

      const activeOrdersList = Array.isArray(oList?.items)
        ? oList.items
        : Array.isArray(oList)
        ? oList
        : [];

      const activeOrderByTable = new Map();
      activeOrdersList.forEach((ord) => {
        const isTerminal =
          ord.status === 'COMPLETED' ||
          ord.status === 'CANCELLED' ||
          ord.status === 'REJECTED';
        if (!isTerminal) {
          if (ord.tableId) activeOrderByTable.set(String(ord.tableId), ord);
          if (ord.tableNo) {
            activeOrderByTable.set(String(ord.tableNo), ord);
            const cleanNo = String(ord.tableNo).replace(/^T-?/i, '');
            activeOrderByTable.set(cleanNo, ord);
            activeOrderByTable.set(`T-${cleanNo}`, ord);
          }
        }
      });

      const mergedTables = (tList || []).map((tbl) => {
        const cleanNo = String(tbl.tableNo || '').replace(/^T-?/i, '');
        const activeOrder =
          activeOrderByTable.get(String(tbl.id)) ||
          activeOrderByTable.get(String(tbl.tableNo)) ||
          activeOrderByTable.get(cleanNo) ||
          activeOrderByTable.get(`T-${cleanNo}`);

        let effectiveStatus = tbl.status;
        const activeOrderId = tbl.activeOrderId || activeOrder?.id || null;

        if (activeOrder) {
          switch (activeOrder.status) {
            case 'WAITING_CONFIRMATION':
            case 'DRAFT':
            case 'HOLD':
              effectiveStatus = TABLE_STATUS.ORDER_IN_PROGRESS;
              break;
            case 'CONFIRMED':
            case 'KOT_SENT':
              effectiveStatus = TABLE_STATUS.KOT_SENT;
              break;
            case 'PREPARING':
              effectiveStatus = TABLE_STATUS.PREPARING;
              break;
            case 'READY':
              effectiveStatus = TABLE_STATUS.READY;
              break;
            case 'SERVED':
              effectiveStatus = TABLE_STATUS.SERVED;
              break;
            case 'BILLING':
            case 'BILL_PENDING':
            case 'PAYMENT_PENDING':
              effectiveStatus = TABLE_STATUS.BILL_PENDING;
              break;
            default:
              effectiveStatus = TABLE_STATUS.OCCUPIED;
              break;
          }
        } else if (!tbl.activeOrderId) {
          effectiveStatus = TABLE_STATUS.AVAILABLE;
        }

        return {
          ...tbl,
          status: effectiveStatus,
          activeOrderId,
          activeOrder: activeOrder || null,
        };
      });

      setTables(mergedTables);
      setAreas(aList || []);
      if (aList && aList.length > 0 && selectedAreaId === 'ALL') {
        // default can be ALL or first area
      }
    } catch (err) {
      console.error('Failed to load table floor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloor();
  }, []);

  const handleOpenAdd = () => {
    setEditingTable(null);
    setFormData({
      tableNo: '',
      areaId: selectedAreaId !== 'ALL' ? selectedAreaId : (areas[0]?.id || 'area-indoor'),
      capacity: 4
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tbl, e) => {
    e.stopPropagation();
    setEditingTable(tbl);
    setFormData({
      tableNo: tbl.tableNo,
      areaId: tbl.areaId,
      capacity: tbl.capacity
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      if (editingTable) {
        await tableRepository.updateTable(editingTable.id, formData, actor);
      } else {
        await tableRepository.createTable(formData, actor);
      }
      setIsModalOpen(false);
      await loadFloor();
    } catch (err) {
      setFormError(err.message || 'Error saving table.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (tbl, e) => {
    e.stopPropagation();
    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      await tableRepository.toggleTableActive(tbl.id, actor);
      await loadFloor();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenTransfer = (tbl, e) => {
    e.stopPropagation();
    setTransferSourceTable(tbl);
    const availableTables = tables.filter((t) => t.status === TABLE_STATUS.AVAILABLE && t.isActive && t.id !== tbl.id);
    setTransferTargetTableId(availableTables[0]?.id || '');
    setTransferReason('');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = async (e) => {
    e.preventDefault();
    if (!transferTargetTableId) {
      setTransferError('Please select a destination table.');
      return;
    }

    setTransferError('');
    setTransferLoading(true);

    try {
      const actor = { id: user?.id || 'staff', name: user?.name || 'Staff' };
      await tableRepository.transferTable({
        fromTableId: transferSourceTable.id,
        toTableId: transferTargetTableId,
        reason: transferReason,
        actor
      });
      setIsTransferModalOpen(false);
      await loadFloor();
    } catch (err) {
      setTransferError(err.message || 'Transfer failed.');
    } finally {
      setTransferLoading(false);
    }
  };

  // Open Order Details for Occupied Table
  const handleOpenOrderDetails = async (tbl) => {
    setSelectedTable(tbl);
    let order = tbl.activeOrder;
    const orderTargetId = tbl.activeOrderId || order?.id || order?._id;

    if (!order && !orderTargetId) {
      alert(t('tables.noActiveOrder', 'No active order recorded for this table.'));
      return;
    }

    setSelectedOrder(order || { id: orderTargetId, tableNo: tbl.tableNo });
    setIsOrderDetailsOpen(true);
    setDetailsLoading(true);

    try {
      if (orderTargetId) {
        const [freshOrder, kots] = await Promise.all([
          orderRepository.getOrderById(orderTargetId).catch(() => order),
          kotRepository.getKOTs({ orderId: orderTargetId }).catch(() => [])
        ]);
        if (freshOrder) setSelectedOrder(freshOrder);
        setOrderKOTs(kots || []);
      }
    } catch (err) {
      console.error('Failed to load table order details or KOTs:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Modify Dishes Modal for Table
  const handleOpenModify = async (tblOrOrder) => {
    let order = tblOrOrder;
    if (tblOrOrder.activeOrder || tblOrOrder.activeOrderId) {
      order = tblOrOrder.activeOrder || { id: tblOrOrder.activeOrderId, tableNo: tblOrOrder.tableNo };
      const orderTargetId = tblOrOrder.activeOrderId || order?.id || order?._id;
      if (orderTargetId) {
        try {
          const freshOrder = await orderRepository.getOrderById(orderTargetId);
          if (freshOrder) order = freshOrder;
        } catch (err) {
          console.warn('Could not fetch latest order before modify:', err);
        }
      }
    }

    if (!order) {
      alert('No active order to modify.');
      return;
    }

    setIsOrderDetailsOpen(false);
    setModifyingOrder(order);
    const activeItems = (order.items || []).filter((i) => (i.status || 'ACTIVE') !== 'CANCELLED');
    setModifiedItems(JSON.parse(JSON.stringify(activeItems)));
    setModificationReason('');
    setModError('');
    setQuickAddSearch('');
    setActiveCategory('ALL');

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
      const cleanModReason = modificationReason.trim() || 'Dish modification from table floor';

      await orderRepository.modifyOrderItems(
        orderTargetId,
        modifiedItems,
        cleanModReason,
        actor
      );

      const modifiedTableNo = modifyingOrder.tableNo;
      setModifyingOrder(null);
      setSuccessMsg(`Order for Table ${modifiedTableNo || ''} modified successfully! New dishes dispatched to kitchen KOT.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadFloor();
    } catch (err) {
      setModError(err.message || 'Error modifying order items.');
    } finally {
      setModLoading(false);
    }
  };

  // Filter tables by active tab
  const displayedTables = selectedAreaId === 'ALL'
    ? tables
    : tables.filter((t) => t.areaId === selectedAreaId);

  const getAreaName = (areaId) => {
    const area = areas.find((a) => a.id === areaId);
    return area ? area.name : 'General Area';
  };

  return (
    <div className="space-y-6">
      {/* If Captain hasn't chosen an area yet, show the Area Selection Flow */}
      {isCaptain && (!selectedAreaId || selectedAreaId === 'ALL') ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-md">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-200 block">Captain Station</span>
            <h2 className="text-xl sm:text-2xl font-black mt-0.5">Select Your Working Area</h2>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-xl">
              Choose the dining area you are managing today. You will only see and take orders for tables in your selected area.
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
              {t('common.loading', 'Loading dining areas...')}
            </div>
          ) : areas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
              No dining areas found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {areas.map((a) => {
                const aTables = tables.filter((t) => t.areaId === a.id && t.isActive);
                const availableCount = aTables.filter((t) => t.status === TABLE_STATUS.AVAILABLE).length;
                const occupiedCount = aTables.filter((t) => t.status !== TABLE_STATUS.AVAILABLE).length;

                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setSelectedAreaId(a.id);
                      sessionStorage.setItem('pos_captain_selected_area', a.id);
                    }}
                    className="bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:shadow-lg p-5 cursor-pointer transition-all active:scale-[0.99] flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Coffee className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {formatNumber(aTables.length)} {t('tables.title', 'Tables')}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                        {a.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {a.description || 'Assigned dining floor section'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          {formatNumber(availableCount)} Available
                        </span>
                        {occupiedCount > 0 && (
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                            {formatNumber(occupiedCount)} Active
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold text-blue-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Select →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Top Header / Captain Area Header */}
          {isCaptain ? (
            <div className="bg-white rounded-2xl border border-blue-200 bg-blue-50/30 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowLeft}
                  onClick={() => {
                    setSelectedAreaId(null);
                    sessionStorage.removeItem('pos_captain_selected_area');
                  }}
                  className="font-bold text-xs"
                >
                  Change Area
                </Button>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Working in Area</span>
                  <h3 className="text-base sm:text-lg font-black text-slate-800">
                    {getAreaName(selectedAreaId)}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-xl">
                  {formatNumber(displayedTables.filter(t => t.status === TABLE_STATUS.AVAILABLE && t.isActive).length)} Available
                </span>
                <span className="text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded-xl">
                  {formatNumber(displayedTables.filter(t => t.status !== TABLE_STATUS.AVAILABLE && t.isActive).length)} Active
                </span>
              </div>
            </div>
          ) : (
            <PageHeader
              title={t('tables.title', 'Restaurant Table Floor')}
              subtitle={t('tables.subtitle', 'Floor layout visualizer, dining sections, table seating capacity, and status overview')}
            >
              {canManage && (
                <>
                  <Button
                    variant="secondary"
                    icon={Layers}
                    onClick={() => setIsAreaModalOpen(true)}
                    className="h-11 sm:h-auto w-full justify-center text-xs font-bold"
                  >
                    {t('tables.manageAreas', 'Manage Areas')}
                  </Button>
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={handleOpenAdd}
                    className="h-11 sm:h-auto w-full justify-center text-xs font-bold"
                  >
                    {t('tables.addTable', 'Add Table')}
                  </Button>
                </>
              )}
            </PageHeader>
          )}

          {/* Success Notification Alert */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2 shadow-xs">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* Area Selector Tabs & Status Legend (For non-captain users) */}
          {!isCaptain && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 pb-3 sm:pb-4">
              <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-1.5 sm:overflow-x-auto pb-1 no-scrollbar pos-tag-grid">
                <button
                  onClick={() => setSelectedAreaId('ALL')}
                  className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedAreaId === 'ALL'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {t('common.all', 'All Areas')} ({formatNumber(tables.length)})
                </button>
                {areas.map((a) => {
                  const count = tables.filter((t) => t.areaId === a.id).length;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAreaId(a.id)}
                      className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        selectedAreaId === a.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      {a.name} ({formatNumber(count)})
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="hidden md:flex md:items-center md:gap-3 text-[10px] sm:text-[11px] font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>{t('common.available', 'Available')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>{t('common.occupied', 'Occupied')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>{t('orders.kotSent', 'KOT Sent')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span>{t('common.preparing', 'Preparing')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                  <span>{t('common.ready', 'Ready')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                  <span>{t('common.served', 'Served')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span>{t('common.billed', 'Bill Pending')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tables Grid */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
              {t('common.loading', 'Loading restaurant table floor...')}
            </div>
          ) : displayedTables.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
              {t('tables.noTables', 'No dining tables configured in this area.')}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {displayedTables.map((tbl) => {
                const statusConfig = getTableStatusConfig(tbl.status, t) || getTableStatusConfig(TABLE_STATUS.AVAILABLE, t);
                const isBillPending = tbl.status === TABLE_STATUS.BILL_PENDING || tbl.status === 'BILLING' || tbl.status === 'PAYMENT_PENDING';
                const cleanTableNo = String(tbl.tableNo || '').trim().replace(/^T-?/i, '');

                // Common for all: Clicking table redirects directly to add/update order page
                const handleCardClick = () => {
                  if (!tbl.isActive) return;
                  navigate(`/orders/new?tableId=${tbl.id}&from=tables`);
                };

                return (
                  <div
                    key={tbl.id}
                    onClick={handleCardClick}
                    className={`relative rounded-2xl border bg-white p-3.5 sm:p-5 shadow-xs transition-all flex flex-col justify-between min-h-[160px] sm:h-44 cursor-pointer ${
                      !tbl.isActive
                        ? 'opacity-50 border-dashed border-slate-300 cursor-not-allowed'
                        : 'hover:shadow-md hover:border-blue-500 hover:scale-[1.01]'
                    }`}
                  >
                    {/* Top Info */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {getAreaName(tbl.areaId)}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mt-0.5">
                          T-{cleanTableNo}
                        </h3>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusConfig.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Capacity & Attributes */}
                    <div className="my-1.5 sm:my-2">
                      <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-600 font-semibold">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{t('tables.seats', { count: tbl.capacity }, `${formatNumber(tbl.capacity)} Pax`)}</span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-xs">
                      {tbl.status === TABLE_STATUS.AVAILABLE ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/orders/new?tableId=${tbl.id}&from=tables`);
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200"
                        >
                          + {t('orders.newOrder', 'Take Order')}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/orders/new?tableId=${tbl.id}&from=tables`);
                            }}
                            className="text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 flex items-center gap-1"
                            title="Add dishes or modify order"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>{t('orders.modifyOrder', 'Order / Modify')}</span>
                          </button>

                          {!isCaptain && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOrderDetails(tbl);
                              }}
                              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1"
                              title="Inspect order details"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>
                          )}

                          {!isCaptain && isBillPending && hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/billing?tableId=${tbl.id}`);
                              }}
                              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-300 flex items-center gap-1"
                              title="Proceed to billing & payment desk"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>{t('billing.recordPayment', 'Bill')}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {tbl.status !== TABLE_STATUS.AVAILABLE && (
                        <button
                          onClick={(e) => handleOpenTransfer(tbl, e)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                          title="Transfer Table Order to Another Table"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canManage && (
                        <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleOpenEdit(tbl, e)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                        title="Edit Table Capacity & Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleToggleActive(tbl, e)}
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 px-1 py-0.5 rounded hover:bg-slate-100"
                      >
                        {tbl.isActive ? t('common.deactivate', 'Deact.') : t('common.activate', 'Act.')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Add / Edit Table Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTable ? `${t('tables.editTable', 'Edit Table')} ${editingTable.tableNo}` : t('tables.addTable', 'Add Dining Table')}
        subtitle={t('tables.subtitle', 'Configure table identification and seating pax')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('tables.tableNumber', 'Table Number')}
              placeholder="e.g. 05, 21, VIP-1"
              value={formData.tableNo}
              onChange={(e) => setFormData({ ...formData, tableNo: e.target.value })}
              required
            />

            <Input
              label={t('tables.capacity', 'Seating Capacity (Pax)')}
              type="number"
              min="1"
              max="30"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              required
            />
          </div>

          <Select
            label={t('tables.area', 'Assigned Dining Area')}
            value={formData.areaId}
            onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
            options={areas.map((a) => ({ value: a.id, label: a.name }))}
            required
          />

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" className="w-full sm:w-auto" loading={formLoading}>
              {editingTable ? t('common.save', 'Save Table') : t('common.create', 'Create Table')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Table Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title={`${t('tables.transferTable', 'Transfer Table')} T-${String(transferSourceTable?.tableNo || '').trim().replace(/^(T-?)+/i, '')}`}
        subtitle={t('tables.transferSubtitle', 'Relocate ongoing active order and kitchen tickets to another available table')}
      >
        <form onSubmit={handleConfirmTransfer} className="space-y-4">
          {transferError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {transferError}
            </div>
          )}

          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-xs text-blue-900">
            <p className="font-bold">Active Table: T-{String(transferSourceTable?.tableNo || '').trim().replace(/^(T-?)+/i, '')}</p>
            <p className="mt-0.5">
              The ongoing order, canonical dishes, and kitchen tickets will seamlessly transfer to the chosen table. Table T-{String(transferSourceTable?.tableNo || '').trim().replace(/^(T-?)+/i, '')} will be released back to AVAILABLE.
            </p>
          </div>

          <Select
            label={t('tables.destTable', 'Destination Available Table')}
            value={transferTargetTableId}
            onChange={(e) => setTransferTargetTableId(e.target.value)}
            options={tables
              .filter((t) => t.status === TABLE_STATUS.AVAILABLE && t.isActive && t.id !== transferSourceTable?.id)
              .map((t) => ({
                value: t.id,
                label: `Table ${t.tableNo} (${t.capacity} Pax - ${getAreaName(t.areaId)})`
              }))}
            required
          />

          <Input
            label={t('tables.transferReason', 'Reason for Transfer')}
            placeholder="e.g. Guest requested window booth / AC section"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
          />

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setIsTransferModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="primary" icon={ArrowRightLeft} className="w-full sm:w-auto" loading={transferLoading}>
              {t('tables.confirmTransfer', 'Confirm Transfer')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Dining Area Manager Modal */}
      <Modal
        isOpen={isAreaModalOpen}
        onClose={() => {
          setIsAreaModalOpen(false);
          loadFloor();
        }}
        title={t('tables.manageAreas', 'Manage Assigned Dining Areas')}
        subtitle="Add, edit, toggle active status, and remove restaurant floor sections"
        maxWidth="max-w-4xl"
      >
        <DiningAreaManager onAreasChanged={loadFloor} />
      </Modal>

      {/* View Table Order Details & KOT Tickets Modal */}
      <Modal
        isOpen={isOrderDetailsOpen && !!selectedOrder}
        onClose={() => {
          setIsOrderDetailsOpen(false);
          setSelectedOrder(null);
        }}
        title={`${t('orders.title', 'Order Details')}: ${formatReceiptSequence(selectedOrder?.orderNo || selectedOrder?.orderNumber || '')}`}
        subtitle={`${t('orders.table', 'Table')} ${selectedTable?.tableNo || selectedOrder?.tableNo} • ${t('orders.captain', 'Captain')}: ${selectedOrder?.captainName || 'Staff'}`}
        maxWidth="max-w-3xl"
      >
        {selectedOrder && (
          <div className="space-y-5">
            {/* Header Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Status</span>
                <span className="font-black text-slate-800">{selectedOrder.status}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Order Time</span>
                <span className="font-mono text-slate-700">
                  {selectedOrder.createdAt
                    ? new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Customer</span>
                <span className="font-bold text-slate-800 truncate block">
                  {selectedOrder.customerName || selectedOrder.customer?.name || t('orders.walkinGuest', 'Walk-in Guest')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Order Subtotal</span>
                <span className="font-black text-emerald-600 text-sm">
                  ₹{formatNumber(selectedOrder.subtotal || 0)}
                </span>
              </div>
            </div>

            {/* Current Dishes List */}
            <div>
              {(() => {
                const activeDishes = (selectedOrder.items || []).filter((i) => (i.status || 'ACTIVE') !== 'CANCELLED');
                const cancelledDishes = (selectedOrder.items || []).filter((i) => (i.status || 'ACTIVE') === 'CANCELLED');

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Current Order Items
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {activeDishes.length} Active
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Edit2}
                        onClick={() => handleOpenModify(selectedOrder)}
                        className="text-xs text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
                      >
                        Modify / Add Dishes
                      </Button>
                    </div>

                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                      {activeDishes.map((item, idx) => (
                        <div key={item.lineId || item.productId || idx} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{item.name || item.productName}</span>
                              <span className="font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                x{item.quantity}
                              </span>
                            </div>
                            {item.notes && <p className="text-[11px] text-blue-600 italic mt-0.5">* {item.notes}</p>}
                          </div>
                          <span className="font-extrabold text-slate-900">
                            ₹{(item.quantity || 1) * (item.unitPrice || 0)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {cancelledDishes.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Cancelled / Removed Dishes
                          </h5>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            {cancelledDishes.length}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 border border-rose-200 rounded-xl overflow-hidden text-xs bg-rose-50/20">
                          {cancelledDishes.map((item, idx) => (
                            <div key={item.lineId || item.productId || idx} className="p-2.5 flex items-center justify-between text-slate-400">
                              <div className="flex-1">
                                <span className="line-through font-medium text-slate-500">{item.name || item.productName}</span>
                                <span className="text-[10px] ml-2 text-slate-400">({item.quantity}x @ ₹{item.unitPrice || 0})</span>
                                {item.cancellationReason && (
                                  <p className="text-[10px] text-rose-600 italic mt-0.5">Reason: {item.cancellationReason}</p>
                                )}
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

            {/* Operational KOT Tickets */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Operational KOT Tickets ({orderKOTs.length})
              </h4>
              {detailsLoading ? (
                <p className="text-xs text-slate-400">Loading KOT tickets...</p>
              ) : orderKOTs.length === 0 ? (
                <p className="text-xs text-slate-400">No KOT tickets issued yet.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {orderKOTs.map((kot) => {
                    const isKotCancelled = kot.status === 'CANCELLED' || kot.type === 'CANCELLATION';
                    return (
                      <div
                        key={kot.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
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
                          type="button"
                          onClick={() => printService.printKOT(kot, selectedOrder, { tableNo: selectedOrder.tableNo || selectedTable?.tableNo })}
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

            {/* Modal Footer Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100 pos-modal-actions">
              <Button
                variant="primary"
                icon={Edit2}
                onClick={() => handleOpenModify(selectedOrder)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold sm:mr-auto"
              >
                Modify Order &amp; Add Dishes
              </Button>

              {hasAnyPermission([PERMISSIONS.BILLING_GENERATE, PERMISSIONS.PAYMENT_COLLECT]) && (
                <Button
                  variant="secondary"
                  icon={Receipt}
                  onClick={() => {
                    const tId = selectedTable?.id || selectedOrder.tableId;
                    setIsOrderDetailsOpen(false);
                    if (tId) {
                      navigate(`/billing?tableId=${tId}`);
                    } else {
                      navigate(`/billing?orderId=${selectedOrder.id}`);
                    }
                  }}
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold"
                >
                  Proceed to Billing
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={() => {
                  setIsOrderDetailsOpen(false);
                  setSelectedOrder(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modify Order Items Modal (Generates Delta KOT) */}
      <Modal
        isOpen={!!modifyingOrder}
        onClose={() => setModifyingOrder(null)}
        title={`Modify Order Dishes: ${modifyingOrder?.orderNo || `Table ${modifyingOrder?.tableNo}`}`}
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
            {/* Left Column: Current Items in Order */}
            <div className="lg:col-span-5 border border-slate-200 rounded-2xl p-3.5 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 whitespace-nowrap">Order Dishes</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200 whitespace-nowrap">
                    {modifiedItems.length} {modifiedItems.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>
                <span className="text-xs font-extrabold text-blue-700 whitespace-nowrap">
                  ₹{modifiedItems.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0)}
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
                    const orig = modifyingOrder?.items?.find((o) => (o.productId || o.id || o._id) === (itm.productId || itm.id || itm._id));
                    const isNew = !orig;
                    const qtyChange = isNew ? itm.quantity : itm.quantity - orig.quantity;

                    return (
                      <div key={itm.productId || itm.id || itm._id} className="py-2.5 flex items-center justify-between gap-2">
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

            {/* Right Column: Quick Add Dish with Categories and Filter */}
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

              {/* Category Filter Pills (Wrapped for easy viewing & scrolling on desktop & mobile) */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs max-h-32 sm:max-h-36 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 ${
                    activeCategory === 'ALL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All ({availableProducts.length})
                </button>
                {categories.map((c) => {
                  const cId = c.id || c._id;
                  const cCount = availableProducts.filter((p) => (p.categoryId || p.category) === cId).length;
                  return (
                    <button
                      key={cId}
                      type="button"
                      onClick={() => setActiveCategory(cId)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 ${
                        activeCategory === cId
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {c.name} {cCount > 0 && <span className="opacity-80 font-semibold">({cCount})</span>}
                    </button>
                  );
                })}
              </div>

              {/* Available Dishes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredQuickProducts.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                    No matching available dishes found.
                  </div>
                ) : (
                  filteredQuickProducts.map((p) => {
                    const pId = p.id || p._id;
                    const inOrder = modifiedItems.find((i) => (i.productId || i.id || i._id) === pId);

                    return (
                      <button
                        key={pId}
                        type="button"
                        onClick={() => handleAddDishToModified(p)}
                        className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between group ${
                          inOrder
                            ? 'bg-blue-50/60 border-blue-300 hover:border-blue-400'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-bold text-slate-800 text-xs line-clamp-2 leading-tight">
                              {p.name}
                            </p>
                            {inOrder && (
                              <span className="shrink-0 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-600 text-white">
                                {inOrder.quantity}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {p.station || 'Main'}
                          </span>
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="font-extrabold text-xs text-slate-900">₹{p.price}</span>
                          <span className="text-[10px] font-bold text-blue-600 group-hover:underline">
                            + Add
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Modification Reason & Delta Impact */}
          {(() => {
            const delta = getModificationChanges();
            return (
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>Delta Changes Detected:</span>
                    <span className="bg-blue-600 text-white font-mono px-1.5 py-0.2 rounded text-[10px]">
                      {delta.deltaCount} change(s)
                    </span>
                  </p>
                  <p className="text-[11px] text-blue-700">
                    {delta.added > 0 && `+${delta.added} added, `}
                    {delta.updated > 0 && `${delta.updated} qty modified, `}
                    {delta.removed > 0 && `-${delta.removed} removed.`}
                    {delta.requiresKot
                      ? ' A modification KOT will be dispatched to the kitchen.'
                      : ' No operational KOT required.'}
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    className="w-full text-xs p-2 rounded-lg border border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Reason for change (e.g. Guest added items)"
                    value={modificationReason}
                    onChange={(e) => setModificationReason(e.target.value)}
                  />
                </div>
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => setModifyingOrder(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold"
              loading={modLoading}
            >
              Submit Updated Order &amp; Send KOT
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
