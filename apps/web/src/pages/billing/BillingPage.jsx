import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  DollarSign,
  Search,
  Printer,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  User,
  Coffee,
  Receipt,
  Tag,
  RefreshCw,
  Wallet,
  Clock,
  Edit3,
  Layers,
  Eye,
  ChevronRight,
  X,
  Calendar
} from 'lucide-react';
import { billRepository, BILL_STATUS } from '../../services/repositories/billRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { customerRepository } from '../../services/repositories/customerRepository';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { settingsRepository } from '../../services/repositories/settingsRepository';
import { printService, formatReceiptSequence } from '../../services/printing/printService';
import { billingCalculator, DISCOUNT_TYPES, PAYMENT_MODES } from '../../services/calculations/billingCalculator';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { ORDER_STATUS } from '../../constants/orderStatus';

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(filterType, customFrom, customTo) {
  const now = new Date();
  const todayStr = getLocalDateString(now);

  if (filterType === 'TODAY') {
    return { dateFrom: todayStr, dateTo: todayStr };
  }

  if (filterType === 'YESTERDAY') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = getLocalDateString(yest);
    return { dateFrom: yestStr, dateTo: yestStr };
  }

  if (filterType === 'THIS_WEEK') {
    const start = new Date(now);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
    start.setDate(diff);
    return { dateFrom: getLocalDateString(start), dateTo: todayStr };
  }

  if (filterType === 'THIS_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: getLocalDateString(start), dateTo: todayStr };
  }

  if (filterType === 'CUSTOM') {
    return {
      dateFrom: customFrom || todayStr,
      dateTo: customTo || todayStr,
    };
  }

  return { dateFrom: todayStr, dateTo: todayStr };
}

function getDateRangeLabel(filterType, customFrom, customTo) {
  const { dateFrom, dateTo } = getDateRange(filterType, customFrom, customTo);
  if (filterType === 'TODAY') {
    return `Today (${dateFrom})`;
  }
  if (filterType === 'YESTERDAY') {
    return `Yesterday (${dateFrom})`;
  }
  if (filterType === 'THIS_WEEK') {
    return `This Week (${dateFrom} to ${dateTo})`;
  }
  if (filterType === 'THIS_MONTH') {
    return `This Month (${dateFrom} to ${dateTo})`;
  }
  return `${dateFrom} to ${dateTo}`;
}

