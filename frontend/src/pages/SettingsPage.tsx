import React, { useState, useEffect } from 'react';
import {
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
  Palette,
  LayoutTemplate,
  Download,
  Eye,
  X,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { ShopSettings, IamUser, InvoiceTemplateId, Sale } from '../types';
import {
  sanitizeTextInput,
  sanitizeCodeInput,
  sanitizePhoneInput,
  sanitizePincodeInput,
  isValidPhone,
  isValidPincode,
  isValidGstin,
  isValidIfsc,
} from '../utils/formatters';
import { authApi, settingsApi, getErrorMessage } from '../api';
import { InvoiceDocumentView } from '../components/billing/InvoiceReceiptModal';

const INVOICE_TEMPLATES: Array<{
  id: InvoiceTemplateId;
  name: string;
  badge: string;
  description: string;
}> = [
  {
    id: 'CLASSIC_GST',
    name: 'Classic Agri-Tax A4',
    badge: 'Standard GST',
    description: 'Traditional centered header with full-bordered GST table, license bar, and signature block.',
  },
  {
    id: 'MODERN_CORPORATE',
    name: 'Modern Executive Brand',
    badge: 'Branded Banner',
    description: 'High-contrast colored brand header with logo card, invoice badge, and accented table header.',
  },
  {
    id: 'COMPACT_RETAIL',
    name: 'Compact Retail (Half-A4 / A5)',
    badge: 'Paper Saver',
    description: 'Space-saving two-column header and compact rows ideal for quick counter billing.',
  },
  {
    id: 'THERMAL_80MM',
    name: '80mm POS Thermal Receipt',
    badge: 'Thermal Roll',
    description: 'Narrow 80mm thermal roll layout with dashed dividers, GST summary, and UPI VPA.',
  },
];

const ACCENT_PRESETS = [
  { label: 'Emerald Agri', hex: '#15803d' },
  { label: 'Royal Blue', hex: '#1d4ed8' },
  { label: 'Deep Slate', hex: '#0f172a' },
  { label: 'Amber Gold', hex: '#b45309' },
  { label: 'Crimson Red', hex: '#b91c1c' },
  { label: 'Royal Purple', hex: '#6d28d9' },
];

const SAMPLE_PREVIEW_SALE: Sale = {
  id: 101,
  invoice_number: 'INV-202611-00101',
  invoice_date: '2026-11-22T10:30:00Z',
  customer_name: 'Rameshwar Patil',
  customer_phone: '9876543210',
  customer_address: 'A/P Niphad, Dist. Nashik',
  is_interstate: false,
  payment_mode: 'UPI',
  subtotal: 2450,
  total_taxable: 2310.95,
  total_cgst: 69.52,
  total_sgst: 69.53,
  total_igst: 0,
  gst_amount: 139.05,
  total_discount: 50,
  round_off: 0,
  grand_total: 2400,
  status: 'Completed',
  items: [
    {
      product_id: 1,
      product_name: 'IFFCO Nano Urea Liquid (500 ml)',
      batch_number: 'NU-2026-A9',
      expiry_date: '2028-06-30',
      hsn_code: '31021000',
      quantity: 4,
      unit: 'Bottles',
      unit_price: 225,
      mrp: 240,
      discount_percent: 0,
      discount_amount: 0,
      taxable_amount: 857.14,
      gst_rate: 5,
      cgst_amount: 21.43,
      sgst_amount: 21.43,
      igst_amount: 0,
      total_amount: 900,
    },
    {
      product_id: 2,
      product_name: 'Coragen Insecticide (150 ml)',
      batch_number: 'CRG-884',
      expiry_date: '2027-11-15',
      hsn_code: '38089199',
      quantity: 1,
      unit: 'Bottles',
      unit_price: 1550,
      mrp: 1650,
      discount_percent: 0,
      discount_amount: 0,
      taxable_amount: 1313.56,
      gst_rate: 18,
      cgst_amount: 118.22,
      sgst_amount: 118.22,
      igst_amount: 0,
      total_amount: 1550,
    },
  ],
};

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, refreshSettings } = useShop();
  const { user } = useAuth();
  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  const [activeTab, setActiveTab] = useState<'iam' | 'invoice' | 'general'>(isOwner ? 'iam' : 'general');
  const [form, setForm] = useState<ShopSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // IAM Users State
  const [iamUsers, setIamUsers] = useState<IamUser[]>([]);
  const [iamLoading, setIamLoading] = useState(false);
  const [iamError, setIamError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<IamUser | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);
  const [createdIamCreds, setCreatedIamCreds] = useState<{
    account_id: string;
    username: string;
    name: string;
    password: string;
    role: string;
    login_url: string;
  } | null>(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    role: 'STAFF' as 'OWNER' | 'STAFF',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    role: 'STAFF' as 'OWNER' | 'STAFF',
    is_active: true,
  });

  // Logo Upload State
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const shopAccountId =
    settings.shop_account_id || `SHOP-${String(settings.id || 1).padStart(5, '0')}`;
  const iamLoginUrl = `${window.location.origin}/login?account=${encodeURIComponent(shopAccountId)}`;

  const loadIamUsers = async () => {
    if (!isOwner) return;
    setIamLoading(true);
    setIamError(null);
    try {
      const list = await authApi.listUsers();
      setIamUsers(list);
    } catch (err: any) {
      setIamError(getErrorMessage(err, 'Failed to load IAM users'));
    } finally {
      setIamLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      void loadIamUsers();
    }
  }, [isOwner]);

  const handleCopyIamLink = () => {
    void navigator.clipboard?.writeText(iamLoginUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let cleaned = value;
    if (name === 'phone') {
      cleaned = sanitizePhoneInput(value);
    } else if (name === 'pincode') {
      cleaned = sanitizePincodeInput(value);
    } else if (name === 'gstin' || name === 'bank_ifsc' || name === 'invoice_prefix') {
      cleaned = sanitizeCodeInput(value, 25, true);
    } else if (name === 'terms_conditions') {
      cleaned = value.slice(0, 1500);
    } else if (name === 'invoice_header_tagline' || name === 'invoice_footer_note') {
      cleaned = sanitizeTextInput(value, 250);
    } else if (name === 'invoice_signature_label') {
      cleaned = sanitizeTextInput(value, 120);
    } else {
      cleaned = sanitizeTextInput(value, 200);
    }
    setForm((prev) => ({
      ...prev,
      [name]: cleaned,
    }));
    setIsSaved(false);
    setError(null);
  };

  const handleToggleField = (field: keyof ShopSettings, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: checked,
    }));
    setIsSaved(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setError(null);
    try {
      const updated = await settingsApi.uploadLogo(file);
      setForm(updated);
      await refreshSettings();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to upload shop logo.'));
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUploading(true);
    setError(null);
    try {
      const updated = await settingsApi.deleteLogo();
      setForm(updated);
      await refreshSettings();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to remove logo.'));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.shop_name || form.shop_name.trim().length < 2) {
      setError('Shop / Firm Name must be at least 2 characters.');
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }
    if (form.pincode && !isValidPincode(form.pincode)) {
      setError('Please enter a valid 6-digit Indian Pincode.');
      return;
    }
    if (form.gstin && !isValidGstin(form.gstin)) {
      setError('Please enter a valid alphanumeric GSTIN.');
      return;
    }
    if (form.bank_ifsc && !isValidIfsc(form.bank_ifsc)) {
      setError('IFSC code must be 11 characters (e.g., SBIN0001234).');
      return;
    }
    try {
      await updateSettings(form);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save shop settings'));
    }
  };

  const handleCreateIamUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIamError(null);
    if (createForm.username.trim().length < 3) {
      setIamError('IAM Username must be at least 3 characters.');
      return;
    }
    if (createForm.password.length < 6) {
      setIamError('Password must be at least 6 characters.');
      return;
    }
    if (createForm.phone && !isValidPhone(createForm.phone)) {
      setIamError('Please enter a valid 10-digit mobile number starting with 6-9.');
      return;
    }
    setIamLoading(true);
    try {
      const created = await authApi.createUser({
        name: createForm.name.trim(),
        username: createForm.username.trim().toLowerCase(),
        password: createForm.password,
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        role: createForm.role,
      });
      setCreatedIamCreds({
        account_id: created.shop_account_id || shopAccountId,
        username: created.username,
        name: created.name,
        password: createForm.password,
        role: created.role,
        login_url: iamLoginUrl,
      });
      setCreateForm({
        name: '',
        username: '',
        password: '',
        email: '',
        phone: '',
        role: 'STAFF',
      });
      setShowCreateModal(false);
      await loadIamUsers();
    } catch (err: any) {
      setIamError(getErrorMessage(err, 'Failed to create IAM user.'));
    } finally {
      setIamLoading(false);
    }
  };

  const openEditUserModal = (target: IamUser) => {
    setIamError(null);
    setEditingUser(target);
    setEditForm({
      name: target.name,
      username: target.username,
      password: '',
      email: target.email || '',
      phone: target.phone || '',
      role: target.role,
      is_active: target.is_active,
    });
  };

  const handleUpdateIamUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIamError(null);
    if (editForm.password && editForm.password.length < 6) {
      setIamError('New password must be at least 6 characters.');
      return;
    }
    if (editForm.phone && !isValidPhone(editForm.phone)) {
      setIamError('Please enter a valid 10-digit mobile number starting with 6-9.');
      return;
    }
    setIamLoading(true);
    try {
      await authApi.updateUser(editingUser.id, {
        name: editForm.name.trim(),
        username: editForm.username.trim().toLowerCase(),
        password: editForm.password.trim() || undefined,
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        is_active: editForm.is_active,
      });
      setEditingUser(null);
      await loadIamUsers();
    } catch (err: any) {
      setIamError(getErrorMessage(err, 'Failed to update IAM user.'));
    } finally {
      setIamLoading(false);
    }
  };

  const handleDeleteIamUser = async (userId: number) => {
    setIamLoading(true);
    setIamError(null);
    try {
      await authApi.deleteUser(userId);
      setConfirmDeleteUserId(null);
      await loadIamUsers();
    } catch (err: any) {
      setIamError(getErrorMessage(err, 'Failed to delete IAM user.'));
    } finally {
      setIamLoading(false);
    }
  };

  const downloadIamCsv = () => {
    if (!createdIamCreds) return;
    const headers = ['Shop Account ID', 'IAM Username', 'Initial Password', 'Full Name', 'Role', 'Console Sign-In URL'];
    const row = [
      `"${createdIamCreds.account_id}"`,
      `"${createdIamCreds.username}"`,
      `"${createdIamCreds.password}"`,
      `"${createdIamCreds.name}"`,
      `"${createdIamCreds.role}"`,
      `"${createdIamCreds.login_url}"`,
    ];
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), row.join(',')].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `${createdIamCreds.username}_iam_credentials.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const previewSale: Sale = {
    ...SAMPLE_PREVIEW_SALE,
    invoice_number: `${(form.invoice_prefix || 'INV').toUpperCase()}-202611-00101`,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Header & AWS-Style Shop Account ID Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Shop Management
            </h1>
            <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              {shopAccountId}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            IAM user access control, custom invoice builder &amp; templates, and general store settings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isSaved && (
            <div className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>Changes Saved!</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs">
            <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-300">IAM Console ID:</span>
            <strong className="font-mono text-emerald-300">{shopAccountId}</strong>
            <button
              type="button"
              onClick={handleCopyIamLink}
              className="ml-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLink ? 'Copied Link' : 'Copy Sign-In Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {isOwner && (
          <button
            type="button"
            onClick={() => setActiveTab('iam')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'iam'
                ? 'bg-brand-800 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1. IAM Users &amp; Console Access</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('invoice')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'invoice'
              ? 'bg-brand-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <LayoutTemplate className="w-4 h-4" />
          <span>2. Invoice Builder &amp; Templates</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'general'
              ? 'bg-brand-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>3. General Shop Settings</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =====================================================================
          TAB 1: IAM USERS & CONSOLE ACCESS (AWS-Style User Management)
      ===================================================================== */}
      {activeTab === 'iam' && isOwner && (
        <div className="space-y-5">
          {/* Newly Created IAM Credentials Download Banner */}
          {createdIamCreds && (
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-emerald-500/40 shadow-lg space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">
                      IAM User Created — Download Console Sign-In Credentials
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Share these AWS-style IAM sign-in details with <strong>{createdIamCreds.name}</strong>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatedIamCreds(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-black/40 p-3.5 rounded-xl border border-white/10 font-mono text-xs">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block">Shop Account ID</span>
                  <span className="font-bold text-emerald-300">{createdIamCreds.account_id}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block">IAM Username</span>
                  <span className="font-bold text-white">{createdIamCreds.username}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block">Initial Password</span>
                  <span className="font-bold text-amber-300">{createdIamCreds.password}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block">Access Role</span>
                  <span className="font-bold text-slate-200">{createdIamCreds.role}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-[11px] font-mono text-slate-300 truncate">
                  Sign-In URL: <strong className="text-emerald-400">{createdIamCreds.login_url}</strong>
                </span>
                <button
                  type="button"
                  onClick={downloadIamCsv}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download IAM Credentials (.CSV)</span>
                </button>
              </div>
            </div>
          )}

          {iamError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{iamError}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-700" />
                  <span>Shop IAM Users ({iamUsers.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Staff users sign in on the Login page under <strong>IAM Staff User</strong> using Shop Account ID{' '}
                  <code className="font-mono font-bold text-brand-800">{shopAccountId}</code> + their IAM username and password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIamError(null);
                  setShowCreateModal(true);
                }}
                className="bg-brand-700 hover:bg-brand-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create IAM User</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">User / Full Name</th>
                    <th className="py-3 px-4">IAM Username</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {iamUsers.map((u) => {
                    const isSelf = u.id === user?.id || u.username === user?.username;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                              You
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-brand-800">{u.username}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              u.role === 'OWNER'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {u.role === 'OWNER' ? 'OWNER (Admin)' : 'STAFF (Operator)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{u.phone || '-'}</div>
                          {u.email && <div className="text-[11px] text-slate-400">{u.email}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {u.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            {!isSelf && (
                              <>
                                {confirmDeleteUserId === u.id ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={iamLoading}
                                      onClick={() => {
                                        void handleDeleteIamUser(u.id);
                                      }}
                                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteUserId(null)}
                                      className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded-lg"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUserId(u.id)}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-semibold flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!iamLoading && iamUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No IAM users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: INVOICE BUILDER & TEMPLATES (With Live Interactive Preview)
      ===================================================================== */}
      {activeTab === 'invoice' && (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          {/* Left Column: Invoice Builder Controls */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Template Selection */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <LayoutTemplate className="w-4 h-4 text-brand-700" />
                <span>Select Invoice Template Model</span>
              </h3>
              <div className="space-y-2.5">
                {INVOICE_TEMPLATES.map((tpl) => {
                  const selected = (form.invoice_template || 'CLASSIC_GST') === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          invoice_template: tpl.id,
                          thermal_print: tpl.id === 'THERMAL_80MM',
                        }));
                        setIsSaved(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                        selected
                          ? 'border-brand-700 bg-brand-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">{tpl.name}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            selected ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{tpl.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Shop Logo & Brand Color */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Palette className="w-4 h-4 text-brand-700" />
                <span>Shop Logo &amp; Brand Theme</span>
              </h3>

              <div className="space-y-2">
                <label htmlFor="invoice-logo-upload" className="block font-semibold text-slate-700">
                  Shop Logo (PNG, JPG, WebP up to 2 MB)
                </label>
                <div className="flex items-center gap-3">
                  {form.logo_path ? (
                    <div className="h-14 w-24 rounded-xl border border-slate-200 bg-slate-50 p-1.5 flex items-center justify-center shrink-0">
                      <img src={form.logo_path} alt="Shop Logo" className="max-h-11 max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-14 w-24 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                      No Logo
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <label
                      htmlFor="invoice-logo-upload"
                      className="cursor-pointer px-3 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{logoUploading ? 'Uploading...' : 'Upload Logo'}</span>
                    </label>
                    <input
                      id="invoice-logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        void handleLogoUpload(e);
                      }}
                      className="hidden"
                    />
                    {form.logo_path && (
                      <button
                        type="button"
                        disabled={logoUploading}
                        onClick={() => {
                          void handleRemoveLogo();
                        }}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="builder-accent-color" className="block font-semibold text-slate-700 mb-1.5">
                  Brand Accent Color
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, invoice_accent_color: preset.hex }));
                        setIsSaved(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 ${
                        (form.invoice_accent_color || '#15803d') === preset.hex
                          ? 'border-slate-900 ring-2 ring-slate-900/15 bg-slate-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.hex }} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                  <input
                    id="builder-accent-color"
                    type="color"
                    value={form.invoice_accent_color || '#15803d'}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, invoice_accent_color: e.target.value }));
                      setIsSaved(false);
                    }}
                    className="h-8 w-10 rounded cursor-pointer border border-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* 3. Section Visibility Toggles & Custom Text */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <FileText className="w-4 h-4 text-brand-700" />
                <span>Invoice Fields, Toggles &amp; Terms</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label htmlFor="toggle-show-logo" className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    id="toggle-show-logo"
                    type="checkbox"
                    checked={form.invoice_show_logo !== false}
                    onChange={(e) => handleToggleField('invoice_show_logo', e.target.checked)}
                    className="rounded text-brand-700"
                  />
                  <span>Show Shop Logo</span>
                </label>
                <label htmlFor="toggle-show-licenses" className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    id="toggle-show-licenses"
                    type="checkbox"
                    checked={form.invoice_show_licenses !== false}
                    onChange={(e) => handleToggleField('invoice_show_licenses', e.target.checked)}
                    className="rounded text-brand-700"
                  />
                  <span>Show Agri Licenses</span>
                </label>
                <label htmlFor="toggle-show-bank" className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    id="toggle-show-bank"
                    type="checkbox"
                    checked={form.invoice_show_bank_details !== false}
                    onChange={(e) => handleToggleField('invoice_show_bank_details', e.target.checked)}
                    className="rounded text-brand-700"
                  />
                  <span>Show Bank &amp; UPI</span>
                </label>
                <label htmlFor="toggle-show-batch" className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    id="toggle-show-batch"
                    type="checkbox"
                    checked={form.invoice_show_batch_expiry !== false}
                    onChange={(e) => handleToggleField('invoice_show_batch_expiry', e.target.checked)}
                    className="rounded text-brand-700"
                  />
                  <span>Show Batch &amp; Expiry</span>
                </label>
                <label htmlFor="toggle-show-hsn" className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    id="toggle-show-hsn"
                    type="checkbox"
                    checked={form.invoice_show_hsn !== false}
                    onChange={(e) => handleToggleField('invoice_show_hsn', e.target.checked)}
                    className="rounded text-brand-700"
                  />
                  <span>Show HSN Column</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="builder-invoice-prefix" className="block font-semibold text-slate-700 mb-1">
                    Invoice Prefix
                  </label>
                  <input
                    id="builder-invoice-prefix"
                    type="text"
                    name="invoice_prefix"
                    value={form.invoice_prefix}
                    onChange={handleChange}
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="builder-signature-label" className="block font-semibold text-slate-700 mb-1">
                    Signature Label
                  </label>
                  <input
                    id="builder-signature-label"
                    type="text"
                    name="invoice_signature_label"
                    value={form.invoice_signature_label || ''}
                    onChange={handleChange}
                    placeholder="Authorized Signatory"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="builder-header-tagline" className="block font-semibold text-slate-700 mb-1">
                  Header Tagline / Dealer Subtitle
                </label>
                <input
                  id="builder-header-tagline"
                  type="text"
                  name="invoice_header_tagline"
                  value={form.invoice_header_tagline || ''}
                  onChange={handleChange}
                  placeholder="e.g. Authorized Dealer of IFFCO, Bayer & Syngenta Crop Care"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="builder-footer-note" className="block font-semibold text-slate-700 mb-1">
                  Footer Greeting Note
                </label>
                <input
                  id="builder-footer-note"
                  type="text"
                  name="invoice_footer_note"
                  value={form.invoice_footer_note || ''}
                  onChange={handleChange}
                  placeholder="Thank you for your business! Visit again."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="builder-terms" className="block font-semibold text-slate-700 mb-1">
                  Printed Terms &amp; Conditions
                </label>
                <textarea
                  id="builder-terms"
                  rows={3}
                  name="terms_conditions"
                  value={form.terms_conditions || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-3 px-6 rounded-xl shadow flex items-center justify-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Invoice Template &amp; Builder Settings</span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Interactive Invoice Preview */}
          <div className="lg:col-span-7">
            <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl sticky top-4 space-y-3">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs sm:text-sm">Live Interactive Invoice Preview</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                  {INVOICE_TEMPLATES.find((t) => t.id === (form.invoice_template || 'CLASSIC_GST'))?.name}
                </span>
              </div>
              <div className="bg-slate-100 p-3 sm:p-5 rounded-xl overflow-y-auto max-h-[78vh]">
                <InvoiceDocumentView sale={previewSale} settings={form} />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* =====================================================================
          TAB 3: GENERAL SHOP SETTINGS
      ===================================================================== */}
      {activeTab === 'general' && (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6 text-xs">
          {/* Shop & Proprietor Info */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building className="w-4 h-4 text-brand-700" />
              <span>Shop &amp; Agricultural License Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="settings-shop-name" className="block font-semibold text-slate-700 mb-1">
                  Shop / Firm Name *
                </label>
                <input
                  id="settings-shop-name"
                  type="text"
                  required
                  name="shop_name"
                  value={form.shop_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-proprietor-name" className="block font-semibold text-slate-700 mb-1">
                  Proprietor / Owner Name *
                </label>
                <input
                  id="settings-proprietor-name"
                  type="text"
                  required
                  name="proprietor_name"
                  value={form.proprietor_name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="settings-gstin" className="block font-semibold text-slate-700 mb-1">
                  GSTIN (15 Digits)
                </label>
                <input
                  id="settings-gstin"
                  type="text"
                  name="gstin"
                  value={form.gstin || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-phone" className="block font-semibold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  required
                  name="phone"
                  value={form.phone || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-email" className="block font-semibold text-slate-700 mb-1">
                  Shop Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  name="email"
                  value={form.email || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="settings-fertilizer-license" className="block font-semibold text-slate-700 mb-1">
                  Fertilizer License No.
                </label>
                <input
                  id="settings-fertilizer-license"
                  type="text"
                  name="fertilizer_license_no"
                  value={form.fertilizer_license_no || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="FL/2026/..."
                />
              </div>
              <div>
                <label htmlFor="settings-pesticide-license" className="block font-semibold text-slate-700 mb-1">
                  Pesticide License No.
                </label>
                <input
                  id="settings-pesticide-license"
                  type="text"
                  name="pesticide_license_no"
                  value={form.pesticide_license_no || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="PL/2026/..."
                />
              </div>
              <div>
                <label htmlFor="settings-seed-license" className="block font-semibold text-slate-700 mb-1">
                  Seed License No.
                </label>
                <input
                  id="settings-seed-license"
                  type="text"
                  name="seed_license_no"
                  value={form.seed_license_no || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="SL/2026/..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="settings-address" className="block font-semibold text-slate-700 mb-1">
                  Address Line 1 *
                </label>
                <input
                  id="settings-address"
                  type="text"
                  required
                  name="address_line1"
                  value={form.address_line1 || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-city" className="block font-semibold text-slate-700 mb-1">
                  City / Town
                </label>
                <input
                  id="settings-city"
                  type="text"
                  name="city"
                  value={form.city || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-pincode" className="block font-semibold text-slate-700 mb-1">
                  Pincode *
                </label>
                <input
                  id="settings-pincode"
                  type="text"
                  required
                  name="pincode"
                  value={form.pincode || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bank & Payment Details */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Landmark className="w-4 h-4 text-brand-700" />
              <span>Bank &amp; UPI Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="settings-bank-name" className="block font-semibold text-slate-700 mb-1">
                  Bank Name
                </label>
                <input
                  id="settings-bank-name"
                  type="text"
                  name="bank_name"
                  value={form.bank_name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-bank-account" className="block font-semibold text-slate-700 mb-1">
                  Account Number
                </label>
                <input
                  id="settings-bank-account"
                  type="text"
                  name="bank_account_no"
                  value={form.bank_account_no || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="settings-bank-ifsc" className="block font-semibold text-slate-700 mb-1">
                  IFSC Code
                </label>
                <input
                  id="settings-bank-ifsc"
                  type="text"
                  name="bank_ifsc"
                  value={form.bank_ifsc || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-upi-id" className="block font-semibold text-slate-700 mb-1">
                  UPI ID (VPA)
                </label>
                <input
                  id="settings-upi-id"
                  type="text"
                  name="upi_id"
                  value={form.upi_id || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-brand-700 hover:bg-brand-800 text-white font-bold py-3 px-6 rounded-xl shadow flex items-center gap-2 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save General Shop Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          MODAL: CREATE IAM USER
      ===================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-700" />
                <h3 className="text-base font-bold text-slate-900">Create Shop IAM User</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { void handleCreateIamUser(e); }} className="space-y-3.5">
              <div>
                <label htmlFor="iam-create-name" className="block font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  id="iam-create-name"
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Ravi Kumar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="iam-create-username" className="block font-bold text-slate-700 mb-1">
                    IAM Username *
                  </label>
                  <input
                    id="iam-create-username"
                    type="text"
                    required
                    minLength={3}
                    value={createForm.username}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        username: sanitizeCodeInput(e.target.value, 40, false).replace(/\s+/g, '').toLowerCase(),
                      })
                    }
                    placeholder="e.g. cashier_ravi"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="iam-create-role" className="block font-bold text-slate-700 mb-1">
                    Access Role *
                  </label>
                  <select
                    id="iam-create-role"
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, role: e.target.value as 'OWNER' | 'STAFF' })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="STAFF">STAFF (Billing &amp; Inventory)</option>
                    <option value="OWNER">OWNER (Full Admin)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="iam-create-password" className="block font-bold text-slate-700 mb-1">
                  Initial Password * (min 6 chars)
                </label>
                <input
                  id="iam-create-password"
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Enter initial IAM password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="iam-create-phone" className="block font-bold text-slate-700 mb-1">
                    Mobile Number (Optional)
                  </label>
                  <input
                    id="iam-create-phone"
                    type="tel"
                    maxLength={10}
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, phone: sanitizePhoneInput(e.target.value) })
                    }
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="iam-create-email" className="block font-bold text-slate-700 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    id="iam-create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="staff@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={iamLoading}
                  className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl font-bold"
                >
                  {iamLoading ? 'Creating...' : 'Create IAM User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EDIT IAM USER
      ===================================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Edit IAM User: {editingUser.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { void handleUpdateIamUser(e); }} className="space-y-3.5">
              <div>
                <label htmlFor="iam-edit-name" className="block font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  id="iam-edit-name"
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="iam-edit-username" className="block font-bold text-slate-700 mb-1">
                    IAM Username *
                  </label>
                  <input
                    id="iam-edit-username"
                    type="text"
                    required
                    minLength={3}
                    value={editForm.username}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        username: sanitizeCodeInput(e.target.value, 40, false).replace(/\s+/g, '').toLowerCase(),
                      })
                    }
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="iam-edit-role" className="block font-bold text-slate-700 mb-1">
                    Access Role
                  </label>
                  <select
                    id="iam-edit-role"
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value as 'OWNER' | 'STAFF' })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="STAFF">STAFF (Billing &amp; Inventory)</option>
                    <option value="OWNER">OWNER (Full Admin)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="iam-edit-password" className="block font-bold text-slate-700 mb-1">
                  Reset Password (leave blank to keep current password)
                </label>
                <input
                  id="iam-edit-password"
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="New password (min 6 chars)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="iam-edit-phone" className="block font-bold text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    id="iam-edit-phone"
                    type="tel"
                    maxLength={10}
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: sanitizePhoneInput(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="iam-edit-email" className="block font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    id="iam-edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <label htmlFor="iam-edit-active" className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer pt-1">
                <input
                  id="iam-edit-active"
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="rounded text-brand-700"
                />
                <span>Account Active (uncheck to suspend IAM console login immediately)</span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={iamLoading}
                  className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl font-bold"
                >
                  {iamLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
