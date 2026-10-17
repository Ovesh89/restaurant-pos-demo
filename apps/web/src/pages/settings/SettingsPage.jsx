import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Percent,
  Printer,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { settingsRepository, DEFAULT_SETTINGS } from '../../services/repositories/settingsRepository';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';

export const SettingsPage = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('PROFILE'); // PROFILE, TAXES, PRINTING
  const [formData, setFormData] = useState({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const actor = { id: user?.id || 'admin', name: user?.name || 'Admin' };
      const updated = await settingsRepository.updateSettings(formData, actor);
      setFormData(updated);
      setSuccessMsg('Settings saved successfully and applied across billing & KOTs!');
      setTimeout(() => setSuccessMsg(''), 4000);
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
        title="System & Restaurant Settings"
        subtitle="Configure branch information, GST tax rules, invoice/KOT prefixes, and thermal receipt formats"
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={RotateCcw} onClick={handleReset} disabled={saving}>
            Reset Defaults
          </Button>
          <Button variant="primary" icon={Save} onClick={handleSave} loading={saving}>
            Save Changes
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
          Restaurant Profile
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
          Taxes & Financials
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
          Thermal Printing & Prefixes
        </button>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 md:p-8 shadow-sm">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {activeTab === 'PROFILE' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
                  Restaurant Identity & Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Restaurant Legal Name"
                    required
                    value={formData.restaurantName}
                    onChange={(e) => handleChange('restaurantName', e.target.value)}
                  />
                  <Input
                    label="Tagline / Brand Descriptor"
                    value={formData.tagline}
                    onChange={(e) => handleChange('tagline', e.target.value)}
                  />
                  <Input
                    label="Active Branch Name"
                    required
                    value={formData.branchName}
                    onChange={(e) => handleChange('branchName', e.target.value)}
                  />
                  <Input
                    label="Phone Number"
                    required
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                  />
                  <Input
                    label="Official Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                  <Input
                    label="GSTIN (Tax ID)"
                    required
                    value={formData.gstin}
                    onChange={(e) => handleChange('gstin', e.target.value)}
                  />
                  <Input
                    label="FSSAI Food License #"
                    value={formData.fssai}
                    onChange={(e) => handleChange('fssai', e.target.value)}
                  />
                  <div className="md:col-span-2">
                    <Input
                      label="Physical Address (Appears on Invoices)"
                      required
                      value={formData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'TAXES' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
                  Tax Rates & Financial Limits
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Default GST Tax Rate (%)"
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
                    label="Max Operator Discount Allowed (%)"
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
                    label="Currency Symbol"
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
                    label="Invoice Numbering Prefix"
                    required
                    value={formData.invoicePrefix}
                    onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                    helperText="e.g. INV- results in INV-001, INV-002"
                  />
                  <Input
                    label="KOT Ticket Prefix"
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
                      label="Receipt Footer Thank You Message"
                      value={formData.receiptFooter}
                      onChange={(e) => handleChange('receiptFooter', e.target.value)}
                      helperText="Custom sign-off text printed at the bottom of customer invoices"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button type="submit" variant="primary" icon={Save} loading={saving}>
                Save System Settings
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