export const BillingPage = () => {
  const { user } = useAuth();
  const { t, formatCurrency, formatNumber } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasAutoOpenedRef = useRef(false);

  const [readyOrders, setReadyOrders] = useState([]);
  const [billsHistory, setBillsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Settled Invoices Filter State (Today by default)
  const [dateFilter, setDateFilter] = useState('TODAY'); // 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'
  const [customFromDate, setCustomFromDate] = useState(() => getLocalDateString());
  const [customToDate, setCustomToDate] = useState(() => getLocalDateString());
  const [historySearch, setHistorySearch] = useState('');

  // Settlement Checkout Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeBill, setActiveBill] = useState(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerResults, setCustomerResults] = useState([]);

  // Discount
  const [discountType, setDiscountType] = useState(DISCOUNT_TYPES.FIXED);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState('');

  // Payment Entry
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES.UPI);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Quick Customer Add Modal
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Post-Settlement Discount Modal State
  const [discountModalBill, setDiscountModalBill] = useState(null);
  const [modalDiscType, setModalDiscType] = useState(DISCOUNT_TYPES.PERCENTAGE);
  const [modalDiscValue, setModalDiscValue] = useState('');
  const [modalDiscReason, setModalDiscReason] = useState('');
  const [discountModalError, setDiscountModalError] = useState('');
  const [discountModalLoading, setDiscountModalLoading] = useState(false);
  const [discountModalSuccess, setDiscountModalSuccess] = useState(false);
  const [updatedSettledBill, setUpdatedSettledBill] = useState(null);

  // Dish modification modal from Settle Bill popup
  const [isBillingModifyOpen, setIsBillingModifyOpen] = useState(false);
  const [billingModifiedItems, setBillingModifiedItems] = useState([]);
  const [billingModReason, setBillingModReason] = useState('');
  const [billingAvailableProducts, setBillingAvailableProducts] = useState([]);
  const [billingCategories, setBillingCategories] = useState([]);
  const [billingActiveCategory, setBillingActiveCategory] = useState('CATEGORIES');
  const [billingSearch, setBillingSearch] = useState('');
  const [billingModLoading, setBillingModLoading] = useState(false);
  const [billingModError, setBillingModError] = useState('');

  // Inspect Settled Invoice Details Modal
  const [inspectInvoiceBill, setInspectInvoiceBill] = useState(null);
  const [isInspectLoading, setIsInspectLoading] = useState(false);

  // Add / Update Payment Sub-Modal for Inspected Invoice
  const [isExtraPaymentOpen, setIsExtraPaymentOpen] = useState(false);
  const [extraPaymentMode, setExtraPaymentMode] = useState(PAYMENT_MODES.CASH);
  const [extraPaymentAmount, setExtraPaymentAmount] = useState('');
  const [extraPaymentRef, setExtraPaymentRef] = useState('');
  const [extraPaymentLoading, setExtraPaymentLoading] = useState(false);
  const [extraPaymentError, setExtraPaymentError] = useState('');

  const loadSettledBills = async (
    overridePage = historyPage,
    overrideLimit = historyLimit,
    overrideFilter = dateFilter,
    overrideFrom = customFromDate,
    overrideTo = customToDate,
    overrideSearch = historySearch
  ) => {
    try {
      setHistoryLoading(true);
      const { dateFrom, dateTo } = getDateRange(overrideFilter, overrideFrom, overrideTo);
      const bills = await billRepository.getBills({
        status: BILL_STATUS.PAID,
        dateFrom,
        dateTo,
        search: overrideSearch?.trim() || undefined,
        page: overridePage,
        limit: overrideLimit,
      });
      setBillsHistory(bills);
      setHistoryPagination(
        bills.pagination || {
          total: bills.length,
          page: overridePage,
          limit: overrideLimit,
          totalPages: Math.max(1, Math.ceil(bills.length / overrideLimit)),
        }
      );
    } catch (err) {
      console.error('Failed to load settled bills:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadBillingData = async (
    overrideFilter = dateFilter,
    overrideFrom = customFromDate,
    overrideTo = customToDate,
    overrideSearch = historySearch,
    autoOpen = true
  ) => {
    try {
      setLoading(true);
      const { dateFrom, dateTo } = getDateRange(overrideFilter, overrideFrom, overrideTo);
      const [orders, bills, allSettledBills] = await Promise.all([
        orderRepository.getOrders({
          status: [
            ORDER_STATUS.SERVED,
            ORDER_STATUS.READY,
            ORDER_STATUS.BILLING,
            ORDER_STATUS.KOT_SENT,
            ORDER_STATUS.PREPARING,
            ORDER_STATUS.CONFIRMED,
            ORDER_STATUS.WAITING_CONFIRMATION,
            ORDER_STATUS.DRAFT,
          ],
        }),
        billRepository.getBills({
          status: BILL_STATUS.PAID,
          dateFrom,
          dateTo,
          search: overrideSearch?.trim() || undefined,
          page: 1,
          limit: historyLimit,
        }),
        billRepository.getBills({
          status: BILL_STATUS.PAID,
          limit: 200,
        }),
      ]);

      // Rule 12: Pending Settlement must exclude completed/paid/rejected/cancelled records
      const settledOrderIds = new Set(
        allSettledBills
          .filter((b) => b.isSettled || b.status === BILL_STATUS.PAID || b.rawStatus === 'COMPLETED')
          .map((b) => b.orderId)
      );
      const pendingOrders = orders.filter(
        (o) =>
          !settledOrderIds.has(o.id) &&
          o.status !== ORDER_STATUS.COMPLETED &&
          o.status !== ORDER_STATUS.CANCELLED &&
          o.status !== ORDER_STATUS.REJECTED
      );

      setReadyOrders(pendingOrders);
      setBillsHistory(bills);
      setHistoryPagination(
        bills.pagination || {
          total: bills.length,
          page: 1,
          limit: historyLimit,
          totalPages: Math.max(1, Math.ceil(bills.length / historyLimit)),
        }
      );

      if (autoOpen && !hasAutoOpenedRef.current) {
        const targetTableId = searchParams.get('tableId');
        const targetOrderId = searchParams.get('orderId');
        if (targetOrderId) {
          const match = pendingOrders.find(
            (o) => o.id === targetOrderId || o._id === targetOrderId || o.orderNo === targetOrderId || o.orderNumber === targetOrderId
          );
          if (match) {
            hasAutoOpenedRef.current = true;
            handleOpenCheckout(match);
          }
        } else if (targetTableId) {
          const match = pendingOrders.find((o) => o.tableId === targetTableId);
          if (match) {
            hasAutoOpenedRef.current = true;
            handleOpenCheckout(match);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (filterKey) => {
    setDateFilter(filterKey);
    setHistoryPage(1);
    loadSettledBills(1, historyLimit, filterKey, customFromDate, customToDate, historySearch);
  };

  const handleApplyCustomDate = () => {
    setHistoryPage(1);
    loadSettledBills(1, historyLimit, 'CUSTOM', customFromDate, customToDate, historySearch);
  };

  const handleApplySearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setHistoryPage(1);
    loadSettledBills(1, historyLimit, dateFilter, customFromDate, customToDate, historySearch);
  };

  useEffect(() => {
    hasAutoOpenedRef.current = false;
    loadBillingData(dateFilter, customFromDate, customToDate, historySearch, true);
  }, [searchParams]);

  // Close Checkout Modal & Synchronize
  const handleCloseDesk = async () => {
    hasAutoOpenedRef.current = true;
    if (activeBill && (activeBill.isSettled || activeBill.balance <= 0) && activeBill.rawStatus !== 'COMPLETED') {
      try {
        const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
        await billRepository.closeBill(activeBill.id, actor);
      } catch (err) {
        console.warn('Auto close bill on close desk failed:', err);
      }
    }
    setSelectedOrder(null);
    setActiveBill(null);
    setActionError('');
    if (searchParams.get('orderId') || searchParams.get('tableId')) {
      setSearchParams({}, { replace: true });
    }
    await loadBillingData(dateFilter, customFromDate, customToDate, historySearch, false);
  };

  // Open Checkout Terminal
  const handleOpenCheckout = async (order) => {
    setSelectedOrder(order);
    setActionError('');
    setSelectedCustomer(null);
    setDiscountValue(0);
    setDiscountReason('');

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      // Retrieve or initialize bill
      let bill;
      try {
        bill = await billRepository.generateBill({
          order,
          discount: { type: DISCOUNT_TYPES.FIXED, value: 0, reason: '' },
          actor
        });
      } catch (genErr) {
        // Fallback: If duplicate/conflict or already created, fetch directly by orderId
        const existing = await billRepository.getBillByOrderId(order.id);
        if (existing) {
          bill = existing;
        } else {
          throw genErr;
        }
      }

      // If bill is already fully settled but not yet closed on backend, close it to release table & order
      if (bill.isSettled && bill.rawStatus !== 'COMPLETED') {
        try {
          bill = await billRepository.closeBill(bill.id, actor);
          await loadBillingData();
        } catch (closeErr) {
          console.warn('Auto-closing settled bill in checkout:', closeErr);
        }
      }

      setActiveBill(bill);
      setPaymentAmount(bill.balance > 0 ? bill.balance.toString() : '');
    } catch (err) {
      console.error(err);
      setActionError(err.message);
    }
  };

  const handleOpenDiscountModal = (bill) => {
    setDiscountModalBill(bill);
    setModalDiscType(bill.discountType || DISCOUNT_TYPES.PERCENTAGE);
    setModalDiscValue(bill.discountValue ? bill.discountValue.toString() : '');
    setModalDiscReason(bill.discountReason || '');
    setDiscountModalError('');
    setDiscountModalSuccess(false);
    setUpdatedSettledBill(null);
  };

  const handleApplyPostSettlementDiscount = async (e) => {
    e.preventDefault();
    if (!discountModalBill) return;
    setDiscountModalError('');
    setDiscountModalLoading(true);

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const updated = await billRepository.applyDiscount(
        discountModalBill.id,
        {
          type: modalDiscType,
          value: Number(modalDiscValue) || 0,
          reason: modalDiscReason.trim() || 'Post-settlement discount'
        },
        actor
      );
      setUpdatedSettledBill(updated);
      setDiscountModalSuccess(true);
      await loadBillingData();
      if (inspectInvoiceBill && inspectInvoiceBill.id === discountModalBill.id) {
        setInspectInvoiceBill(updated);
      }
    } catch (err) {
      setDiscountModalError(err.message || 'Failed to update discount on settled bill.');
    } finally {
      setDiscountModalLoading(false);
    }
  };

  // Recompute bill on discount change (Reason is completely optional)
  const handleApplyDiscount = async () => {
    if (!selectedOrder) return;
    setActionError('');

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const bill = await billRepository.generateBill({
        order: selectedOrder,
        discount: {
          type: discountType,
          value: Number(discountValue) || 0,
          reason: discountReason.trim() || 'Discount'
        },
        customer: selectedCustomer,
        actor
      });
      setActiveBill(bill);
      setPaymentAmount(bill.balance > 0 ? bill.balance.toString() : '');
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Add Payment Entry (Supports Split Payments: UPI + Cash + Card)
  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!activeBill) return;

    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setActionError('Please enter a valid payment amount.');
      return;
    }

    setActionError('');
    setActionLoading(true);

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const res = await billRepository.addPayment(
        activeBill.id,
        {
          mode: paymentMode,
          amount: amt,
          reference: paymentRef.trim()
        },
        actor
      );

      const updatedBill = res.bill;
      setActiveBill(updatedBill);
      setPaymentRef('');

      // If fully settled, close the bill immediately to release the table and finalize status
      if (updatedBill.isSettled) {
        setPaymentAmount('0');
        try {
          const closed = await billRepository.closeBill(updatedBill.id, actor);
          setActiveBill(closed);
        } catch (closeErr) {
          console.warn('Auto close bill failed, proceeding with settled state:', closeErr);
        }
        await loadBillingData();
      } else {
        setPaymentAmount(updatedBill.balance > 0 ? updatedBill.balance.toString() : '');
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Finalize settlement and release dining table
  const handleCloseBill = async () => {
    if (!activeBill) return;
    setActionError('');
    setActionLoading(true);

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      await billRepository.closeBill(activeBill.id, actor);
      handlePrintInvoice();
      handleCloseDesk();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Settle remaining balance in full, close bill/order (releasing table), and print invoice
  const handleSettleAndPrint = async () => {
    if (!activeBill) return;
    setActionError('');
    setActionLoading(true);

    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      let currentBill = activeBill;

      // 1. If balance remains, record full payment using current paymentMode
      if (currentBill.balance > 0) {
        const payRes = await billRepository.addPayment(
          currentBill.id,
          {
            mode: paymentMode,
            amount: currentBill.balance,
            reference: paymentRef?.trim() || undefined,
          },
          actor
        );
        currentBill = payRes.bill || payRes;
      }

      // 2. Finalize and close the bill (marks order COMPLETED and table AVAILABLE)
      if (currentBill.rawStatus !== 'COMPLETED') {
        currentBill = await billRepository.closeBill(currentBill.id, actor);
      }

      // 3. Print thermal tax invoice
      const sysSettings = await settingsRepository.getSettings().catch(() => ({}));
      const configuredUpiId = sysSettings.upiId || 'q705457761@ybl';
      printService.printInvoice(currentBill, selectedOrder, selectedCustomer, null, {
        paymentMode,
        upiId: configuredUpiId,
      });

      // 4. Close checkout desk and refresh queue
      await handleCloseDesk();
    } catch (err) {
      setActionError(err.message || 'Failed to settle and print bill.');
    } finally {
      setActionLoading(false);
    }
  };

  // Customer search & select
  const handleSearchCustomer = async (q) => {
    setCustomerQuery(q);
    if (!q.trim()) {
      setCustomerResults([]);
      return;
    }
    try {
      const results = await customerRepository.searchCustomers(q);
      setCustomerResults(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerQuery('');
    setCustomerResults([]);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;

    try {
      const created = await customerRepository.createCustomer({
        name: newCustName.trim(),
        mobile: newCustPhone.trim()
      });
      setSelectedCustomer(created);
      setIsNewCustModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
    } catch (err) {
      alert(err.message);
    }
  };

  // Thermal printing invocation
  const handlePrintInvoice = async () => {
    if (!activeBill) return;
    const sysSettings = await settingsRepository.getSettings().catch(() => ({}));
    const configuredUpiId = sysSettings.upiId || 'q705457761@ybl';

    printService.printInvoice(activeBill, selectedOrder, selectedCustomer, null, {
      paymentMode,
      upiId: configuredUpiId,
    });
  };

  const handleReprintInvoice = async (bill) => {
    const sysSettings = await settingsRepository.getSettings().catch(() => ({}));
    const configuredUpiId = sysSettings.upiId || 'q705457761@ybl';

    printService.printInvoice(bill, null, { name: bill.customerName, mobile: bill.customerMobile }, null, {
      upiId: configuredUpiId,
    });
  };

  // Dish modification handlers
  const handleOpenBillingModify = async (order) => {
    if (!order) return;
    const activeItems = (order.items || []).filter((i) => (i.status || 'ACTIVE') !== 'CANCELLED');
    setBillingModifiedItems(JSON.parse(JSON.stringify(activeItems)));
    setBillingModReason('');
    setBillingModError('');
    setBillingSearch('');
    setBillingActiveCategory('CATEGORIES');
    setIsBillingModifyOpen(true);

    try {
      const [prods, cats] = await Promise.all([
        productRepository.getProducts({ onlyAvailable: true }),
        categoryRepository.getCategories(false)
      ]);
      setBillingAvailableProducts(prods || []);
      setBillingCategories(cats || []);
    } catch (err) {
      console.error('Failed to load menu products/categories for billing modification:', err);
    }
  };

  const handleAddDishToBillingModified = (prod) => {
    const prodCat = billingCategories.find((c) => (c.id || c._id) === (prod.categoryId || prod.category));
    const kotRequired = prod.kotRequired !== undefined
      ? prod.kotRequired
      : (prodCat?.kotRequired !== undefined ? prodCat.kotRequired : true);

    const targetProductId = prod.id || prod._id;

    setBillingModifiedItems((prev) => {
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
            station: prod.station || 'Main Kitchen',
            notes: '',
            kotRequired
          }
        ];
      }
    });
  };

  const handleAdjustBillingModQty = (productId, delta) => {
    setBillingModifiedItems((prev) =>
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

  const handleRemoveBillingModItem = (productId) => {
    setBillingModifiedItems((prev) =>
      prev.filter((i) => i.productId !== productId && i.id !== productId && i._id !== productId)
    );
  };

  const handleSaveBillingModification = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (billingModifiedItems.length === 0) {
      setBillingModError('Order cannot have 0 dishes. Cancel order instead.');
      return;
    }

    setBillingModLoading(true);
    setBillingModError('');
    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const orderTargetId = selectedOrder.id || selectedOrder._id || selectedOrder.orderNo || selectedOrder.orderNumber;
      const cleanReason = billingModReason.trim() || 'Dishes modified at billing desk';

      await orderRepository.modifyOrderItems(
        orderTargetId,
        billingModifiedItems,
        cleanReason,
        actor
      );

      // Re-fetch fresh order
      const freshOrder = await orderRepository.getOrder(orderTargetId);
      setSelectedOrder(freshOrder);

      // Regenerate active bill with latest dishes and prices
      const freshBill = await billRepository.generateBill({
        order: freshOrder,
        discount: {
          type: discountType,
          value: Number(discountValue) || 0,
          reason: discountReason.trim() || 'Discount'
        },
        customer: selectedCustomer,
        actor
      });
      setActiveBill(freshBill);
      setPaymentAmount(freshBill.balance > 0 ? freshBill.balance.toString() : '');

      setIsBillingModifyOpen(false);
      await loadBillingData();
    } catch (err) {
      console.error('Failed to save billing modifications:', err);
      setBillingModError(err.message || 'Failed to update order dishes.');
    } finally {
      setBillingModLoading(false);
    }
  };

  // Inspect Settled Invoice Handlers
  const handleOpenInspectInvoice = async (bill) => {
    setInspectInvoiceBill(bill);
    setIsInspectLoading(true);
    try {
      const fresh = await billRepository.getBillById(bill.id);
      if (fresh) setInspectInvoiceBill(fresh);
    } catch (err) {
      console.warn('Failed to fetch detailed bill:', err);
    } finally {
      setIsInspectLoading(false);
    }
  };

  const handleOpenExtraPayment = () => {
    if (!inspectInvoiceBill) return;
    setExtraPaymentAmount(inspectInvoiceBill.balance > 0 ? inspectInvoiceBill.balance.toString() : '');
    setExtraPaymentRef('');
    setExtraPaymentError('');
    setIsExtraPaymentOpen(true);
  };

  const handleSaveExtraPayment = async (e) => {
    e.preventDefault();
    if (!inspectInvoiceBill) return;
    const amt = Number(extraPaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setExtraPaymentError('Enter a valid payment amount.');
      return;
    }

    setExtraPaymentLoading(true);
    setExtraPaymentError('');
    try {
      const actor = { id: user?.id || 'cashier', name: user?.name || 'Cashier' };
      const res = await billRepository.addPayment(
        inspectInvoiceBill.id,
        {
          mode: extraPaymentMode,
          amount: amt,
          reference: extraPaymentRef.trim()
        },
        actor
      );

      const updatedBill = res.bill || res;
      setInspectInvoiceBill(updatedBill);
      setIsExtraPaymentOpen(false);
      await loadBillingData();
    } catch (err) {
      setExtraPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setExtraPaymentLoading(false);
    }
  };

  const filteredBillingProducts = billingAvailableProducts.filter((p) => {
    const matchesSearch =
      !billingSearch.trim() ||
      p.name?.toLowerCase().includes(billingSearch.toLowerCase()) ||
      p.code?.toLowerCase().includes(billingSearch.toLowerCase()) ||
      p.station?.toLowerCase().includes(billingSearch.toLowerCase());

    const matchesCategory =
      billingActiveCategory === 'ALL' ||
      billingActiveCategory === 'CATEGORIES' ||
      p.categoryId === billingActiveCategory;

    return matchesSearch && matchesCategory;
  });

  const historyColumns = [
    {
      header: t('billing.invoiceNumber', null, 'Invoice #'),
      accessor: 'billNo',
      className: 'w-24 font-mono font-bold text-blue-700',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenInspectInvoice(row)}
          className="text-blue-600 hover:text-blue-800 font-bold hover:underline font-mono text-left cursor-pointer"
          title="Click to view invoice details, dishes & payments"
        >
          {formatReceiptSequence(row.billNo)}
        </button>
      )
    },
    {
      header: t('tables.table', null, 'Table / Source'),
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
          const typeLabel = row.orderType === 'TAKEAWAY' ? t('orders.takeaway', null, 'Take Away') : row.orderType;
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-black border ${badgeClass}`}>
              {typeLabel}
            </span>
          );
        }
        return <span className="font-extrabold text-slate-800">{row.tableNo ? `${t('orders.table', null, 'Table')} ${row.tableNo}` : t('orders.direct', null, 'Direct')}</span>;
      }
    },
    {
      header: t('billing.customerInfo', null, 'Guest / Customer'),
      accessor: 'customerName',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.customerName ? `${row.customerName} (${row.customerMobile})` : t('orders.walkinGuest', null, 'Walk-in Guest')}
        </span>
      )
    },
    {
      header: `${t('billing.finalPayable', null, 'Grand Total')} (₹)`,
      accessor: 'grandTotal',
      align: 'right',
      render: (row) => <span className="font-extrabold text-slate-900">₹{formatNumber(row.grandTotal)}</span>
    },
    {
      header: t('billing.paymentMode', null, 'Payment Modes'),
      accessor: 'payments',
      render: (row) => (
        <div className="flex flex-wrap gap-1 text-[11px]">
          {row.payments?.map((p, pIdx) => (
            <span key={pIdx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
              {p.mode}: ₹{formatNumber(p.amount)}
            </span>
          ))}
        </div>
      )
    },
    {
      header: t('orders.status', null, 'Status'),
      accessor: 'status',
      render: (row) => (
        <Badge variant={row.status === BILL_STATUS.PAID ? 'success' : 'default'} size="sm">
          {row.status}
        </Badge>
      )
    },
    {
      header: t('common.dateTime', null, 'Date & Time'),
      accessor: 'createdAt',
      className: 'whitespace-nowrap',
      render: (row) => {
        const timestamp = row.completedAt || row.createdAt;
        if (!timestamp) return <span className="text-slate-400 text-xs font-mono">—</span>;
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return <span className="text-slate-400 text-xs font-mono">—</span>;
        return (
          <div className="flex flex-col text-xs leading-tight">
            <span className="font-bold text-slate-800">
              {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        );
      }
    },
    {
      header: t('common.actions', null, 'Actions'),
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            onClick={() => handleOpenInspectInvoice(row)}
            title="Inspect Invoice Details & Payments"
          >
            {t('common.details', null, 'Details')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Tag}
            onClick={() => handleOpenDiscountModal(row)}
            title="Update Post-Settlement Discount"
          >
            {t('billing.discountAmount', null, 'Discount')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Printer}
            onClick={() => handleReprintInvoice(row)}
            title="Reprint Invoice"
          >
            {t('billing.reprint', null, 'Reprint')}
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('billing.title', null, 'Billing Desk & Payment Settlement')}
        subtitle={t('billing.subtitle', null, 'Generate final tax invoices, apply approved discounts, accept split payments (Cash, UPI, Card), and release tables')}
      >
        <Button variant="secondary" icon={RefreshCw} onClick={loadBillingData} loading={loading}>
          {t('common.refresh', null, 'Refresh Queue')}
        </Button>
      </PageHeader>

      {/* Top Section: Active Tables & Online Orders Ready for Billing */}
      <div>
        <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span>{t('billing.pendingSettlement', null, 'Orders Pending Settlement')}</span>
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center">
            {formatNumber(readyOrders.length)}
          </span>
        </h2>

        {loading ? (
          <p className="text-xs text-slate-400">{t('common.loading', null, 'Checking pending bills...')}</p>
        ) : readyOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-xs font-medium">
            {t('billing.noPendingBills', null, 'No active dining tables or takeaway orders pending bill settlement.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {readyOrders.map((ord) => (
              <div
                key={ord.id}
                onClick={() => handleOpenCheckout(ord)}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-lg hover:border-blue-400 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase text-slate-400 font-mono">
                      {formatReceiptSequence(ord.orderNo)}
                    </span>
                    <Badge variant={ord.status === ORDER_STATUS.SERVED ? 'success' : 'primary'} size="sm">
                      {ord.status}
                    </Badge>
                  </div>

                  <div className="my-3">
                    {ord.orderType && ord.orderType !== 'DINE_IN' ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                            {ord.orderType === 'TAKEAWAY' ? t('orders.takeaway', null, 'Take Away') : ord.orderType}
                          </span>
                          {ord.onlineOrderRef && (
                            <span className="text-[11px] font-mono font-bold text-slate-600">
                              #{ord.onlineOrderRef}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-slate-800 truncate">
                          {ord.customerName || t('orders.walkinGuest', null, 'Walk-in Guest')}
                        </h3>
                        {ord.customerPhone && (
                          <p className="text-xs text-slate-500 font-mono">{ord.customerPhone}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-black text-slate-800">{t('orders.table', null, 'Table')} {ord.tableNo}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{t('orders.captain', null, 'Captain')}: {ord.captainName || t('orders.captain', null, 'Staff')}</p>
                      </>
                    )}
                    <p className="text-xs text-slate-600 mt-1.5 font-semibold">
                      {formatNumber(ord.items?.length)} {t('orders.dishes', null, 'dishes')} ({formatNumber(ord.items?.reduce((a, b) => a + b.quantity, 0))} {t('orders.dishes', null, 'items')})
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">{t('billing.subtotalAmount', null, 'Subtotal')}</span>
                    <p className="text-base font-black text-slate-900">₹{formatNumber(ord.subtotal)}</p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    icon={Receipt}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCheckout(ord);
                    }}
                  >
                    {t('billing.settleBill', null, 'Settle Bill')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Section: Invoices & Receipts History */}
      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>{t('billing.settledInvoices', null, 'Settled Invoices')}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold">
                    {formatNumber(historyPagination?.total ?? billsHistory.length)}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {getDateRangeLabel(dateFilter, customFromDate, customToDate)}
                </p>
              </div>
            </div>

            {/* Quick Search */}
            <form onSubmit={handleApplySearch} className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={t('common.search', null, 'Search invoice, table, guest...')}
                className="w-full text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryPage(1);
                    loadSettledBills(1, historyLimit, dateFilter, customFromDate, customToDate, '');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>

          {/* Filter Pills / Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'TODAY', label: t('reports.today', null, 'Today') },
                { key: 'YESTERDAY', label: t('reports.yesterday', null, 'Yesterday') },
                { key: 'THIS_WEEK', label: t('reports.thisWeek', null, 'This Week') },
                { key: 'THIS_MONTH', label: t('reports.thisMonth', null, 'This Month') },
                { key: 'CUSTOM', label: t('reports.customDate', null, 'Custom Date') },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleDateFilterChange(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    dateFilter === tab.key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              loading={historyLoading}
              onClick={() => loadSettledBills(1, historyLimit)}
              className="text-slate-500 hover:text-slate-700 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              {t('common.refresh', null, 'Refresh')}
            </Button>
          </div>

          {/* Custom Date Inputs (when CUSTOM is active) */}
          {dateFilter === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-600">{t('reports.from', null, 'From')}:</span>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="text-xs p-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-600">{t('reports.to', null, 'To')}:</span>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="text-xs p-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyCustomDate}
                className="text-xs py-1 px-3 bg-blue-600 text-white font-bold"
              >
                {t('common.apply', null, 'Apply')}
              </Button>
            </div>
          )}
        </div>

        {/* Settled Invoices - Desktop / Tablet Table View */}
        <div className="hidden md:block">
          <DataTable
            columns={historyColumns}
            data={billsHistory}
            loading={historyLoading}
            emptyMessage={`${t('billing.noSettledInvoices', null, 'No historical bills settled yet for')} ${getDateRangeLabel(dateFilter, customFromDate, customToDate)}.`}
            pagination={historyPagination}
            onPageChange={(p) => {
              setHistoryPage(p);
              loadSettledBills(p, historyLimit);
            }}
            onPageSizeChange={(l) => {
              setHistoryLimit(l);
              setHistoryPage(1);
              loadSettledBills(1, l);
            }}
          />
        </div>

        {/* Settled Invoices - Mobile Grid/Card View (Optimized for Mobile Screens & Web-View App) */}
        <div className="block md:hidden">
          {historyLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
              <p className="text-sm font-medium text-slate-500">{t('common.loading', null, 'Loading settled invoices...')}</p>
            </div>
          ) : billsHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm font-medium">
              {`${t('billing.noSettledInvoices', null, 'No historical bills settled yet for')} ${getDateRangeLabel(dateFilter, customFromDate, customToDate)}.`}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {billsHistory.map((row) => {
                  const timestamp = row.completedAt || row.createdAt;
                  const dateObj = timestamp ? new Date(timestamp) : null;
                  const formattedDate =
                    dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—';
                  const formattedTime =
                    dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : '';

                  return (
                    <div
                      key={row.id}
                      className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-blue-400 hover:shadow-md"
                    >
                      <div>
                        {/* Top Header: Bill Sequence + Status */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              {formatReceiptSequence(row.billNo)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {row.billNo}
                            </span>
                          </div>

                          <Badge variant={row.status === BILL_STATUS.PAID ? 'success' : 'default'} size="sm">
                            {row.status}
                          </Badge>
                        </div>

                        {/* Table / Channel & Customer Info */}
                        <div className="my-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-slate-800">
                              {row.orderType && row.orderType !== 'DINE_IN'
                                ? row.orderType === 'TAKEAWAY'
                                  ? t('orders.takeaway', null, 'Take Away')
                                  : row.orderType
                                : row.tableNo
                                ? `${t('orders.table', null, 'Table')} ${row.tableNo}`
                                : 'Direct Bill'}
                            </span>
                            <div className="text-right text-[11px] text-slate-500 font-mono">
                              <span>{formattedDate}</span>
                              {formattedTime && <span className="ml-1 text-slate-400">{formattedTime}</span>}
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 mt-1 font-medium">
                            {row.customerName
                              ? `${row.customerName} ${row.customerMobile ? `(${row.customerMobile})` : ''}`
                              : t('orders.walkinGuest', null, 'Walk-in Guest')}
                          </p>
                        </div>

                        {/* Amount & Payments Breakdown */}
                        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 text-xs text-slate-600 mb-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              {t('billing.finalPayable', null, 'Grand Total')}
                            </span>
                            <span className="text-base font-black text-emerald-600">
                              ₹{formatNumber(row.grandTotal)}
                            </span>
                          </div>

                          {row.discountAmount > 0 && (
                            <div className="flex items-center justify-between text-[11px] text-amber-700 font-semibold">
                              <span>{t('billing.discountAmount', null, 'Discount')}</span>
                              <span>-₹{formatNumber(row.discountAmount)}</span>
                            </div>
                          )}

                          {row.payments && row.payments.length > 0 && (
                            <div className="pt-1 border-t border-slate-200/60 flex flex-wrap gap-1">
                              {row.payments.map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                                >
                                  {p.mode}: ₹{formatNumber(p.amount)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons Toolbar */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={() => handleOpenInspectInvoice(row)}
                          className="flex-1 text-xs justify-center"
                        >
                          {t('common.details', null, 'Details')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Tag}
                          onClick={() => handleOpenDiscountModal(row)}
                          className="flex-1 text-xs justify-center"
                        >
                          {t('billing.discountAmount', null, 'Discount')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Printer}
                          onClick={() => handleReprintInvoice(row)}
                          className="flex-1 text-xs justify-center"
                        >
                          {t('billing.reprint', null, 'Reprint')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile History Pagination */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <Pagination
                  currentPage={historyPagination?.page || historyPage}
                  totalPages={historyPagination?.totalPages || 1}
                  totalItems={historyPagination?.total || billsHistory.length}
                  pageSize={historyPagination?.limit || historyLimit}
                  onPageChange={(p) => {
                    setHistoryPage(p);
                    loadSettledBills(p, historyLimit);
                  }}
                  onPageSizeChange={(l) => {
                    setHistoryLimit(l);
                    setHistoryPage(1);
                    loadSettledBills(1, l);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comprehensive Checkout & Settlement Modal */}
      <Modal
        isOpen={!!selectedOrder && !!activeBill}
        onClose={handleCloseDesk}
        title={`${t('billing.title', null, 'Settle Bill')}: ${formatReceiptSequence(activeBill?.billNo)} (${activeBill?.billNo})`}
        subtitle={`${selectedOrder?.orderType && selectedOrder.orderType !== 'DINE_IN' ? (selectedOrder.orderType === 'TAKEAWAY' ? t('orders.takeaway', null, 'Take Away') : selectedOrder.orderType) : `${t('orders.table', null, 'Table')} ${selectedOrder?.tableNo}`} • ${t('orders.orderId', null, 'Order')} ${formatReceiptSequence(selectedOrder?.orderNo)}`}
        maxWidth="max-w-4xl"
      >
        {activeBill && (
          <div className="space-y-4 sm:space-y-6">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Left Column: Customer & Items Breakdown */}
              <div className="space-y-4">
                {/* Guest / Customer Picker */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      {t('billing.customerInfo', null, 'Guest Profile (Optional)')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsNewCustModalOpen(true)}
                      className="text-blue-600 hover:text-blue-700 font-bold"
                    >
                      {t('common.add', null, '+ Add New')}
                    </button>
                  </div>

                  {selectedCustomer ? (
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-800">{selectedCustomer.name}</p>
                        <p className="text-[11px] text-slate-500">{selectedCustomer.mobile}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(null)}
                        className="text-red-500 font-bold"
                      >
                        {t('common.delete', null, 'Remove')}
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder={t('billing.searchGuestPlaceholder', null, 'Search guest by mobile or name...')}
                        value={customerQuery}
                        onChange={(e) => handleSearchCustomer(e.target.value)}
                      />
                      {customerResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-32 overflow-y-auto">
                          {customerResults.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => handleSelectCustomer(c)}
                              className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-none flex justify-between"
                            >
                              <span className="font-bold">{c.name}</span>
                              <span className="text-slate-400 font-mono">{c.mobile}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Items Snapshot with Modify Dishes Button */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase text-slate-400">{t('kitchen.orderedDishes', null, 'Ordered Dishes')}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {activeBill.items.length} {activeBill.items.length === 1 ? 'Dish' : 'Dishes'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenBillingModify(selectedOrder)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 shadow-2xs hover:bg-blue-50 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {t('billing.modifyDishes', null, 'Modify Dishes')}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs max-h-60 overflow-y-auto">
                    {activeBill.items.map((i, idx) => (
                      <div key={idx} className="p-2.5 bg-white flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800">{i.name || i.productName}</span>
                          <span className="text-slate-400 ml-1.5 font-mono">
                            {formatNumber(i.quantity)}x @ ₹{formatNumber(i.unitPrice)}
                          </span>
                        </div>
                        <span className="font-extrabold text-slate-900">₹{formatNumber(Number(i.quantity * i.unitPrice).toFixed(2))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discount Section (Optional Reason) */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-blue-600" /> {t('billing.applyDiscount', null, 'Apply Discount (Optional)')}
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyDiscount}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200"
                    >
                      {t('billing.updateTotal', null, 'Update Total')}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      options={[
                        { value: DISCOUNT_TYPES.FIXED, label: `${t('common.fixed', null, 'Fixed Amount')} (₹)` },
                        { value: DISCOUNT_TYPES.PERCENTAGE, label: `${t('common.percentage', null, 'Percentage')} (%)` }
                      ]}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder={t('billing.discountAmount', null, 'Discount value')}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                    />
                  </div>

                  <Input
                    placeholder={t('billing.discountReason', null, 'Reason for discount (Optional)...')}
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Right Column: Financial Calculation & Split Payment Collector */}
              <div className="space-y-4">
                {/* Financial Summary Card */}
                <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 shadow-sm text-xs space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>{t('billing.subtotalAmount', null, 'Subtotal:')}</span>
                    <span className="font-mono text-white">₹{formatNumber(activeBill.subtotal?.toFixed(2))}</span>
                  </div>

                  {activeBill.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>{t('billing.discountAmount', null, 'Discount')} ({activeBill.discountReason || 'Discount'}):</span>
                      <span className="font-mono">-₹{formatNumber(activeBill.discountAmount?.toFixed(2))}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-400">
                    <span>{t('billing.taxableAmount', null, 'Taxable Base:')}</span>
                    <span className="font-mono text-white">₹{formatNumber(activeBill.taxableValue?.toFixed(2))}</span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>{t('billing.totalTax', null, 'CGST (2.5%) + SGST (2.5%):')}</span>
                    <span className="font-mono text-white">₹{formatNumber(activeBill.taxAmount?.toFixed(2))}</span>
                  </div>

                  {activeBill.rounding !== 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>{t('billing.roundOff', null, 'Rounding:')}</span>
                      <span className="font-mono text-white">₹{formatNumber(activeBill.rounding?.toFixed(2))}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-700 flex justify-between items-center text-sm">
                    <span className="font-bold text-white">{t('billing.finalPayable', null, 'Grand Total:')}</span>
                    <span className="text-xl font-black text-amber-400">₹{formatNumber(activeBill.grandTotal)}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400">{t('billing.amountPaid', null, 'Paid Amount:')}</span>
                    <span className="font-mono font-bold text-emerald-400">₹{formatNumber(activeBill.paidAmount?.toFixed(2))}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-slate-300">{t('billing.balanceRemaining', null, 'Balance Due:')}</span>
                    <span className={`font-mono text-base ${activeBill.balance > 0 ? 'text-red-400 font-extrabold' : 'text-emerald-400'}`}>
                      ₹{formatNumber(activeBill.balance?.toFixed(2))}
                    </span>
                  </div>
                </div>

                {/* Recorded Payments List */}
                {activeBill.payments && activeBill.payments.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block mb-2">
                      {t('billing.recordedPayments', null, 'Recorded Payments')} ({formatNumber(activeBill.payments.length)})
                    </span>
                    <div className="space-y-1.5">
                      {activeBill.payments.map((p, pIdx) => (
                        <div key={pIdx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-800">{p.mode}</span>
                            {p.reference && <span className="text-slate-400 text-[10px] ml-1.5 font-mono">Ref: {p.reference}</span>}
                          </div>
                          <span className="font-mono font-extrabold text-emerald-600">₹{formatNumber(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collect Payment Form (if balance remains) */}
                {activeBill.balance > 0 ? (
                  <form onSubmit={handleAddPayment} className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-200 space-y-3">
                    <span className="font-bold text-blue-900 uppercase tracking-wider text-[11px] block">
                      {t('billing.recordPayment', null, 'Collect Payment Entry')}
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label={t('billing.paymentMode', null, 'Payment Mode')}
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        options={[
                          { value: PAYMENT_MODES.UPI, label: 'UPI / QR Code' },
                          { value: PAYMENT_MODES.CASH, label: t('billing.cash', null, 'Cash') },
                          { value: PAYMENT_MODES.CARD, label: t('billing.card', null, 'Card') },
                          { value: PAYMENT_MODES.OTHER, label: t('billing.other', null, 'Other') },
                        ]}
                      />
                      <Input
                        label={`${t('billing.enterPaidAmount', null, 'Amount to Pay')} (₹)`}
                        type="number"
                        step="any"
                        min="0"
                        max={activeBill.balance}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder={`${t('billing.balanceRemaining', null, 'Balance')}: ₹${formatNumber(activeBill.balance)}`}
                        required
                      />
                    </div>

                    <Input
                      label={t('billing.txRefOptional', null, 'Transaction Ref / Auth Code (Optional)')}
                      placeholder="e.g. UPI Ref / Card Last 4 digits"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      loading={actionLoading}
                    >
                      {t('billing.recordPayment', null, 'Record')} ₹{formatNumber(paymentAmount || activeBill.balance)} {t('common.via', null, 'via')} {paymentMode}
                    </Button>
                  </form>
                ) : (
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="font-bold text-sm text-emerald-900">{t('billing.billCompleted', null, 'Bill is Fully Settled!')}</p>
                    <p className="text-xs text-emerald-700">{t('billing.settledDesc', null, 'All balances cleared. You can now print the bill and close.')}</p>
                  </div>
                )}

                {/* Finalize & Print Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
                  {((activeBill.balance !== undefined && activeBill.balance <= 0) || activeBill.isSettled || activeBill.rawStatus === 'COMPLETED' || activeBill.status === 'PAID') ? (
                    <>
                      <Button
                        variant="primary"
                        className="flex-1 w-full bg-emerald-600 hover:bg-emerald-700 font-bold"
                        icon={Printer}
                        onClick={handlePrintInvoice}
                      >
                        {t('billing.printOnly', null, 'Print Bill')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto px-6 font-semibold"
                        onClick={handleCloseDesk}
                      >
                        {t('common.close', null, 'Close')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        className="flex-1 w-full bg-emerald-600 hover:bg-emerald-700 font-bold"
                        icon={Printer}
                        loading={actionLoading}
                        onClick={handleSettleAndPrint}
                      >
                        Settle & Print Tax Invoice
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto"
                        icon={Printer}
                        onClick={handlePrintInvoice}
                      >
                        {t('billing.printOnly', null, 'Print Bill')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={handleCloseDesk}
                      >
                        {t('common.close', null, 'Close')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Dish Modification Modal from Billing */}
      {isBillingModifyOpen && selectedOrder && (
        <Modal
          isOpen={isBillingModifyOpen}
          onClose={() => setIsBillingModifyOpen(false)}
          title={`${t('billing.modifyDishes', null, 'Modify Order Dishes')}: ${selectedOrder.orderNo}`}
          subtitle="Adjust quantities, add extra dishes, or remove items. Price and pending settlement will update automatically."
          maxWidth="max-w-4xl"
        >
          <form onSubmit={handleSaveBillingModification} className="space-y-4">
            {billingModError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{billingModError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Column: Current Items in Order (5 of 12 cols) */}
              <div className="lg:col-span-5 border border-slate-200 rounded-2xl p-3.5 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-black uppercase text-slate-700">{t('kitchen.orderedDishes', null, 'Order Dishes')}</span>
                  <span className="text-xs font-extrabold text-blue-700">
                    ₹{formatNumber(billingModifiedItems.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0))}
                  </span>
                </div>

                <div className="divide-y divide-slate-200 text-xs max-h-64 overflow-y-auto pr-1">
                  {billingModifiedItems.map((itm) => (
                    <div key={itm.productId || itm.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{itm.name || itm.productName}</p>
                        <p className="text-[11px] text-slate-400">
                          ₹{formatNumber(itm.unitPrice)} each • <span className="font-bold text-slate-600">₹{formatNumber(itm.quantity * itm.unitPrice)}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdjustBillingModQty(itm.productId || itm.id, -1)}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-black text-slate-900">{formatNumber(itm.quantity)}</span>
                        <button
                          type="button"
                          onClick={() => handleAdjustBillingModQty(itm.productId || itm.id, 1)}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBillingModItem(itm.productId || itm.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Remove dish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Quick Add Dish (7 of 12 cols) */}
              <div className="lg:col-span-7 border border-slate-200 rounded-2xl p-3.5 bg-white space-y-3">
                <div className="relative">
                  <Input
                    icon={Search}
                    placeholder={t('menu.searchDishes', null, 'Search dishes to add to this order...')}
                    value={billingSearch}
                    onChange={(e) => setBillingSearch(e.target.value)}
                  />
                  {billingSearch && (
                    <button
                      type="button"
                      onClick={() => setBillingSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100"
                    >
                      {t('common.clear', null, 'Clear')}
                    </button>
                  )}
                </div>

                {/* Categories Pills (Wrapped & Scrollable) */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs max-h-36 sm:max-h-40 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setBillingActiveCategory('ALL')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                      billingActiveCategory === 'ALL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t('common.all', null, 'All Dishes')}
                  </button>
                  {billingCategories.map((c) => (
                    <button
                      key={c.id || c._id}
                      type="button"
                      onClick={() => setBillingActiveCategory(c.id || c._id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                        billingActiveCategory === (c.id || c._id)
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* Dishes list */}
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl max-h-56 overflow-y-auto p-1 text-xs">
                  {filteredBillingProducts.map((p) => (
                    <div key={p.id || p._id} className="p-2 flex items-center justify-between hover:bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <p className="text-[11px] text-slate-400">₹{formatNumber(p.price)} • {p.station || 'Main'}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        icon={Plus}
                        onClick={() => handleAddDishToBillingModified(p)}
                      >
                        {t('common.add', null, 'Add')}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Input
                label={t('billing.modReasonOptional', null, 'Reason for Modification (Optional)')}
                placeholder="e.g. Added extra portion at checkout..."
                value={billingModReason}
                onChange={(e) => setBillingModReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
              <Button variant="secondary" onClick={() => setIsBillingModifyOpen(false)}>
                {t('common.cancel', null, 'Cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={billingModLoading}>
                {t('billing.saveDishesUpdate', null, 'Save Dishes & Update Bill Total')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Inspect Settled Invoice Details Modal */}
      {inspectInvoiceBill && (
        <Modal
          isOpen={Boolean(inspectInvoiceBill)}
          onClose={() => setInspectInvoiceBill(null)}
          title={`${t('billing.settledInvoices', null, 'Settled Invoice')}: ${formatReceiptSequence(inspectInvoiceBill.billNo)}`}
          subtitle={`${inspectInvoiceBill.tableNo ? `${t('orders.table', null, 'Table')} ${inspectInvoiceBill.tableNo}` : t('orders.direct', null, 'Direct Order')} • ${t('orders.orderId', null, 'Order')} ${formatReceiptSequence(inspectInvoiceBill.orderNo || inspectInvoiceBill.orderNumber)} • ${new Date(inspectInvoiceBill.createdAt).toLocaleString()}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-5">
            {/* Top Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('orders.status', null, 'Status')}</span>
                <span className="font-extrabold text-emerald-700 text-sm mt-0.5 block">{inspectInvoiceBill.status}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('users.role', null, 'Cashier / Staff')}</span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{inspectInvoiceBill.generatedByName || inspectInvoiceBill.generatedBy || 'Staff'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('billing.customerInfo', null, 'Guest')}</span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                  {inspectInvoiceBill.customerName || t('orders.walkinGuest', null, 'Walk-in Guest')}
                </span>
                {inspectInvoiceBill.customerMobile && (
                  <span className="text-[11px] text-slate-400 font-mono">{inspectInvoiceBill.customerMobile}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('billing.finalPayable', null, 'Grand Total')}</span>
                <span className="font-black text-blue-700 text-base mt-0.5 block">
                  ₹{formatNumber(Number(inspectInvoiceBill.grandTotal || 0))}
                </span>
              </div>
            </div>

            {/* Ordered Dishes Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t('kitchen.orderedDishes', null, 'Ordered Dishes & Quantities')} ({formatNumber(inspectInvoiceBill.items?.length || 0)})
                </h4>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">{t('menu.productName', null, 'Item / Dish')}</th>
                      <th className="py-2.5 px-3 text-center">{t('common.qty', null, 'Qty')}</th>
                      <th className="py-2.5 px-3 text-right">{t('menu.price', null, 'Unit Price')}</th>
                      <th className="py-2.5 px-3 text-right">{t('common.total', null, 'Total Amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(inspectInvoiceBill.items || []).map((itm, iIdx) => (
                      <tr key={iIdx} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-bold text-slate-800">{itm.name || itm.productName}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-blue-700">{formatNumber(itm.quantity)}x</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">₹{formatNumber(itm.unitPrice)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{formatNumber(Number(itm.quantity * itm.unitPrice).toFixed(2))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financials & Recorded Payments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Financial Breakdown */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block mb-1">
                  {t('billing.billDetail', null, 'Financial Breakdown')}
                </span>
                <div className="flex justify-between text-slate-600">
                  <span>{t('billing.subtotalAmount', null, 'Subtotal:')}</span>
                  <span className="font-mono font-bold">₹{formatNumber(inspectInvoiceBill.subtotal)}</span>
                </div>
                {inspectInvoiceBill.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>{t('billing.discountAmount', null, 'Discount')} ({inspectInvoiceBill.discountReason || 'Discount'}):</span>
                    <span className="font-mono">-₹{formatNumber(inspectInvoiceBill.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>{t('billing.taxableAmount', null, 'Taxable Base:')}</span>
                  <span className="font-mono">₹{formatNumber(inspectInvoiceBill.taxableValue || inspectInvoiceBill.taxableAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{t('billing.totalTax', null, 'CGST + SGST:')}</span>
                  <span className="font-mono">₹{formatNumber(inspectInvoiceBill.taxAmount || inspectInvoiceBill.tax)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                  <span>{t('billing.finalPayable', null, 'Grand Total:')}</span>
                  <span className="text-blue-700">₹{formatNumber(inspectInvoiceBill.grandTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-emerald-700">
                  <span>{t('billing.amountPaid', null, 'Total Paid:')}</span>
                  <span className="font-mono">₹{formatNumber(inspectInvoiceBill.paidAmount)}</span>
                </div>
                {Number(inspectInvoiceBill.balance) > 0 && (
                  <div className="flex justify-between items-center text-xs font-bold text-red-600">
                    <span>{t('billing.balanceRemaining', null, 'Balance Due:')}</span>
                    <span className="font-mono">₹{formatNumber(inspectInvoiceBill.balance)}</span>
                  </div>
                )}
              </div>

              {/* Recorded Payment Entries */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {t('billing.recordedPayments', null, 'Recorded Payments')} ({formatNumber(inspectInvoiceBill.payments?.length || 0)})
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenExtraPayment}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs"
                  >
                    {t('billing.addSplitPayment', null, '+ Add Payment')}
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(inspectInvoiceBill.payments || []).map((p, pIdx) => (
                    <div key={pIdx} className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800">{p.mode}</span>
                        {p.reference && <span className="text-[10px] text-slate-400 font-mono ml-1.5">Ref: {p.reference}</span>}
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(p.collectedAt || inspectInvoiceBill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className="font-mono font-black text-emerald-700 text-sm">₹{formatNumber(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 pos-modal-actions">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Printer}
                  onClick={() => handleReprintInvoice(inspectInvoiceBill)}
                >
                  {t('billing.reprint', null, 'Reprint Tax Invoice')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Tag}
                  onClick={() => handleOpenDiscountModal(inspectInvoiceBill)}
                >
                  {t('billing.discountAmount', null, 'Adjust Discount')}
                </Button>
              </div>

              <Button variant="secondary" size="sm" onClick={() => setInspectInvoiceBill(null)}>
                {t('common.close', null, 'Close')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Update Payment Sub-Modal */}
      {isExtraPaymentOpen && inspectInvoiceBill && (
        <Modal
          isOpen={isExtraPaymentOpen}
          onClose={() => setIsExtraPaymentOpen(false)}
          title={`Record Payment for ${inspectInvoiceBill.billNo}`}
          subtitle="Add split payment entry or settle outstanding balance"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveExtraPayment} className="space-y-4">
            {extraPaymentError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{extraPaymentError}</span>
              </div>
            )}

            <Select
              label={t('billing.paymentMode', null, 'Payment Mode')}
              value={extraPaymentMode}
              onChange={(e) => setExtraPaymentMode(e.target.value)}
              options={[
                { value: PAYMENT_MODES.CASH, label: t('billing.cash', null, 'Cash') },
                { value: PAYMENT_MODES.UPI, label: 'UPI / QR Code' },
                { value: PAYMENT_MODES.CARD, label: t('billing.card', null, 'Card') },
                { value: PAYMENT_MODES.OTHER, label: t('billing.other', null, 'Other') },
              ]}
            />

            <Input
              label={`${t('billing.enterPaidAmount', null, 'Payment Amount')} (₹)`}
              type="number"
              step="any"
              min="0"
              value={extraPaymentAmount}
              onChange={(e) => setExtraPaymentAmount(e.target.value)}
              placeholder="e.g. 500"
              required
            />

            <Input
              label={t('billing.txRefOptional', null, 'Transaction / Reference Code (Optional)')}
              value={extraPaymentRef}
              onChange={(e) => setExtraPaymentRef(e.target.value)}
              placeholder="e.g. UPI Ref / Receipt No"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
              <Button variant="secondary" onClick={() => setIsExtraPaymentOpen(false)}>
                {t('common.cancel', null, 'Cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={extraPaymentLoading}>
                {t('billing.recordPayment', null, 'Save Payment Entry')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add New Customer Quick Modal */}
      <Modal
        isOpen={isNewCustModalOpen}
        onClose={() => setIsNewCustModalOpen(false)}
        title={t('customers.addCustomer', null, 'Register Guest Profile')}
        subtitle="Quick save guest contact for tax invoice and visit CRM"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-3">
          <Input
            label={t('customers.customerName', null, 'Guest Full Name')}
            value={newCustName}
            onChange={(e) => setNewCustName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            required
          />
          <Input
            label={t('customers.mobileNumber', null, 'Mobile Number')}
            value={newCustPhone}
            onChange={(e) => setNewCustPhone(e.target.value)}
            placeholder="e.g. 9876543210"
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 pos-modal-actions">
            <Button variant="secondary" onClick={() => setIsNewCustModalOpen(false)}>
              {t('common.cancel', null, 'Cancel')}
            </Button>
            <Button type="submit" variant="primary">
              {t('common.save', null, 'Save Guest')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Post-Settlement Discount Modal */}
      <Modal
        isOpen={Boolean(discountModalBill)}
        onClose={() => setDiscountModalBill(null)}
        title={`${t('billing.discountAmount', null, 'Adjust Discount')}: ${discountModalBill?.billNo}`}
        subtitle="Apply or modify manager-approved discount after invoice settlement"
      >
        {discountModalBill && (
          <form onSubmit={handleApplyPostSettlementDiscount} className="space-y-4">
            {discountModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{discountModalError}</span>
              </div>
            )}

            {discountModalSuccess ? (
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold text-sm">{t('billing.discountUpdatedSuccess', null, 'Discount Updated Successfully!')}</p>
                <p className="text-xs text-emerald-700">
                  {t('billing.finalPayable', null, 'New Grand Total')}: <span className="font-mono font-bold text-slate-900">₹{formatNumber(updatedSettledBill?.grandTotal)}</span>
                  {updatedSettledBill?.discountAmount > 0 && ` (${t('billing.discountAmount', null, 'Discount')}: ₹${formatNumber(updatedSettledBill?.discountAmount)})`}
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    variant="primary"
                    icon={Printer}
                    onClick={() => {
                      printService.printInvoice(updatedSettledBill, null, {
                        name: updatedSettledBill.customerName,
                        mobile: updatedSettledBill.customerMobile
                      });
                    }}
                  >
                    {t('billing.reprint', null, 'Print Updated Tax Invoice')}
                  </Button>
                  <Button variant="secondary" onClick={() => setDiscountModalBill(null)}>
                    {t('common.done', null, 'Done')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('billing.subtotalAmount', null, 'Bill Subtotal:')}</span>
                    <span className="font-mono font-bold text-slate-800">₹{formatNumber(discountModalBill.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('billing.finalPayable', null, 'Current Grand Total:')}</span>
                    <span className="font-mono font-bold text-slate-800">₹{formatNumber(discountModalBill.grandTotal)}</span>
                  </div>
                  {discountModalBill.discountAmount > 0 && (
                    <div className="flex justify-between text-amber-700 font-medium">
                      <span>{t('billing.discountAmount', null, 'Existing Discount')}:</span>
                      <span>-₹{formatNumber(discountModalBill.discountAmount)} ({discountModalBill.discountReason})</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label={t('billing.discountType', null, 'Discount Type')}
                    value={modalDiscType}
                    onChange={(e) => setModalDiscType(e.target.value)}
                    options={[
                      { value: DISCOUNT_TYPES.PERCENTAGE, label: `${t('common.percentage', null, 'Percentage')} (%)` },
                      { value: DISCOUNT_TYPES.FIXED, label: `${t('common.fixed', null, 'Fixed Amount')} (₹)` }
                    ]}
                  />
                  <Input
                    label={t('billing.discountValue', null, 'Discount Value')}
                    type="number"
                    min="0"
                    step="any"
                    value={modalDiscValue}
                    onChange={(e) => setModalDiscValue(e.target.value)}
                    placeholder={modalDiscType === DISCOUNT_TYPES.PERCENTAGE ? 'e.g. 10' : 'e.g. 100'}
                    required
                  />
                </div>

                <Input
                  label={t('billing.discountReason', null, 'Discount Reason (Optional)')}
                  value={modalDiscReason}
                  onChange={(e) => setModalDiscReason(e.target.value)}
                  placeholder="e.g. Manager courtesy, loyalty discount"
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button variant="secondary" onClick={() => setDiscountModalBill(null)}>
                    {t('common.cancel', null, 'Cancel')}
                  </Button>
                  <Button type="submit" variant="primary" loading={discountModalLoading}>
                    {t('billing.applyUpdateInvoice', null, 'Apply & Update Invoice')}
                  </Button>
                </div>
              </>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
};
