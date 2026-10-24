import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Percent,
  Printer,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Layers,
  Flame,
  Upload,
  Image as ImageIcon,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import { settingsRepository, DEFAULT_SETTINGS } from '../../services/repositories/settingsRepository';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../context/RestaurantContext.jsx';
import { generateLogoVariants, DEFAULT_LOGOS } from '../../utils/logoProcessor.js';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { DiningAreaManager } from '../../components/restaurant/DiningAreaManager.jsx';
import { KitchenStationManager } from '../../components/restaurant/KitchenStationManager.jsx';
import { useTranslation } from '../../hooks/useTranslation';

export const SettingsPage = () => {
  const { user } = useAuth();
  const { reloadSettings } = useRestaurant();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('PROFILE'); // PROFILE, AREAS, STATIONS, TAXES, PRINTING
  const [formData, setFormData] = useState({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsRepository.getSettings();
      setFormData(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setErrorMsg('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    try {
      setLogoUploading(true);
      setLogoUploadError('');
      const variants = await generateLogoVariants(file);
      setFormData((prev) => ({
        ...prev,
        logo: variants.logo,
        logoWhite: variants.logoWhite,
        logoBlack: variants.logoBlack,
        logoReceipt: variants.logoReceipt,
        logoRedReceipt: variants.logoRedReceipt,
        favicon: variants.favicon,
      }));
      setSuccessMsg('Logo uploaded and converted into Color, White, Black, Receipt & Favicon formats!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Logo upload error:', err);
      setLogoUploadError('Failed to process image: ' + err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleResetLogo = () => {
    setFormData((prev) => ({
      ...prev,
      logo: DEFAULT_LOGOS.logo,
      logoWhite: DEFAULT_LOGOS.logoWhite,
      logoBlack: DEFAULT_LOGOS.logoBlack,
      logoReceipt: DEFAULT_LOGOS.logoReceipt,
      logoRedReceipt: DEFAULT_LOGOS.logoRedReceipt,
      favicon: DEFAULT_LOGOS.favicon,
    }));
    setSuccessMsg('Logo reset to default.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      const updated = await settingsRepository.updateSettings(formData, actor);
      if (updated.upiId) {
        localStorage.setItem('gts_pos_upi_id', updated.upiId);
      }
      setFormData(updated);
      await reloadSettings();
      setSuccessMsg('Settings and restaurant branding saved successfully and applied everywhere!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err.message || 'Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all parameters to factory default configuration?')) return;
    try {
      setSaving(true);
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      const def = await settingsRepository.resetToDefaults(actor);
      setFormData(def);
      await reloadSettings();
      setSuccessMsg('Settings restored to factory defaults.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Error resetting settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings.title', 'System & Restaurant Settings')}
        subtitle={t('settings.subtitle', 'Configure branch information, GST tax rules, invoice/KOT prefixes, and thermal receipt formats')}
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={RotateCcw} onClick={handleReset} disabled={saving}>
            {t('settings.resetDefaults', 'Reset Defaults')}
          </Button>
          <Button variant="primary" icon={Save} onClick={handleSave} loading={saving}>
            {t('common.save', 'Save Changes')}
          </Button>
        </div>
      </PageHeader>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'PROFILE'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          {t('settings.restaurantDetails', 'Restaurant Profile')}
        </button>

        <button
          onClick={() => setActiveTab('AREAS')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'AREAS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          {t('tables.manageAreas', 'Assigned Dining Areas')}
        </button>

        <button
          onClick={() => setActiveTab('STATIONS')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'STATIONS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Flame className="w-4 h-4" />
          {t('kitchen.allStations', 'Kitchen Stations')}
        </button>

        <button
          onClick={() => setActiveTab('TAXES')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'TAXES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Percent className="w-4 h-4" />
          {t('settings.defaultTaxRate', 'Taxes & UPI QR')}
        </button>

        <button
          onClick={() => setActiveTab('PRINTING')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'PRINTING'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Printer className="w-4 h-4" />
          {t('settings.invoicePrefix', 'Thermal Printing & Prefixes')}
        </button>

        <button
          onClick={() => setActiveTab('WORKFLOW')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'WORKFLOW'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          {t('settings.orderWorkflow', 'Order Approvals & Workflow')}
        </button>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 md:p-8 shadow-sm">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">{t('common.loading', 'Loading settings...')}</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {activeTab === 'PROFILE' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
                    <span>{t('settings.restaurantBranding', 'Restaurant Logo & Branding Formats')}</span>
                    <span className="text-xs font-normal text-slate-500">Applies across Login, Sidebar, Topbar, Dashboard, KOT &amp; Bill receipts</span>
                  </h3>

                  {/* Master Logo Upload Box & Previews */}
                  <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-blue-600" />
                          <span>Single Logo Auto-Converter</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Upload your master restaurant logo once. It will automatically convert to the proper size and color format for every place in the app (Color, White, Black, Thermal Receipt, and Favicon).
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="relative inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{logoUploading ? 'Converting...' : 'Upload Master Logo'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="sr-only"
                            onChange={handleLogoUpload}
                            disabled={logoUploading || saving}
                          />
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={RotateCcw}
                          onClick={handleResetLogo}
                          disabled={logoUploading || saving}
                          title="Restore default logo"
                        >
                          Reset Logo
                        </Button>
                      </div>
                    </div>

                    {logoUploadError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{logoUploadError}</span>
                      </div>
                    )}

                    {/* Logo Format Previews */}
                    <div className="pt-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Generated Logo Formats (Live Previews)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {/* 1. Standard Color */}
                        <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col items-center text-center shadow-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase mb-2">1. Main Color</span>
                          <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-100 p-1 flex items-center justify-center overflow-hidden">
                            <img src={formData.logo || DEFAULT_LOGOS.logo} alt="Color Logo" className="max-w-full max-h-full object-contain" />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-2 truncate w-full">Login &amp; Topbar</span>
                        </div>

                        {/* 2. White Logo on Dark Background */}
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center text-center shadow-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">2. White Mode</span>
                          <div className="w-16 h-16 rounded-lg bg-slate-800/80 border border-slate-700 p-1 flex items-center justify-center overflow-hidden">
                            <img src={formData.logoWhite || formData.logo || DEFAULT_LOGOS.logoWhite} alt="White Logo" className="max-w-full max-h-full object-contain" />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-2 truncate w-full">Dark Sidebar</span>
                        </div>

                        {/* 3. Black Monochrome */}
                        <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col items-center text-center shadow-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase mb-2">3. Black Mono</span>
                          <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-100 p-1 flex items-center justify-center overflow-hidden">
                            <img src={formData.logoBlack || formData.logo || DEFAULT_LOGOS.logoBlack} alt="Black Logo" className="max-w-full max-h-full object-contain" />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-2 truncate w-full">Monochrome</span>
                        </div>

                        {/* 4. Thermal Receipt (KOT & Bill) */}
                        <div className="p-3 bg-amber-50/50 rounded-xl border border-dashed border-amber-300 flex flex-col items-center text-center shadow-xs">
                          <span className="text-[10px] font-bold text-amber-800 uppercase mb-2">4. Thermal Print</span>
                          <div className="w-16 h-16 rounded-lg bg-white border border-amber-200 p-1 flex items-center justify-center overflow-hidden">
                            <img src={formData.logoReceipt || formData.logo || DEFAULT_LOGOS.logoReceipt} alt="Receipt Logo" className="max-w-full max-h-full object-contain filter contrast-150" />
                          </div>
                          <span className="text-[10px] text-amber-700 font-semibold mt-2 truncate w-full">KOT &amp; Bill Roll</span>
                        </div>

                        {/* 5. Favicon */}
                        <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col items-center text-center shadow-xs col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase mb-2">5. Browser Tab</span>
                          <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
                            <img src={formData.favicon || formData.logo || DEFAULT_LOGOS.favicon} alt="Favicon" className="w-8 h-8 object-contain" />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-2 truncate w-full">Favicon (Tab)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
                    {t('settings.restaurantDetails', 'Restaurant Name, Title & Identity Details')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label={t('settings.restaurantName', 'Restaurant Name (Header, Login, Dashboard & Invoices)')}
                      required
                      value={formData.restaurantName}
                      onChange={(e) => handleChange('restaurantName', e.target.value)}
                      placeholder="e.g. Green Tandoor Se"
                      helperText="Primary restaurant name shown everywhere in the system"
                    />
                    <Input
                      label={t('settings.tagline', 'Restaurant Title / Subtitle / Tagline')}
                      value={formData.tagline}
                      onChange={(e) => handleChange('tagline', e.target.value)}
                      placeholder="e.g. Garden Restaurant"
                      helperText="Brand title printed below restaurant name"
                    />
                    <Input
                      label={t('auth.branchAssignment', 'Active Branch Name')}
                      required
                      value={formData.branchName}
                      onChange={(e) => handleChange('branchName', e.target.value)}
                    />
                    <Input
                      label={t('settings.contactPhone', 'Phone Number')}
                      required
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                    />
                    <Input
                      label={t('settings.contactEmail', 'Official Email')}
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                    />
                    <Input
                      label={t('settings.gstin', 'GSTIN (Tax ID)')}
                      required
                      value={formData.gstin}
                      onChange={(e) => handleChange('gstin', e.target.value)}
                    />
                    <Input
                      label={t('settings.fssai', 'FSSAI Food License #')}
                      value={formData.fssai}
                      onChange={(e) => handleChange('fssai', e.target.value)}
                    />
                    <div className="md:col-span-2">
                      <Input
                        label={t('settings.branchAddress', 'Physical Address (Appears on Invoices)')}
                        required
                        value={formData.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}


            {activeTab === 'AREAS' && (
              <DiningAreaManager />
            )}

            {activeTab === 'STATIONS' && (
              <KitchenStationManager />
            )}

            {activeTab === 'TAXES' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
                  Tax Rates, UPI QR & Financial Limits
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t('settings.defaultTaxRate', 'Default GST Tax Rate (%)')}
                    type="number"
                    step="0.1"
                    min="0"
                    max="28"
                    required
                    value={formData.defaultTaxRate}
                    onChange={(e) => handleChange('defaultTaxRate', Number(e.target.value))}
                    helperText="Calculated as equal CGST (50%) and SGST (50%)"
                  />
                  <Input
                    label={t('billing.discountAmount', 'Max Operator Discount Allowed (%)')}
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    required
                    value={formData.maxDiscountPercent}
                    onChange={(e) => handleChange('maxDiscountPercent', Number(e.target.value))}
                    helperText="Cashier and staff discount limit"
                  />
                  <Input
                    label={`${t('payment.upi', 'UPI ID / VPA')} (For Dynamic Bill QR Code)`}
                    value={formData.upiId || ''}
                    placeholder="e.g. q705457761@ybl"
                    onChange={(e) => handleChange('upiId', e.target.value)}
                    helperText="Used to generate dynamic scan-and-pay UPI QR code on final settled bills"
                  />
                  <Input
                    label={t('settings.currencySymbol', 'Currency Symbol')}
                    required
                    value={formData.currencySymbol}
                    onChange={(e) => handleChange('currencySymbol', e.target.value)}
                  />
                </div>
              </div>
            )}

            {activeTab === 'PRINTING' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
                  Invoice, KOT & Thermal Receipt Preferences
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t('settings.invoicePrefix', 'Invoice Numbering Prefix')}
                    required
                    value={formData.invoicePrefix}
                    onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                    helperText="e.g. INV- results in INV-001, INV-002"
                  />
                  <Input
                    label={t('settings.kotPrefix', 'KOT Ticket Prefix')}
                    required
                    value={formData.kotPrefix}
                    onChange={(e) => handleChange('kotPrefix', e.target.value)}
                    helperText="e.g. KOT- results in KOT-001, KOT-002"
                  />
                  <Select
                    label="Thermal Receipt Paper Width"
                    value={formData.thermalWidth}
                    onChange={(e) => handleChange('thermalWidth', e.target.value)}
                    options={[
                      { value: '80mm', label: '80mm (Standard POS Thermal Roll)' },
                      { value: '58mm', label: '58mm (Compact Mobile Receipt)' }
                    ]}
                  />
                  <div className="md:col-span-2">
                    <Input
                      label={t('settings.receiptFooter', 'Receipt Footer Thank You Message')}
                      value={formData.receiptFooter}
                      onChange={(e) => handleChange('receiptFooter', e.target.value)}
                      helperText="Custom sign-off text printed at the bottom of customer invoices"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'WORKFLOW' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
                    <span>{t('settings.orderWorkflow', 'Order Approval & Kitchen Dispatch Policy')}</span>
                    <Badge variant={formData.requireOrderApproval !== false ? 'warning' : 'success'}>
                      {formData.requireOrderApproval !== false ? 'Approval Required (Reception Review)' : 'Direct KOT (No Approval)'}
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose whether table and takeaway orders placed by Captains or Web POS must be confirmed at Reception before printing KOT tickets to the kitchen.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option 1: Approval Enabled */}
                  <div
                    onClick={() => handleChange('requireOrderApproval', true)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      formData.requireOrderApproval !== false
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            formData.requireOrderApproval !== false ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                          }`}>
                            {formData.requireOrderApproval !== false && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          Require Reception Order Approval (Enabled)
                        </span>
                        <Badge variant="warning" size="sm">Approval Required</Badge>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed pl-6">
                        Orders created by captains or staff enter the <b>Waiting Confirmation Queue</b>. Reception or cashier must review dishes, modifications, and table assignment before approving and dispatching tickets to the kitchen.
                      </p>
                      <ul className="text-[11px] text-slate-500 mt-3 space-y-1 pl-6 list-disc list-inside">
                        <li>Prevents duplicate or accidental KOT printing</li>
                        <li>Enables front-desk review of special items and table assignments</li>
                        <li>Recommended for fine-dining and full-service restaurants</li>
                      </ul>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/60 pl-6 flex items-center gap-2 text-xs font-semibold text-blue-700">
                      <span>Flow: Captain Order → Reception Queue → Approve &amp; Fire KOT → Kitchen</span>
                    </div>
                  </div>

                  {/* Option 2: Approval Disabled */}
                  <div
                    onClick={() => handleChange('requireOrderApproval', false)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      formData.requireOrderApproval === false
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            formData.requireOrderApproval === false ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                          }`}>
                            {formData.requireOrderApproval === false && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          Direct Kitchen Dispatch (Disabled)
                        </span>
                        <Badge variant="success" size="sm">Direct KOT</Badge>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed pl-6">
                        Orders placed by captains or staff <b>bypass reception approval</b> and automatically generate &amp; fire KOT tickets directly to assigned kitchen stations in real-time.
                      </p>
                      <ul className="text-[11px] text-slate-500 mt-3 space-y-1 pl-6 list-disc list-inside">
                        <li>Instant dispatch to kitchen without reception intervention</li>
                        <li>Table status immediately updates to KOT Sent</li>
                        <li>Recommended for quick-service, fast casual, cafes, and rush hours</li>
                      </ul>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/60 pl-6 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <span>Flow: Captain Order → Direct KOT Dispatch → Kitchen Immediately</span>
                    </div>
                  </div>
                </div>

                {/* Toggle Switch Bar */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-800 text-sm block">Order Approval Mode</span>
                    <span className="text-xs text-slate-500">
                      {formData.requireOrderApproval !== false
                        ? 'Order approval is currently ENABLED. Incoming orders require reception review.'
                        : 'Order approval is currently DISABLED. Incoming orders fire KOT tickets directly.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange('requireOrderApproval', formData.requireOrderApproval === false)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      formData.requireOrderApproval !== false ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                    role="switch"
                    aria-checked={formData.requireOrderApproval !== false}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        formData.requireOrderApproval !== false ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {['PROFILE', 'WORKFLOW', 'TAXES', 'PRINTING'].includes(activeTab) && (
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button type="submit" variant="primary" icon={Save} loading={saving}>
                  {t('settings.saveSettings', 'Save System Settings')}
                </Button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
