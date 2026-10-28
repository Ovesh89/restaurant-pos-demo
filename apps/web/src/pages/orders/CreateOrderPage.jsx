import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  Trash2,
  Coffee,
  CheckCircle,
  Clock,
  ArrowLeft,
  FileText,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Flame,
  Printer,
  Receipt,
  Save,
  RefreshCw,
  Send
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useRestaurant } from '../../context/RestaurantContext';
import { tableRepository } from '../../services/repositories/tableRepository';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { billRepository } from '../../services/repositories/billRepository';
import { kotRepository } from '../../services/repositories/kotRepository';
import { customerRepository } from '../../services/repositories/customerRepository';
import { settingsRepository } from '../../services/repositories/settingsRepository';
import { printService, formatReceiptSequence } from '../../services/printing/printService';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';

export const CreateOrderPage = () => {
  const { user, role } = useAuth();
  const isCaptain = role === 'captain' || user?.role === 'captain';
  const { t, formatNumber } = useTranslation();
  const { settings } = useRestaurant();
  const requireOrderApproval = settings?.requireOrderApproval !== false;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTableId = searchParams.get('tableId');
  const isFromTables = Boolean(preselectedTableId || searchParams.get('from') === 'tables');

  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Mobile active tab: 'menu' | 'cart'
  const [mobileTab, setMobileTab] = useState('menu');

  // Selected Table & Order Type
  const [selectedTable, setSelectedTable] = useState(null);
  const [orderType, setOrderType] = useState('DINE_IN'); // DINE_IN, TAKEAWAY, ZOMATO, SWIGGY, ONLINE_OTHER
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [onlineOrderRef, setOnlineOrderRef] = useState('');

  // Active / Existing Order & Bill States (For modification and on-page bill generation)
  const [existingOrder, setExistingOrder] = useState(null);
  const [activeBill, setActiveBill] = useState(null);
  const isBillLockedForCaptain = isCaptain && Boolean(activeBill);
  const [billLoading, setBillLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Cart
  const [cart, setCart] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [spiceLevel, setSpiceLevel] = useState('');

  // Filtering
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Item Note Modal
  const [editingItemNote, setEditingItemNote] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Off-menu Custom Item Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', price: '', quantity: 1, notes: '', station: 'Main Curry' });

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadActiveOrderForTable = async (tbl) => {
    if (!tbl) {
      setExistingOrder(null);
      setActiveBill(null);
      return;
    }
    try {
      let activeOrd = await orderRepository.getActiveOrderByTable(tbl.id);
      if (!activeOrd) {
        const cleanNo = String(tbl.tableNo || '').replace(/^T-?/i, '');
        const allOrdersRes = await orderRepository.getOrders({ limit: 100 }).catch(() => []);
        const allOrders = Array.isArray(allOrdersRes?.items)
          ? allOrdersRes.items
          : Array.isArray(allOrdersRes)
          ? allOrdersRes
          : [];
        activeOrd = allOrders.find(
          (o) =>
            (o.tableId === tbl.id ||
              String(o.tableNo || '').replace(/^T-?/i, '') === cleanNo) &&
            !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status)
        );
      }

      if (activeOrd) {
        setExistingOrder(activeOrd);
        const activeItems = (activeOrd.items || [])
          .filter((i) => (i.status || 'ACTIVE') !== 'CANCELLED')
          .map((i) => ({
            productId: i.productId || i.id || i._id,
            name: i.name,
            code: i.code || '',
            price: i.unitPrice !== undefined ? Number(i.unitPrice) : Number(i.price || 0),
            taxRate: i.taxRate !== undefined ? Number(i.taxRate) : 5,
            station: i.station || 'Main Curry',
            kotRequired: i.kotRequired !== false,
            quantity: Number(i.quantity) || 1,
            notes: i.notes || i.note || '',
            id: i.id || i._id
          }));
        setCart(activeItems);
        if (activeOrd.customerName) setCustomerName(activeOrd.customerName);
        if (activeOrd.customerPhone) setCustomerPhone(activeOrd.customerPhone);
        if (activeOrd.notes) setOrderNotes(activeOrd.notes);
        if (activeOrd.orderType) setOrderType(activeOrd.orderType);

        // Fetch bill if exists
        const b = await billRepository.getBillByOrderId(activeOrd.id).catch(() => null);
        setActiveBill(b || null);
      } else {
        setExistingOrder(null);
        setActiveBill(null);
      }
    } catch (err) {
      console.warn('Failed to load active order for table:', err);
    }
  };

  const initData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [tList, cList, pList] = await Promise.all([
        tableRepository.getTables(),
        categoryRepository.getCategories(false), // only active
        productRepository.getProducts({ onlyAvailable: true })
      ]);

      setTables(tList);
      setCategories(cList);
      setProducts(pList);

      let targetTable = null;
      if (preselectedTableId) {
        const match = tList.find((t) => t.id === preselectedTableId);
        if (match) targetTable = match;
      } else if (tList.length > 0) {
        targetTable = tList[0];
      }
      setSelectedTable(targetTable);
      if (targetTable) {
        await loadActiveOrderForTable(targetTable);
      }
    } catch (err) {
      console.error('Failed to load order entry data:', err);
      setLoadError(err.message || 'Failed to load menu products. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTable = async (tbl) => {
    setSelectedTable(tbl);
    await loadActiveOrderForTable(tbl);
  };

  useEffect(() => {
    initData();
  }, [preselectedTableId]);

  // Cart Item Management
  const handleAddToCart = (product) => {
    if (isBillLockedForCaptain) {
      setActionError('Bill has already been generated. Captains cannot alter or modify orders after bill generation.');
      return;
    }
    const cat = categories.find((c) => c.id === product.categoryId);
    const kotRequired = cat ? cat.kotRequired !== false : (product.kotRequired !== false);

    setCart((prev) => {
      const existsIndex = prev.findIndex((item) => item.productId === product.id);
      if (existsIndex > -1) {
        return prev.map((item, index) =>
          index === existsIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            code: product.code,
            price: product.price,
            taxRate: product.taxRate || 5,
            station: product.station || product.kitchenStation || 'Main Curry',
            kotRequired,
            quantity: 1,
            notes: ''
          }
        ];
      }
    });
  };

  const handleUpdateQuantity = (productId, delta) => {
    if (isBillLockedForCaptain) {
      setActionError('Bill has already been generated. Captains cannot alter or modify orders after bill generation.');
      return;
    }
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveFromCart = (productId) => {
    if (isBillLockedForCaptain) {
      setActionError('Bill has already been generated. Captains cannot alter or modify orders after bill generation.');
      return;
    }
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleOpenNoteModal = (item) => {
    if (isBillLockedForCaptain) {
      setActionError('Bill has already been generated. Captains cannot alter or modify orders after bill generation.');
      return;
    }
    setEditingItemNote(item);
    setNoteText(item.notes || '');
  };

  const handleSaveItemNote = () => {
    if (!editingItemNote) return;
    setCart((prev) =>
      prev.map((item) =>
        item.productId === editingItemNote.productId ? { ...item, notes: noteText.trim() } : item
      )
    );
    setEditingItemNote(null);
  };

  const handleAddCustomItem = (e) => {
    e.preventDefault();
    if (isBillLockedForCaptain) {
      setActionError('Bill has already been generated. Captains cannot alter or modify orders after bill generation.');
      return;
    }
    if (!customItem.name.trim() || !customItem.price) return;

    const newItem = {
      productId: `custom-${Date.now()}`,
      name: `${customItem.name.trim()} (Special)`,
      code: 'OFF-MENU',
      price: Number(customItem.price),
      taxRate: 5,
      station: customItem.station,
      kotRequired: true,
      quantity: Number(customItem.quantity) || 1,
      notes: customItem.notes.trim()
    };

    setCart((prev) => [...prev, newItem]);
    setIsCustomModalOpen(false);
    setCustomItem({ name: '', price: '', quantity: 1, notes: '', station: 'Main Curry' });
  };

  // Submit / Hold
  const handleProcessOrder = async (isDraft = false) => {
    const isTableOrder = orderType === 'DINE_IN';
    if (isTableOrder && !selectedTable) {
      setActionError('Please select a dining table for Dine-in orders.');
      return;
    }

    if (cart.length === 0) {
      setActionError('Please add at least one dish to the order.');
      return;
    }

    setActionError('');
    setSubmitting(true);

    try {
      const captain = {
        id: user?.id || 'captain',
        name: user?.name || 'Captain'
      };

      const resolvedTableNo = isTableOrder
        ? selectedTable?.tableNo
        : orderType === 'TAKEAWAY'
        ? (customerName ? `Take Away (${customerName})` : 'Take Away')
        : orderType === 'ZOMATO'
        ? (onlineOrderRef ? `Zomato #${onlineOrderRef}` : 'Zomato')
        : orderType === 'SWIGGY'
        ? (onlineOrderRef ? `Swiggy #${onlineOrderRef}` : 'Swiggy')
        : (customerName ? `Online (${customerName})` : 'Online');

      const finalOrderNotes = [
        spiceLevel,
        orderNotes.trim()
      ].filter(Boolean).join(' • ');

      const created = await orderRepository.createOrder({
        table: isTableOrder ? selectedTable : null,
        tableNo: resolvedTableNo,
        captain,
        items: cart,
        notes: finalOrderNotes,
        isDraft,
        autoApprove: !isDraft && !requireOrderApproval,
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        onlineOrderRef: onlineOrderRef.trim(),
      });

      if (customerPhone || customerName) {
        customerRepository.createCustomer({ name: customerName, mobile: customerPhone }).catch(() => {});
      }

      setExistingOrder(created);
      setSuccessMsg('Order placed successfully! Dispatched to kitchen.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setActionError(err.message || 'Failed to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessExistingOrder = async () => {
    if (isBillLockedForCaptain) {
      setActionError('Bill has already been generated. Captains cannot alter or modify bills.');
      return;
    }
    if (cart.length === 0) {
      setActionError('Please add at least one dish to the order.');
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      const actor = {
        id: user?.id || 'captain',
        name: user?.name || 'Captain',
        role: user?.role || 'captain'
      };
      const cleanModReason = 'Dish update from table order page';
      await orderRepository.modifyOrderItems(existingOrder.id, cart, cleanModReason, actor);

      if (customerPhone || customerName) {
        customerRepository.createCustomer({ name: customerName, mobile: customerPhone }).catch(() => {});
      }

      const freshOrder = await orderRepository.getOrderById(existingOrder.id);
      if (freshOrder) setExistingOrder(freshOrder);

      // If bill already exists, regenerate with latest items
      if (activeBill && !isCaptain) {
        const freshBill = await billRepository.generateBill({
          order: freshOrder || existingOrder,
          discount: { type: 'FIXED', value: 0 },
          customer: { name: customerName, mobile: customerPhone },
          actor
        });
        setActiveBill(freshBill);
      }

      setSuccessMsg('Order updated successfully! Kitchen KOT dispatched.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setActionError(err.message || 'Failed to update order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateBill = async () => {
    const targetOrder = existingOrder;
    if (!targetOrder) return;
    if (isBillLockedForCaptain) {
      setActionError('Bill has already been generated. Captains cannot alter or modify bills.');
      return;
    }
    setBillLoading(true);
    setActionError('');
    try {
      const actor = { id: user?.id || 'captain', name: user?.name || 'Staff', role: user?.role || 'captain' };
      const bill = await billRepository.generateBill({
        order: targetOrder,
        discount: { type: 'FIXED', value: 0 },
        customer: { name: customerName, mobile: customerPhone },
        actor
      });
      setActiveBill(bill);
      setSuccessMsg(`Bill #${formatReceiptSequence(bill.billNo || bill.billNumber)} generated! Total: ₹${formatNumber(bill.grandTotal)}`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setActionError(err.message || 'Failed to generate bill.');
    } finally {
      setBillLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    const targetOrder = existingOrder;
    if (!targetOrder) return;
    setPrintLoading(true);
    setActionError('');
    try {
      let billToPrint = activeBill;
      if (!billToPrint) {
        const actor = { id: user?.id || 'captain', name: user?.name || 'Staff' };
        billToPrint = await billRepository.generateBill({
          order: targetOrder,
          discount: { type: 'FIXED', value: 0 },
          customer: { name: customerName, mobile: customerPhone },
          actor
        });
        setActiveBill(billToPrint);
      }
      const sysSettings = await settingsRepository.getSettings().catch(() => ({}));
      const configuredUpiId = sysSettings?.upiId || 'q705457761@ybl';
      printService.printInvoice(
        billToPrint,
        targetOrder,
        { name: customerName, mobile: customerPhone },
        null,
        { table: selectedTable, upiId: configuredUpiId }
      );
    } catch (err) {
      setActionError(err.message || 'Failed to print receipt.');
    } finally {
      setPrintLoading(false);
    }
  };

  const handlePrintKOT = async () => {
    const targetOrder = existingOrder;
    if (!targetOrder) return;
    try {
      const kots = await kotRepository.getKOTs({ orderId: targetOrder.id });
      const latestKot = Array.isArray(kots) && kots.length > 0 ? kots[kots.length - 1] : null;
      if (latestKot) {
        printService.printKOT(latestKot, targetOrder, selectedTable);
      } else {
        printService.printKOT(
          {
            kotNo: `KOT-${formatReceiptSequence(targetOrder.orderNo || '001')}`,
            orderNumber: targetOrder.orderNo,
            tableNo: selectedTable?.tableNo,
            items: cart,
            createdAt: new Date().toISOString(),
            captainName: targetOrder.captainName || user?.name || 'Staff'
          },
          targetOrder,
          selectedTable
        );
      }
    } catch (err) {
      console.warn('Print KOT failed:', err);
    }
  };

  // Filter products by category & search
  const filteredProducts = products.filter((p) => {
    const matchesCat = activeCategory === 'ALL' || p.categoryId === activeCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.price, 0);
  const totalCartItems = cart.reduce((a, b) => a + b.quantity, 0);
  const taxRate = 5;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const grandTotal = Math.round(subtotal + taxAmount);

  return (
    <div className="min-h-[calc(100vh-9.5rem)] lg:h-[calc(100vh-8.5rem)] flex flex-col">
      {/* Top Header / Table & Order Type Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 mb-3 sm:mb-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(isCaptain || isFromTables ? '/tables' : '/orders')}>
              {t('common.back', null, 'Back')}
            </Button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Order Type Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold overflow-x-auto no-scrollbar max-w-full">
              <button
                type="button"
                onClick={() => setOrderType('DINE_IN')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderType === 'DINE_IN'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('orders.dineIn', null, 'Dine-In')}
              </button>
              <button
                type="button"
                onClick={() => setOrderType('TAKEAWAY')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderType === 'TAKEAWAY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('orders.takeaway', null, 'Take Away')}
              </button>
              <button
                type="button"
                onClick={() => setOrderType('ZOMATO')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderType === 'ZOMATO'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Zomato
              </button>
              <button
                type="button"
                onClick={() => setOrderType('SWIGGY')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderType === 'SWIGGY'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Swiggy
              </button>
              <button
                type="button"
                onClick={() => setOrderType('ONLINE_OTHER')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderType === 'ONLINE_OTHER'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Online Other
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsCustomModalOpen(true)}>
              {t('orders.offMenuItem', null, 'Off-Menu Item')}
            </Button>
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">{t('orders.captain', null, 'Captain')}</span>
              <p className="text-xs font-bold text-slate-800">{user?.name}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Context Fields based on Order Type */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
          {orderType === 'DINE_IN' ? (
            <div className="flex flex-wrap items-center gap-3 w-full">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-500">{t('orders.selectTable', null, 'Select Table:')}</span>
                <select
                  value={selectedTable?.id || ''}
                  onChange={(e) => {
                    const t = tables.find((tbl) => tbl.id === e.target.value);
                    handleSelectTable(t);
                  }}
                  className="text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {tables.map((tbl) => (
                    <option key={tbl.id} value={tbl.id}>
                      {t('orders.table', null, 'Table')} {tbl.tableNo} ({formatNumber(tbl.capacity)} Pax) - {tbl.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Guest / Customer details for Dine-In */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={t('customers.customerName', null, 'Guest Name (Optional)')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 w-36 sm:w-44"
                />
                <input
                  type="tel"
                  placeholder={t('customers.mobileNumber', null, 'Mobile # (Optional)')}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 w-28 sm:w-36"
                />
              </div>
            </div>
          ) : orderType === 'TAKEAWAY' ? (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-emerald-700">{t('orders.takeawayParcel', null, 'Take Away Parcel:')}</span>
              <input
                type="text"
                placeholder={t('customers.customerName', null, 'Guest Full Name (e.g. Ramesh Patel)')}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500 w-52"
              />
              <input
                type="text"
                placeholder={t('customers.mobileNumber', null, 'Mobile # (Optional)')}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500 w-36"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <UtensilsCrossed className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-purple-700">{orderType} {t('orders.order', null, 'Order')}:</span>
              <input
                type="text"
                placeholder="Online Order Ref # (e.g. ZOM-8921)"
                value={onlineOrderRef}
                onChange={(e) => setOnlineOrderRef(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-500 w-44"
              />
              <input
                type="text"
                placeholder={t('customers.customerName', null, 'Customer Name (Optional)')}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-500 w-48"
              />
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-3 sm:mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-semibold shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-3 sm:mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-800 font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>
        </div>
      )}

      {/* Active Order Banner if editing/modifying an existing order */}
      {existingOrder && (
        <div className="mb-3 sm:mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
              #{formatReceiptSequence(existingOrder.orderNo || existingOrder.id)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-800">
                  {selectedTable ? `Table ${selectedTable.tableNo}` : existingOrder.tableNo} • Active Order
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {existingOrder.status}
                </span>
                {isBillLockedForCaptain && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Bill Finalized (No Edits)
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {isBillLockedForCaptain
                  ? `Bill #${formatReceiptSequence(activeBill.billNo || activeBill.billNumber)} generated. Captains cannot alter or modify bills.`
                  : 'Modify dishes below, view live amounts, generate bill, or print receipt anytime.'
                }
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              icon={FileText}
              onClick={handlePrintKOT}
              className="text-xs font-bold"
            >
              Print KOT
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Receipt}
              onClick={handleGenerateBill}
              loading={billLoading}
              disabled={isBillLockedForCaptain}
              className="text-xs font-bold"
            >
              {activeBill ? (isCaptain ? 'Bill Generated' : 'Regenerate Bill') : 'Generate Bill'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Printer}
              onClick={handlePrintReceipt}
              loading={printLoading}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Print Receipt
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Segmented Tab Switcher (Visible on < lg screens) */}
      <div className="lg:hidden flex items-center bg-slate-200/70 p-1 rounded-xl mb-3 text-xs font-bold shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('menu')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            mobileTab === 'menu'
              ? 'bg-white text-blue-700 shadow-xs font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('menu.productsTitle', null, 'Menu Catalog')} ({formatNumber(filteredProducts.length)})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'cart'
              ? 'bg-white text-blue-700 shadow-xs font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{t('orders.orderItems', null, 'Order Ticket')}</span>
          {totalCartItems > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {formatNumber(totalCartItems)}
            </span>
          )}
        </button>
      </div>

      {/* Main Content: Split 65% Catalog / 35% Sticky Cart */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-5 min-h-0 pb-16 lg:pb-0">
        {/* Left: Food Catalog */}
        <div
          className={`${
            mobileTab === 'menu' ? 'flex' : 'hidden'
          } lg:flex lg:w-2/3 flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-0 flex-1`}
        >
          {/* Search & Category Tabs */}
          <div className="p-3 sm:p-4 border-b border-slate-100 space-y-2.5 sm:space-y-3">
            <div className="w-full">
              <Input
                icon={Search}
                placeholder={t('orders.searchDishes', null, 'Search dishes by name or SKU...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter Pills (Wrapped for complete visibility across all categories) */}
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2 text-xs max-h-48 overflow-y-auto pr-1 pos-tag-grid">
              <button
                type="button"
                onClick={() => setActiveCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                  activeCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t('menu.productsTitle', null, 'All Menu')} ({formatNumber(products.length)})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                    activeCategory === c.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dish Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <p className="text-center py-12 text-slate-400 text-sm">{t('common.loading', null, 'Loading available menu...')}</p>
            ) : loadError ? (
              <div className="text-center py-12 text-red-500 text-sm space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto text-red-400 mb-1" />
                <p className="font-semibold">{loadError}</p>
                <Button variant="secondary" size="sm" onClick={() => initData()}>
                  {t('common.retry', null, 'Retry')}
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm space-y-1">
                <p className="font-medium">{t('orders.noDishesAvailable', null, 'No dishes available on the menu.')}</p>
                <p className="text-xs text-slate-400">Please verify menu products configuration.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                <p>{t('orders.noDishesMatch', null, 'No dishes match your filter.')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {filteredProducts.map((p) => {
                  const inCart = cart.find((item) => item.productId === p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddToCart(p)}
                      className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                        inCart
                          ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-[10px] font-mono font-bold text-slate-400">{p.code}</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.station}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {p.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-900">₹{formatNumber(p.price)}</span>
                        {inCart ? (
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            {formatNumber(inCart.quantity)}
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white font-bold text-xs flex items-center justify-center transition-colors">
                            +
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Sticky Order Ticket Cart */}
        <div
          className={`${
            mobileTab === 'cart' ? 'flex' : 'hidden'
          } lg:flex lg:w-[38%] xl:w-[36%] flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-0 flex-1`}
        >
          {/* Cart Header */}
          <div className="p-2.5 sm:p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm sm:text-base font-bold text-slate-800">{t('orders.orderItems', null, 'Order Items')}</h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
              {formatNumber(totalCartItems)} {t('orders.dishes', null, 'Items')}
            </span>
          </div>

          {/* Cart Items List - Enlarged visible scroll area */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-1.5 min-h-[140px]">
            {cart.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-slate-400">
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                <p className="text-xs font-semibold">{t('orders.noItemsInCart', null, 'No dishes added yet')}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('orders.chooseFromMenu', null, 'Click any item from the menu to add')}</p>
                <button
                  type="button"
                  onClick={() => setMobileTab('menu')}
                  className="mt-2.5 lg:hidden inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg"
                >
                  {t('menu.productsTitle', null, 'Browse Menu Catalog')}
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="p-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/80 transition-colors shadow-2xs text-xs">
                  {/* Top Row: Dish Name & Subtotal */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 text-xs sm:text-[13px] truncate leading-tight flex-1">
                      {item.name}
                    </span>
                    <span className="font-black text-slate-900 text-xs sm:text-[13px] shrink-0">
                      ₹{formatNumber(item.quantity * item.price)}
                    </span>
                  </div>

                  {/* Note preview if any */}
                  {item.notes && (
                    <p className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded italic mt-1 line-clamp-1">
                      * {item.notes}
                    </p>
                  )}

                  {/* Bottom Row: Unit Price + Note + Stepper */}
                  <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">₹{formatNumber(item.price)} ea</span>
                      {!isBillLockedForCaptain && (
                        <button
                          type="button"
                          onClick={() => handleOpenNoteModal(item)}
                          className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-0.5"
                        >
                          <FileText className="w-2.5 h-2.5" />
                          <span>{item.notes ? 'Edit Note' : 'Add Note'}</span>
                        </button>
                      )}
                    </div>

                    {!isBillLockedForCaptain ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, -1)}
                          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center font-bold active:scale-95 shadow-2xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <span className="font-black text-slate-800 text-xs px-1 min-w-[18px] text-center">
                          {formatNumber(item.quantity)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, 1)}
                          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center font-bold active:scale-95 shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.productId)}
                          className="w-6 h-6 text-slate-400 hover:text-red-600 ml-0.5 flex items-center justify-center"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Qty: {formatNumber(item.quantity)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Summary & Actions - Compact sizing */}
          <div className="p-2.5 sm:p-3 border-t border-slate-200 bg-slate-50/95 space-y-1.5 shrink-0">
            {/* Short Notes (Optional) - All 3 options in ONE line on mobile & desktop */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-500" />
                  <span>Short Notes (Optional)</span>
                </span>
                {spiceLevel && (
                  <button
                    type="button"
                    onClick={() => setSpiceLevel('')}
                    className="text-[10px] text-slate-400 hover:text-red-500 font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>
              {/* All three options on one line */}
              <div className="grid grid-cols-3 gap-1 w-full">
                {[
                  { id: 'Low spicy', label: 'Low spicy', base: 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100', active: 'bg-emerald-600 text-white border-emerald-600 shadow-xs' },
                  { id: 'Medium spicy', label: 'Medium spicy', base: 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100', active: 'bg-amber-600 text-white border-amber-600 shadow-xs' },
                  { id: 'Hot spicy', label: 'Hot spicy', base: 'border-rose-300 text-rose-800 bg-rose-50 hover:bg-rose-100', active: 'bg-rose-600 text-white border-rose-600 shadow-xs' },
                ].map((opt) => {
                  const isSelected = spiceLevel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSpiceLevel((prev) => (prev === opt.id ? '' : opt.id))}
                      className={`px-1 py-1 rounded-lg text-[10px] font-bold border text-center transition-all truncate h-7 sm:h-7.5 flex items-center justify-center ${
                        isSelected ? opt.active : opt.base
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Kitchen Notes (Compact single input) */}
            <div>
              <input
                type="text"
                placeholder={t('orders.specialInstructionsPlaceholder', null, 'Kitchen notes for order...')}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>

            {/* Compact Amount Breakdown */}
            <div className="pt-1.5 border-t border-slate-200 space-y-0.5 text-xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>{t('billing.subtotalAmount', null, 'Subtotal')} / GST (5%)</span>
                <span>₹{formatNumber(subtotal)} + ₹{formatNumber(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between font-black text-slate-900 text-sm sm:text-base">
                <span>Total Amount</span>
                <span className="text-blue-700">₹{formatNumber(grandTotal)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            {existingOrder ? (
              <div className="space-y-1.5 pt-0.5">
                <Button
                  variant="primary"
                  className="w-full font-black text-xs sm:text-sm h-8 sm:h-9 bg-blue-600 hover:bg-blue-700"
                  disabled={cart.length === 0 || submitting || isBillLockedForCaptain}
                  loading={submitting}
                  onClick={handleProcessExistingOrder}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  {isBillLockedForCaptain ? 'Order Locked (Bill Generated)' : 'Update Order'}
                </Button>

                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="secondary"
                    className="font-bold text-xs h-8 px-2"
                    icon={Receipt}
                    onClick={handleGenerateBill}
                    disabled={isBillLockedForCaptain}
                    loading={billLoading}
                  >
                    {activeBill ? (isCaptain ? 'Bill Generated' : 'Update Bill') : 'Generate Bill'}
                  </Button>
                  <Button
                    variant="primary"
                    className="font-bold text-xs h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    icon={Printer}
                    onClick={handlePrintReceipt}
                    loading={printLoading}
                  >
                    Print Receipt
                  </Button>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <button
                    type="button"
                    onClick={handlePrintKOT}
                    className="text-slate-600 hover:text-blue-600 font-bold flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Print KOT</span>
                  </button>
                  {activeBill && (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                      Bill #{formatReceiptSequence(activeBill.billNo || activeBill.billNumber)}: ₹{formatNumber(activeBill.grandTotal)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <Button
                  variant="secondary"
                  className="h-8 sm:h-9 text-xs font-bold"
                  disabled={cart.length === 0 || submitting}
                  onClick={() => handleProcessOrder(true)}
                >
                  {t('orders.holdOrder', null, 'Hold Order')}
                </Button>
                <Button
                  variant="primary"
                  className="h-8 sm:h-9 text-xs font-bold"
                  disabled={cart.length === 0 || submitting}
                  loading={submitting}
                  onClick={() => handleProcessOrder(false)}
                >
                  {requireOrderApproval
                    ? t('orders.submitForApproval', null, 'Submit')
                    : t('orders.sendDirectKot', null, 'Send to Kitchen')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bottom Order Summary Bar for Mobile (When browsing menu) */}
      {mobileTab === 'menu' && totalCartItems > 0 && (
        <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30 bg-blue-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-xs">
              {formatNumber(totalCartItems)}
            </div>
            <div>
              <span className="text-xs font-bold block leading-tight">
                {existingOrder ? 'Active Order' : 'New Order'} • {formatNumber(totalCartItems)} {t('orders.dishes', null, 'Dishes')}
              </span>
              <span className="text-sm font-black">₹{formatNumber(grandTotal)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="px-3.5 py-1.5 bg-white text-blue-700 font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition-transform"
          >
            <span>{existingOrder ? 'Update / Bill' : t('orders.reviewTicket', null, 'Review Ticket')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Item Note Modal */}
      <Modal
        isOpen={!!editingItemNote}
        onClose={() => setEditingItemNote(null)}
        title={t('orders.kitchenInstruction', null, 'Kitchen Instruction')}
        subtitle={`Special notes for "${editingItemNote?.name}"`}
      >
        <div className="space-y-4">
          {/* Quick Short Notes Options */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Short Notes (Optional)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pos-tag-grid">
              {[
                { id: 'Low spicy', label: 'Low spicy', base: 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100', active: 'bg-emerald-600 text-white border-emerald-600 shadow-xs' },
                { id: 'Medium spicy', label: 'Medium spicy', base: 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100', active: 'bg-amber-600 text-white border-amber-600 shadow-xs' },
                { id: 'Hot spicy', label: 'Hot spicy', base: 'border-rose-300 text-rose-800 bg-rose-50 hover:bg-rose-100', active: 'bg-rose-600 text-white border-rose-600 shadow-xs' },
              ].map((opt) => {
                const isActive = (noteText || '').includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setNoteText((prev) => {
                        const words = ['Low spicy', 'Medium spicy', 'Hot spicy'];
                        let clean = prev || '';
                        words.forEach((w) => {
                          clean = clean.replace(new RegExp(`(^|•|,|\\s)*${w}(•|,|\\s)*`, 'gi'), ' ');
                        });
                        clean = clean.replace(/\s*•\s*/g, ' • ').trim();
                        if (isActive) {
                          return clean;
                        }
                        return clean ? `${opt.id} • ${clean}` : opt.id;
                      });
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border text-center transition-all ${
                      isActive ? opt.active : opt.base
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label={t('orders.dishPrepNote', null, 'Special Kitchen Notes')}
            placeholder={t('orders.dishPrepPlaceholder', null, 'e.g. Less spicy, no onion/garlic, well-done...')}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
          />
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setEditingItemNote(null)}>
              {t('common.cancel', null, 'Cancel')}
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSaveItemNote}>{t('common.save', null, 'Save Note')}</Button>
          </div>
        </div>
      </Modal>

      {/* Off-Menu Custom Item Modal */}
      <Modal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        title={t('orders.offMenuItem', null, 'Add Off-Menu Dish')}
        subtitle="Special request dish not listed in regular menu"
      >
        <form onSubmit={handleAddCustomItem} className="space-y-4">
          <Input
            label={t('menu.productName', null, 'Dish Name')}
            placeholder="e.g. Chef Special Halwa"
            value={customItem.name}
            onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`${t('menu.price', null, 'Price')} (₹)`}
              type="number"
              min="0"
              placeholder="e.g. 250"
              value={customItem.price}
              onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
              required
            />
            <Input
              label={t('common.qty', null, 'Quantity')}
              type="number"
              min="1"
              value={customItem.quantity}
              onChange={(e) => setCustomItem({ ...customItem, quantity: e.target.value })}
              required
            />
          </div>

          <Input
            label={t('orders.cookingNotes', null, 'Cooking Notes')}
            placeholder="e.g. Made in pure desi ghee"
            value={customItem.notes}
            onChange={(e) => setCustomItem({ ...customItem, notes: e.target.value })}
          />

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setIsCustomModalOpen(false)}>
              {t('common.cancel', null, 'Cancel')}
            </Button>
            <Button type="submit" className="w-full sm:w-auto">{t('orders.addToOrder', null, 'Add to Order')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
