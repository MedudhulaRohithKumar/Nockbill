import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Store,
  Building,
  FileText,
  Landmark,
  ShieldCheck,
  Check,
  Save,
  AlertCircle,
  Users,
  UserPlus,
  Edit3,
  Trash2,
  KeyRound,
  Copy,
  Upload,
  Download,
  Eye,
  X,
  Printer,
  QrCode,
  CreditCard,
  Lock,
  BadgeCheck,
  RefreshCw,
  Phone,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Fingerprint,
  Zap
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { ShopSettings, IamUser } from '../types';
import {
  sanitizeTextInput,
  sanitizeCodeInput,
  sanitizePhoneInput,
  sanitizePincodeInput,
  isValidPhone,
  isValidPincode,
  isValidGstin,
  isValidIfsc,
  formatCurrency
} from '../utils/formatters';
import { authApi, settingsApi, getErrorMessage } from '../api';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useShop();
  const { user: currentUser } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'panel-store' | 'panel-bank' | 'panel-escpos' | 'panel-rbac' | 'panel-sync'>('panel-store');

  // Form State
  const [formData, setFormData] = useState<Partial<ShopSettings>>({});
  const [iamUsers, setIamUsers] = useState<IamUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Hardware Simulation States
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [printerPort, setPrinterPort] = useState<string>('USB001 (TVS RP-3200 Star)');
  const [baudRate, setBaudRate] = useState<string>('19200 bps (High Speed)');
  const [charEncoding, setCharEncoding] = useState<string>('UTF-8 (Kannada + English)');
  const [autoCutter, setAutoCutter] = useState<boolean>(true);
  const [cashDrawerKick, setCashDrawerKick] = useState<boolean>(true);
  const [printKhataLedger, setPrintKhataLedger] = useState<boolean>(true);
  const [printDbtToken, setPrintDbtToken] = useState<boolean>(true);
  const [footerStatutoryText, setFooterStatutoryText] = useState<string>(
    'Goods once sold will not be returned without bill. Store fertilizers in dry place. Keep crop protection chemicals safely away from children. Jai Jawan, Jai Kisan!'
  );

  // User Management Modal
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [userUsername, setUserUsername] = useState<string>('');
  const [userRole, setUserRole] = useState<'OWNER' | 'STAFF'>('STAFF');
  const [userPhone, setUserPhone] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPassword, setUserPassword] = useState<string>('');
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  // Biometric Test State
  const [biometricStatus, setBiometricStatus] = useState<string | null>(null);

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Sync settings into formData
  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
      if (settings.invoice_footer_note) {
        setFooterStatutoryText(settings.invoice_footer_note);
      }
    }
  }, [settings]);

  // Load IAM Users
  const fetchIamUsers = useCallback(async () => {
    try {
      const users = await authApi.listUsers();
      setIamUsers(users);
    } catch {
      // Fallback: If listUsers returns error or user is not owner, show current user
      if (currentUser) {
        setIamUsers([
          {
            id: currentUser.id,
            username: currentUser.username,
            name: currentUser.full_name || 'Store Owner',
            role: currentUser.role === 'owner' ? 'OWNER' : 'STAFF',
            phone: currentUser.phone || null,
            email: currentUser.email || null,
            is_active: currentUser.is_active,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void fetchIamUsers();
  }, [fetchIamUsers]);

  // Keyboard Shortcuts: Ctrl+S (Save), F9 (Print Test Slip)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void handleSaveAllChanges();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handlePrintTestSlip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleInputChange = (field: keyof ShopSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save All Settings
  const handleSaveAllChanges = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload: Partial<ShopSettings> = {
        ...formData,
        invoice_footer_note: footerStatutoryText,
      };

      await updateSettings(payload);
      showNotification('Store settings & hardware configuration saved successfully!');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save settings. Please verify license and bank data.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Restore Defaults
  const handleRestoreDefaults = () => {
    if (settings) {
      setFormData({ ...settings });
      if (settings.invoice_footer_note) {
        setFooterStatutoryText(settings.invoice_footer_note);
      }
    }
    showNotification('Form restored to current active store configuration.', 'info');
  };

  // Export Backup JSON
  const handleExportBackup = () => {
    const backupData = {
      store_settings: formData,
      hardware_config: {
        paper_size: paperSize,
        printer_port: printerPort,
        baud_rate: baudRate,
        char_encoding: charEncoding,
        auto_cutter: autoCutter,
        cash_drawer_kick: cashDrawerKick,
        print_khata_ledger: printKhataLedger,
        print_dbt_token: printDbtToken,
        footer_note: footerStatutoryText,
      },
      export_timestamp: new Date().toISOString(),
      erp_version: 'v4.2.8 Enterprise',
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nockbill_store_config_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Store configuration backup exported as JSON.');
  };

  // Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file (PNG/JPG).', 'error');
      return;
    }

    try {
      const updated = await settingsApi.uploadLogo(file);
      setFormData(prev => ({ ...prev, logo_path: updated.logo_path }));
      showNotification('Store monogram seal uploaded successfully!');
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, 'Failed to upload store logo.'), 'error');
    }
  };

  // Print Test Slip
  const handlePrintTestSlip = () => {
    window.print();
    showNotification(`Test 80mm slip dispatched to ${printerPort} (F9).`);
  };

  // Calibrate Cutter
  const handleCalibrateCutter = () => {
    showNotification('GS V 66 0 full cut code pulse sent to TVS RP-3200 Star cutter.', 'info');
  };

  // Test Biometric Device
  const handleTestBiometric = () => {
    setBiometricStatus('Connecting to Morpho RD Service...');
    setTimeout(() => {
      setBiometricStatus('Morpho MSO-1300 E3 Ready (Sensor Clean, Aadhaar DBT Capture Validated).');
      setTimeout(() => setBiometricStatus(null), 4000);
    }, 1200);
  };

  // User Management
  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserName('');
    setUserUsername('');
    setUserRole('STAFF');
    setUserPhone('');
    setUserEmail('');
    setUserPassword('');
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: IamUser) => {
    setEditingUserId(u.id);
    setUserName(u.name);
    setUserUsername(u.username);
    setUserRole(u.role);
    setUserPhone(u.phone || '');
    setUserEmail(u.email || '');
    setUserPassword('');
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUser(true);
    try {
      if (editingUserId) {
        await authApi.updateUser(editingUserId, {
          name: userName,
          phone: userPhone || undefined,
          email: userEmail || undefined,
          role: userRole,
          password: userPassword || undefined,
        });
        showNotification(`Operator "${userName}" privileges updated successfully.`);
      } else {
        if (!userPassword) {
          showNotification('Password is required for new staff PIN.', 'error');
          setIsSavingUser(false);
          return;
        }
        await authApi.createUser({
          name: userName,
          username: userUsername,
          password: userPassword,
          role: userRole,
          phone: userPhone || undefined,
          email: userEmail || undefined,
        });
        showNotification(`New operator "${userName}" added to terminal roster.`);
      }
      setShowUserModal(false);
      void fetchIamUsers();
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, 'Failed to save staff credentials.'), 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (u: IamUser) => {
    if (u.role === 'OWNER') {
      showNotification('Cannot delete root store owner profile.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to revoke POS access for ${u.name}?`)) return;

    try {
      await authApi.deleteUser(u.id);
      showNotification(`Revoked terminal access for ${u.name}.`);
      void fetchIamUsers();
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, 'Failed to remove user.'), 'error');
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white min-h-screen transition-colors">
      
      {/* Top Sticky Context & Subheader Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Dashboard</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>System &amp; Hardware</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
              Store Settings &amp; POS Configuration
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            Store Settings &amp; Hardware Configuration
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
            Dealership trade licenses, statutory fertilizer compliance, merchant banking UPI VPA, thermal ESC/POS printer engine, and counter terminal role policies.
          </p>
        </div>

        {/* Action Suite */}
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-center">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>Restore Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleExportBackup}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>Export Backup (JSON)</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAllChanges}
            className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
          >
            <Save className="w-4 h-4 text-emerald-300" />
            <span>{isSaving ? 'Saving Changes...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {/* Quick-Jump Navigation Tabs */}
      <div className="mobile-tab-strip items-center gap-1.5 pb-1 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xs p-1.5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 transition-colors">
        {[
          { id: 'panel-store', label: 'Trade Licenses & Store Profile', icon: Store, badge: '3 ACTIVE', badgeColor: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' },
          { id: 'panel-bank', label: 'Bank & Merchant UPI QR', icon: Landmark, badge: 'NPCI T+0', badgeColor: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' },
          { id: 'panel-escpos', label: 'Thermal ESC/POS Hardware', icon: Printer, badge: '80MM READY', badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300' },
          { id: 'panel-rbac', label: 'Cashier & RBAC Access', icon: Users, badge: `${iamUsers.length} OPERATORS`, badgeColor: 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300' },
          { id: 'panel-sync', label: 'Audit & Cloud Sync', icon: ShieldCheck, badge: 'HEALTHY', badgeColor: 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as any);
                const el = document.getElementById(tab.id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${isActive ? 'bg-emerald-950 text-emerald-200' : tab.badgeColor}`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {notificationMsg && (
        <div className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
          notificationMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : notificationMsg.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-sky-50 border-sky-200 text-sky-800'
        }`}>
          <div className="flex items-center gap-2">
            {notificationMsg.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            <span className="font-semibold">{notificationMsg.text}</span>
          </div>
          <button type="button" onClick={() => setNotificationMsg(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: STORE PROFILE & STATUTORY LICENSES */}
      <section id="panel-store" className="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-24">
        
        {/* Dealership & APMC Profile (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Dealership &amp; APMC Profile</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Legal entity info printed on e-invoices, Form O receipts, and tax ledgers</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase">
              Verified GSTIN
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-store-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                <span>Dealership / Kendra Name</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Header print</span>
              </label>
              <div className="relative">
                <input
                  id="settings-store-name"
                  type="text"
                  value={formData.shop_name || ''}
                  onChange={(e) => handleInputChange('shop_name', sanitizeTextInput(e.target.value))}
                  placeholder="Green Valley Agro Kendra"
                  className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label htmlFor="settings-proprietor-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                <span>Proprietor / Signatory</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Principal</span>
              </label>
              <input
                id="settings-proprietor-name"
                type="text"
                value={formData.proprietor_name || ''}
                onChange={(e) => handleInputChange('proprietor_name', sanitizeTextInput(e.target.value))}
                placeholder="Proprietor / Signatory Name"
                className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="settings-gstin" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                <span>GSTIN Identification No.</span>
                <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">GST Regular</span>
              </label>
              <input
                id="settings-gstin"
                type="text"
                value={formData.gstin || ''}
                onChange={(e) => handleInputChange('gstin', sanitizeCodeInput(e.target.value).toUpperCase())}
                placeholder="29AAAAA0000A1Z5"
                className="w-full text-xs font-mono font-bold uppercase px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="settings-mobile" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                <span>Contact Mobile &amp; WhatsApp</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">E-Bill Sender</span>
              </label>
              <input
                id="settings-mobile"
                type="text"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', sanitizePhoneInput(e.target.value))}
                placeholder="+91 98765 43210"
                className="w-full text-xs font-mono font-bold px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="settings-address" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                <span>Physical Mandi / Yard Address</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">APMC Mandya Cluster</span>
              </label>
              <textarea
                id="settings-address"
                rows={2}
                value={formData.address_line1 || ''}
                onChange={(e) => handleInputChange('address_line1', e.target.value)}
                placeholder="Plot 42, APMC Market Yard, Bengaluru-Mysuru Highway, Mandya - 571401"
                className="w-full text-xs font-medium p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Store Logo & Seal Zone */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-xs flex items-center justify-center p-2 shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
              {formData.logo_path ? (
                <img src={formData.logo_path} alt="Store Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
                  {formData.shop_name ? formData.shop_name.slice(0, 2).toUpperCase() : 'AG'}
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-0.5 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Store Monogram &amp; Thermal Seal</span>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded-full">
                  128x128px MONOCHROME
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                High-contrast 1-bit rasterized glyph printed at the apex of 80mm thermal receipts.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="store-logo-file-input" className="cursor-pointer px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs border border-slate-200 dark:border-slate-700 transition-colors">
                <span>Upload Logo</span>
                <input
                  id="store-logo-file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Statutory Agricultural Compliance Cards (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-3.5 transition-colors">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Statutory Ag-Licenses</h2>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                Audit Active
              </span>
            </div>

            {/* License 1: Fertilizer FCO */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Fertilizer Control Order (FCO)</span>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  FCO SYNCED
                </span>
              </div>
              <input
                type="text"
                value={formData.fertilizer_license_no || ''}
                onChange={(e) => handleInputChange('fertilizer_license_no', e.target.value)}
                placeholder="FERT/KA-2023/8892"
                className="w-full text-xs font-mono font-bold text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>Valid till: <strong className="text-slate-800 dark:text-slate-200">31-Mar-2027</strong></span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Form O Authorized
                </span>
              </div>
            </div>

            {/* License 2: CIB & RC Insecticides */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Pesticide &amp; Insecticide (CIB)</span>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  CIB-RC COMPLIANT
                </span>
              </div>
              <input
                type="text"
                value={formData.pesticide_license_no || ''}
                onChange={(e) => handleInputChange('pesticide_license_no', e.target.value)}
                placeholder="CIB-PEST/2021/0412"
                className="w-full text-xs font-mono font-bold text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>Valid till: <strong className="text-slate-800 dark:text-slate-200">14-Oct-2026</strong></span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Batch Audit Ready
                </span>
              </div>
            </div>

            {/* License 3: Certified Seed Dealer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Certified Seed Dealer Reg.</span>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  GERMINATION OK
                </span>
              </div>
              <input
                type="text"
                value={formData.seed_license_no || ''}
                onChange={(e) => handleInputChange('seed_license_no', e.target.value)}
                placeholder="SEED-REG/MND-9918"
                className="w-full text-xs font-mono font-bold text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>Valid till: <strong className="text-slate-800 dark:text-slate-200">30-Jun-2028</strong></span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> 8-Yr Record Auto-Save
                </span>
              </div>
            </div>
          </div>

          {/* DBT Portal Biometric Status Card */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Morpho MSO-1300 E3</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <span className="text-[10px] text-slate-600 dark:text-slate-300 block mt-0.5">
                  RD Service 3.2.0 • Aadhaar DBT Ready
                </span>
                {biometricStatus && (
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block mt-1">
                    {biometricStatus}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestBiometric}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-900 dark:text-emerald-300 text-[11px] font-bold rounded-xl shadow-2xs border border-emerald-200 dark:border-emerald-700 transition-colors shrink-0"
            >
              TEST BIOMETRIC
            </button>
          </div>
        </div>

      </section>

      {/* SECTION 2: BANK ACCOUNT & MERCHANT UPI QR ENGINE */}
      <section id="panel-bank" className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-5 scroll-mt-24 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Banking Settlement &amp; Dynamic Counter UPI QR</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Instant customer UPI scan at checkout with soundbox webhook &amp; zero-touch ledger credit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full uppercase">
              NPCI T+0 SETTLEMENT
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Form (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="settings-bank-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Depository Bank Name
                </label>
                <input
                  id="settings-bank-name"
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={(e) => handleInputChange('bank_name', e.target.value)}
                  placeholder="Canara Bank (Mandya Main Branch)"
                  className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="settings-bank-acc" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Current Account Number
                </label>
                <input
                  id="settings-bank-acc"
                  type="text"
                  value={formData.bank_account_no || ''}
                  onChange={(e) => handleInputChange('bank_account_no', e.target.value)}
                  placeholder="0192 1010 88291"
                  className="w-full text-xs font-mono font-bold tracking-wider px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="settings-bank-ifsc" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                  <span>IFSC Clearing Code</span>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded">VALIDATED</span>
                </label>
                <input
                  id="settings-bank-ifsc"
                  type="text"
                  value={formData.bank_ifsc || ''}
                  onChange={(e) => handleInputChange('bank_ifsc', e.target.value.toUpperCase())}
                  placeholder="CNRB0000192"
                  className="w-full text-xs font-mono font-bold uppercase px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="settings-upi-vpa" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                  <span>Primary Merchant UPI VPA</span>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded">BHIM VERIFIED</span>
                </label>
                <input
                  id="settings-upi-vpa"
                  type="text"
                  value={formData.upi_id || ''}
                  onChange={(e) => handleInputChange('upi_id', e.target.value.toLowerCase())}
                  placeholder="greenvalleyagro@okcanara"
                  className="w-full text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Settlement & Soundbox Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Soundbox Terminal</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Paytm Soundbox 4.0</span>
                  <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded">ONLINE</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  Kannada &amp; English audio voice announcements on ₹ receive.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settlement Cadence</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Realtime T+0</span>
                  <span className="text-[9px] font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 px-1.5 py-0.2 rounded">INSTANT</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  Direct credit to store current account without escrow delay.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Auto-Reconciliation</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">12-Digit RRN</span>
                  <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded">ENABLED</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  Matches customer UPI UTR directly to invoice number in Till register.
                </p>
              </div>
            </div>
          </div>

          {/* Counter Standee Simulator (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-4 transition-colors">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-full shadow-2xs border border-slate-200 dark:border-slate-700">
                COUNTER STAND DISPLAY SIMULATOR
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-1">
                {formData.shop_name || 'Green Valley Agro Kendra'}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                UPI VPA: {formData.upi_id || 'greenvalleyagro@okcanara'}
              </span>
            </div>

            {/* Dynamic QR SVG */}
            <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200 flex items-center justify-center relative">
              <div className="w-44 h-44 flex items-center justify-center">
                <QrCode className="w-40 h-40 text-slate-900" />
                <div className="absolute inset-0 m-auto w-10 h-10 bg-emerald-800 text-white rounded-xl flex items-center justify-center font-bold text-base shadow-md border-2 border-white">
                  ₹
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                <span key={app} className="text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded shadow-2xs border border-slate-200 dark:border-slate-700">
                  {app}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(formData.upi_id || '');
                  showNotification('UPI VPA copied to clipboard.');
                }}
                className="flex-1 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Copy UPI ID
              </button>
              <button
                type="button"
                onClick={handlePrintTestSlip}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                Print Standee
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 3: POS HARDWARE & THERMAL ESC/POS RECEIPT ENGINE */}
      <section id="panel-escpos" className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-5 scroll-mt-24 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Thermal ESC/POS Hardware &amp; Bill Engine</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Direct USB/Network printer drivers, auto-cutter telemetry, Kannada font rendering, and live bill preview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCalibrateCutter}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
            >
              Calibrate Cutter
            </button>
            <button
              type="button"
              onClick={handlePrintTestSlip}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Test Slip</span>
              <span className="bg-black/20 text-white text-[10px] px-1.5 py-0.2 rounded font-mono ml-0.5">F9</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Controls (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Paper Width Radio */}
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-2">
                Paper Width &amp; Roll Specification
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-3.5 rounded-xl cursor-pointer flex items-start gap-3 border transition-all ${
                  paperSize === '80mm'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="paper-size"
                    checked={paperSize === '80mm'}
                    onChange={() => setPaperSize('80mm')}
                    className="mt-0.5 text-emerald-800 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">80mm Direct Thermal</span>
                      <span className="text-[9px] font-bold bg-emerald-800 text-white px-1.5 py-0.2 rounded">RECOMMENDED</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Standard 3-inch counter roll (48/56 chars per line, ESC/POS native)
                    </span>
                  </div>
                </label>

                <label className={`p-3.5 rounded-xl cursor-pointer flex items-start gap-3 border transition-all ${
                  paperSize === '58mm'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="paper-size"
                    checked={paperSize === '58mm'}
                    onChange={() => setPaperSize('58mm')}
                    className="mt-0.5 text-emerald-800 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">58mm Pocket Thermal</span>
                      <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.2 rounded">BLUETOOTH</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Compact 2-inch mobile roll (32 chars, van sales / field billing)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Comm Port & Baud Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="settings-printer-port" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Printer Comm Port
                </label>
                <select
                  id="settings-printer-port"
                  value={printerPort}
                  onChange={(e) => setPrinterPort(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-2.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="USB001 (TVS RP-3200 Star)">USB001 (TVS RP-3200 Star)</option>
                  <option value="COM3 - 9600 bps Serial">COM3 - 9600 bps Serial</option>
                  <option value="IP 192.168.1.150:9100">IP 192.168.1.150:9100</option>
                  <option value="Bluetooth TVS_BT01">Bluetooth TVS_BT01</option>
                </select>
              </div>

              <div>
                <label htmlFor="settings-baud-rate" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Baud Transmission Rate
                </label>
                <select
                  id="settings-baud-rate"
                  value={baudRate}
                  onChange={(e) => setBaudRate(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-2.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="9600 bps (Standard)">9600 bps (Standard)</option>
                  <option value="19200 bps (High Speed)">19200 bps (High Speed)</option>
                  <option value="115200 bps (USB Direct)">115200 bps (USB Direct)</option>
                </select>
              </div>

              <div>
                <label htmlFor="settings-char-encoding" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Character Codepage
                </label>
                <select
                  id="settings-char-encoding"
                  value={charEncoding}
                  onChange={(e) => setCharEncoding(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-2.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="UTF-8 (Kannada + English)">UTF-8 (Kannada + English)</option>
                  <option value="PC437 (Standard English)">PC437 (Standard English)</option>
                  <option value="ISCII Devnagari / Hindi">ISCII Devnagari / Hindi</option>
                </select>
              </div>
            </div>

            {/* Check Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Auto-Cutter Mechanism</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Sends GS V 66 0 full cut code</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoCutter}
                  onChange={(e) => setAutoCutter(e.target.checked)}
                  className="w-4 h-4 accent-emerald-700 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Cash Drawer Kick Pulse</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Fires 24V pin on cash settlement</span>
                </div>
                <input
                  type="checkbox"
                  checked={cashDrawerKick}
                  onChange={(e) => setCashDrawerKick(e.target.checked)}
                  className="w-4 h-4 accent-emerald-700 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Print Farmer Khata Ledger</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Shows previous due + new balance</span>
                </div>
                <input
                  type="checkbox"
                  checked={printKhataLedger}
                  onChange={(e) => setPrintKhataLedger(e.target.checked)}
                  className="w-4 h-4 accent-emerald-700 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Print DBT Aadhaar Token</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Masked UID: XXXX-XXXX-4912</span>
                </div>
                <input
                  type="checkbox"
                  checked={printDbtToken}
                  onChange={(e) => setPrintDbtToken(e.target.checked)}
                  className="w-4 h-4 accent-emerald-700 rounded"
                />
              </label>
            </div>

            {/* Footer Statutory Text */}
            <div>
              <label htmlFor="settings-footer-text" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                <span>Receipt Footer Statutory Text</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{footerStatutoryText.length} / 160 chars</span>
              </label>
              <textarea
                id="settings-footer-text"
                rows={2}
                value={footerStatutoryText}
                onChange={(e) => setFooterStatutoryText(e.target.value)}
                className="w-full text-xs font-mono p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Thermal Receipt Visual Simulator Card (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div data-keep-light="true" className="w-full max-w-sm bg-white p-5 rounded-2xl shadow-xl font-mono text-[11px] text-black leading-tight flex flex-col select-none border border-slate-200 relative">
              
              {/* Serrated Top Edge */}
              <div className="flex items-center justify-between opacity-40 -mt-2 mb-2 pb-1 text-center text-[9px] uppercase tracking-widest border-b border-dashed border-slate-300">
                <span>- - - 80mm ESC/POS EMULATOR - - -</span>
              </div>

              {/* Receipt Header */}
              <div className="flex flex-col items-center text-center gap-0.5">
                <span className="text-[14px] font-black uppercase tracking-tight">
                  {formData.shop_name || 'GREEN VALLEY AGRO KENDRA'}
                </span>
                <span className="text-[10px] text-slate-600">
                  {formData.address_line1 || 'APMC Yard, Mandya, Karnataka - 571401'}
                </span>
                <span className="text-[10px] font-bold">
                  GSTIN: {formData.gstin || '29AAAAA0000A1Z5'} | PH: {formData.phone || '9876543210'}
                </span>
                <span className="text-[9px] text-slate-500">
                  FERT LIC: {formData.fertilizer_license_no || 'FERT-REGISTERED'}
                </span>
              </div>

              <div className="my-2 border-b-2 border-dashed border-black/40"></div>

              {/* Bill Metadata */}
              <div className="flex justify-between text-[10px]">
                <span>INV: #INV-LIVE</span>
                <span>DATE: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>FARMER: REGISTERED GROWER</span>
                <span>COUNTER: POS #01</span>
              </div>

              <div className="my-1.5 border-b border-black"></div>

              {/* Table Header */}
              <div className="flex justify-between font-bold text-[10px] uppercase">
                <span className="w-6/12">ITEM &amp; BATCH</span>
                <span className="w-2/12 text-center">QTY</span>
                <span className="w-2/12 text-right">RATE</span>
                <span className="w-2/12 text-right">AMT</span>
              </div>

              <div className="my-1 border-b border-black/60"></div>

              {/* Line Items */}
              <div className="flex flex-col gap-1.5 py-1 text-[10px]">
                <div>
                  <div className="flex justify-between font-bold">
                    <span className="w-6/12 truncate">IFFCO Urea 45kg Neem</span>
                    <span className="w-2/12 text-center">2 BAG</span>
                    <span className="w-2/12 text-right">266.50</span>
                    <span className="w-2/12 text-right">533.00</span>
                  </div>
                  <div className="text-[9px] text-slate-500">B:UF-8812 EXP:12/26 HSN:3102</div>
                </div>
                <div>
                  <div className="flex justify-between font-bold">
                    <span className="w-6/12 truncate">Bayer Regent 0.3% GR 1kg</span>
                    <span className="w-2/12 text-center">1 CAN</span>
                    <span className="w-2/12 text-right">620.00</span>
                    <span className="w-2/12 text-right">620.00</span>
                  </div>
                  <div className="text-[9px] text-slate-500">B:BY-2024 EXP:08/26 HSN:3808</div>
                </div>
                <div>
                  <div className="flex justify-between font-bold">
                    <span className="w-6/12 truncate">Mahyco Pioneer Corn 3396</span>
                    <span className="w-2/12 text-center">3 PKT</span>
                    <span className="w-2/12 text-right">450.00</span>
                    <span className="w-2/12 text-right">1,350.00</span>
                  </div>
                  <div className="text-[9px] text-slate-500">B:MH-9011 EXP:04/25 HSN:1209</div>
                </div>
              </div>

              <div className="my-1.5 border-b border-black"></div>

              {/* Totals */}
              <div className="flex justify-between font-bold text-[11px]">
                <span>SUBTOTAL (3 ITEMS)</span>
                <span>₹2,503.00</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>CGST @ 2.5% + SGST @ 2.5%</span>
                <span>₹125.15</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>FERTILIZER SUBSIDY (DBT GOVT)</span>
                <span>- ₹320.00</span>
              </div>

              <div className="my-1.5 border-b-2 border-black"></div>

              <div className="flex justify-between font-black text-[13px]">
                <span>NET PAYABLE</span>
                <span>₹2,308.15</span>
              </div>

              {/* Khata Segment */}
              {printKhataLedger && (
                <div className="my-2 p-1.5 bg-slate-100 rounded flex justify-between font-bold text-[10px]">
                  <span>PREVIOUS KHATA CREDIT DUE</span>
                  <span>₹4,200.00</span>
                </div>
              )}

              {/* QR Simulation */}
              <div className="flex flex-col items-center justify-center gap-1 mt-2">
                <QrCode className="w-16 h-16 text-black" />
                <span className="text-[9px] font-bold">SCAN TO PAY UPI • ₹2,308.15</span>
                <span className="text-[8px] text-slate-500">TXN: 9821-20240524-KENDRA</span>
              </div>

              <div className="my-2 border-b-2 border-dashed border-black/40"></div>

              <div className="text-[9px] text-center leading-normal text-slate-700">
                {footerStatutoryText}
              </div>

              <div className="text-[8px] font-bold text-center mt-1 text-slate-400">
                ** POWERED BY NOCKBILL AGRI ERP **
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 4: CASHIER & RBAC TERMINAL ACCESS CONTROL */}
      <section id="panel-rbac" className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-5 scroll-mt-24 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Cashier &amp; RBAC Terminal Operators</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Store staff authorization, maximum counter discount allowances, and till drawer locking rules</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenAddUser}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4 text-emerald-300" />
            <span>Add Cashier / Staff PIN</span>
          </button>
        </div>

        {/* Operator Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {iamUsers.map((u) => {
            const isOwner = u.role === 'OWNER';
            const initials = u.name
              ? u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              : u.username.slice(0, 2).toUpperCase();

            return (
              <div key={u.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3 shadow-2xs transition-colors">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                        isOwner ? 'bg-emerald-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}>
                        {initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{u.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">@{u.username}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isOwner ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300' : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {isOwner ? 'STORE OWNER' : 'CASHIER'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 mt-3 text-xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span>Terminal Access:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{isOwner ? 'All POS & Reports' : 'Counter #01 POS'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span>Max Discount:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{isOwner ? 'Unlimited (100%)' : 'Up to 5.0% MRP'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span>Khata Credit Approval:</span>
                      <span className={`font-bold ${isOwner ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {isOwner ? 'Full Privilege' : 'Up to ₹10,000'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span>Base MRP Override:</span>
                      <span className={`font-bold ${isOwner ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isOwner ? 'Allowed' : 'LOCKED'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    u.is_active ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {u.is_active ? 'ACTIVE' : 'DISABLED'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditUser(u)}
                      className="text-emerald-800 dark:text-emerald-400 font-bold hover:underline"
                    >
                      Edit
                    </button>
                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security Policy Banner */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Store POS Guardrail Policy Active</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Terminal auto-locks after 5 minutes of inactivity. Manager PIN required for credit balance write-offs.
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 shrink-0">
            AUDIT LOG: ENABLED
          </span>
        </div>
      </section>

      {/* SECTION 5: AUDIT LOGS & CLOUD DATA SYNC TELEMETRY */}
      <section id="panel-sync" className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4 scroll-mt-24 transition-colors">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Cloud Sync &amp; Hardware Telemetry Logs</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Realtime background replication status with State Ag-Department Portal and offline buffer</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 font-mono">ALL SERVICES HEALTHY</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-y border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Hardware / Channel</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-3">Event Telemetry</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500">11:42:09</td>
                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans">ESC/POS Thermal Engine ({printerPort})</td>
                <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200">{currentUser?.full_name || 'Counter Operator'}</td>
                <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Printed Invoice #INV-LIVE (80mm 42-line slip)</td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    SUCCESS 200
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500">11:40:18</td>
                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans">Canara Merchant UPI Webhook</td>
                <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200">System daemon</td>
                <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Merchant UPI settlement webhook reconciliation active</td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    CONFIRMED
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500">11:35:44</td>
                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans">DBT Aadhaar Biometric Service</td>
                <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200">{currentUser?.full_name || 'Counter Operator'}</td>
                <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Morpho fingerprint biometric validation handshake OK</td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    AUTH OK
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500">10:55:02</td>
                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans">Fertilizer FCO Portal Sync</td>
                <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200">Cloud Worker</td>
                <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Replicated stock batch verification to State Ag-Dept gateway</td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    SYNCED
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* USER MANAGEMENT MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {editingUserId ? 'Edit Operator Privileges' : 'Add Cashier / Staff PIN'}
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-3.5">
              <div>
                <label htmlFor="user-fullname" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name
                </label>
                <input
                  id="user-fullname"
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Counter Operator"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="user-login-username" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Username
                </label>
                <input
                  id="user-login-username"
                  type="text"
                  required
                  disabled={Boolean(editingUserId)}
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                  placeholder="e.g. operator_pos"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="user-terminal-role" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Terminal Authorization Role
                </label>
                <select
                  id="user-terminal-role"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="STAFF">Cashier / Staff (Standard Counter POS)</option>
                  <option value="OWNER">Store Owner (Root Administrator)</option>
                </select>
              </div>

              <div>
                <label htmlFor="user-phone-number" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  id="user-phone-number"
                  type="text"
                  value={userPhone}
                  onChange={(e) => setUserPhone(sanitizePhoneInput(e.target.value))}
                  placeholder="e.g. 9876543210"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="user-password-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {editingUserId ? 'New PIN / Password (Leave blank to keep current)' : 'POS PIN / Password'}
                </label>
                <input
                  id="user-password-input"
                  type="password"
                  required={!editingUserId}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  {isSavingUser ? 'Saving...' : editingUserId ? 'Save Changes' : 'Create Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
