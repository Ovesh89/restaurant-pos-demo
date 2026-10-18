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
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { tableRepository } from '../../services/repositories/tableRepository';
import { productRepository } from '../../services/repositories/productRepository';
import { categoryRepository } from '../../services/repositories/categoryRepository';
import { orderRepository } from '../../services/repositories/orderRepository';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';

export const CreateOrderPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTableId = searchParams.get('tableId');

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

  // Cart
  const [cart, setCart] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');

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

      if (preselectedTableId) {
        const match = tList.find((t) => t.id === preselectedTableId);
        if (match) setSelectedTable(match);
      } else if (tList.length > 0) {
        setSelectedTable(tList[0]);
      }
    } catch (err) {
      console.error('Failed to load order entry data:', err);
      setLoadError(err.message || 'Failed to load menu products. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, [preselectedTableId]);

  // Cart Item Management
  const handleAddToCart = (product) => {
    const cat = categories.find((c) => c.id === product.categoryId);
    const kotRequired = cat ? cat.kotRequired !== false : (product.kotRequired !== false);

    setCart((prev) => {
      const existsIndex = prev.findIndex((item) => item.productId === product.id);
      if (existsIndex > -1) {
        const updated = [...prev];
        updated[existsIndex].quantity += 1;
        return updated;
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
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleOpenNoteModal = (item) => {
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

      await orderRepository.createOrder({
        table: isTableOrder ? selectedTable : null,
        tableNo: resolvedTableNo,
        captain,
        items: cart,
        notes: orderNotes,
        isDraft,
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        onlineOrderRef: onlineOrderRef.trim(),
      });

      // Navigate to orders list or reception
      navigate('/orders');
    } catch (err) {
      setActionError(err.message || 'Failed to submit order.');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="min-h-[calc(100vh-9.5rem)] lg:h-[calc(100vh-8.5rem)] flex flex-col">
      {/* Top Header / Table & Order Type Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 mb-3 sm:mb-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/orders')}>
              Back
            </Button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Order Type Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOrderType('DINE_IN')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderType === 'DINE_IN'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dine-In
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
                Take Away
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
              Off-Menu Item
            </Button>
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Captain</span>
              <p className="text-xs font-bold text-slate-800">{user?.name}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Context Fields based on Order Type */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
          {orderType === 'DINE_IN' ? (
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-500">Select Table:</span>
              <select
                value={selectedTable?.id || ''}
                onChange={(e) => {
                  const t = tables.find((tbl) => tbl.id === e.target.value);
                  setSelectedTable(t);
                }}
                className="text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.tableNo} ({t.capacity} Pax) - {t.status}
                  </option>
                ))}
              </select>
            </div>
          ) : orderType === 'TAKEAWAY' ? (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-emerald-700">Take Away Parcel:</span>
              <input
                type="text"
                placeholder="Guest Full Name (e.g. Ramesh Patel)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500 w-52"
              />
              <input
                type="text"
                placeholder="Mobile # (Optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-emerald-500 w-36"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <UtensilsCrossed className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-purple-700">{orderType} Order:</span>
              <input
                type="text"
                placeholder="Online Order Ref # (e.g. ZOM-8921)"
                value={onlineOrderRef}
                onChange={(e) => setOnlineOrderRef(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-500 w-44"
              />
              <input
                type="text"
                placeholder="Customer Name (Optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-500 w-48"
              />
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-3 sm:mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
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
          Menu Catalog ({filteredProducts.length})
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
          <span>Order Ticket</span>
          {totalCartItems > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {totalCartItems}
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
                placeholder="Search dishes by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter Pills (Wrapped for complete visibility across all categories) */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs max-h-48 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setActiveCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                  activeCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Menu ({products.length})
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
              <p className="text-center py-12 text-slate-400 text-sm">Loading available menu...</p>
            ) : loadError ? (
              <div className="text-center py-12 text-red-500 text-sm space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto text-red-400 mb-1" />
                <p className="font-semibold">{loadError}</p>
                <Button variant="secondary" size="sm" onClick={() => initData()}>
                  Retry
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm space-y-1">
                <p className="font-medium">No dishes available on the menu.</p>
                <p className="text-xs text-slate-400">Please verify menu products configuration.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                <p>No dishes match your filter.</p>
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
                        <span className="text-sm font-extrabold text-slate-900">₹{p.price}</span>
                        {inCart ? (
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            {inCart.quantity}
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
          } lg:flex lg:w-1/3 flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-0 flex-1`}
        >
          {/* Cart Header */}
          <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-800">Order Items</h3>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
              {totalCartItems} Items
            </span>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold">No dishes added yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click any item from the menu to add</p>
                <button
                  type="button"
                  onClick={() => setMobileTab('menu')}
                  className="mt-3 lg:hidden inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl"
                >
                  Browse Menu Catalog
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-bold text-slate-800 text-sm block leading-tight">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">₹{item.price} each</span>
                    </div>

                    <span className="font-extrabold text-slate-900 text-sm">
                      ₹{item.quantity * item.price}
                    </span>
                  </div>

                  {/* Note preview if any */}
                  {item.notes && (
                    <p className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded mt-1.5 italic">
                      * {item.notes}
                    </p>
                  )}

                  {/* Quantity and Note Actions */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleOpenNoteModal(item)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      {item.notes ? 'Edit Note' : 'Add Note'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productId, -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100 active:bg-slate-200"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="font-bold text-slate-800 text-xs px-1 min-w-[16px] text-center">{item.quantity}</span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productId, 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100 active:bg-slate-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.productId)}
                        className="text-slate-400 hover:text-red-600 ml-1 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Summary & Actions */}
          <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 space-y-3">
            <div>
              <Input
                placeholder="Special instruction for entire order..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600">Subtotal</span>
              <span className="text-lg font-black text-slate-900">₹{subtotal.toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="secondary"
                disabled={cart.length === 0 || submitting}
                onClick={() => handleProcessOrder(true)}
              >
                Hold Order
              </Button>
              <Button
                variant="primary"
                disabled={cart.length === 0 || submitting}
                loading={submitting}
                onClick={() => handleProcessOrder(false)}
              >
                Submit Order
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Order Summary Bar for Mobile (When browsing menu) */}
      {mobileTab === 'menu' && totalCartItems > 0 && (
        <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30 bg-blue-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-xs">
              {totalCartItems}
            </div>
            <div>
              <span className="text-xs font-bold block leading-tight">{totalCartItems} Dishes in Ticket</span>
              <span className="text-sm font-black">₹{subtotal.toLocaleString()}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="px-3.5 py-1.5 bg-white text-blue-700 font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition-transform"
          >
            <span>Review Ticket</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Item Note Modal */}
      <Modal
        isOpen={!!editingItemNote}
        onClose={() => setEditingItemNote(null)}
        title="Kitchen Instruction"
        subtitle={`Special notes for "${editingItemNote?.name}"`}
      >
        <div className="space-y-4">
          <Input
            label="Dish Preparation Note"
            placeholder="e.g. Less spicy, no onion/garlic, well-done..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditingItemNote(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItemNote}>Save Note</Button>
          </div>
        </div>
      </Modal>

      {/* Off-Menu Custom Item Modal */}
      <Modal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        title="Add Off-Menu Dish"
        subtitle="Special request dish not listed in regular menu"
      >
        <form onSubmit={handleAddCustomItem} className="space-y-4">
          <Input
            label="Dish Name"
            placeholder="e.g. Chef Special Halwa"
            value={customItem.name}
            onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price (₹)"
              type="number"
              min="0"
              placeholder="e.g. 250"
              value={customItem.price}
              onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
              required
            />
            <Input
              label="Quantity"
              type="number"
              min="1"
              value={customItem.quantity}
              onChange={(e) => setCustomItem({ ...customItem, quantity: e.target.value })}
              required
            />
          </div>

          <Input
            label="Cooking Notes"
            placeholder="e.g. Made in pure desi ghee"
            value={customItem.notes}
            onChange={(e) => setCustomItem({ ...customItem, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsCustomModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add to Order</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
