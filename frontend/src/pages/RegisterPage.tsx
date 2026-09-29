import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Sprout, User, Lock, Phone, Mail, Building, MapPin, 
  FileText, CreditCard, ShieldCheck, Download, CheckCircle2, 
  ArrowRight, ArrowLeft, AlertCircle, Copy, Check, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { getErrorMessage } from '../api';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { refreshSettings } = useShop();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Owner Info
    owner_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',

    // Step 2: Shop Details
    shop_name: '',
    proprietor_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    gstin: '',
    invoice_prefix: 'KSK',

    // Step 3: Licenses & Banking
    fertilizer_license_no: '',
    pesticide_license_no: '',
    seed_license_no: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    bank_branch: '',
    upi_id: '',
  });

  // Post-registration credentials state
  const [generatedCreds, setGeneratedCreds] = useState<any | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.owner_name.trim()) {
      setError('Please enter the shop owner or manager name');
      return;
    }
    if (!formData.username.trim() || formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!formData.phone.trim() || formData.phone.length < 10) {
      setError('Please provide a valid 10-digit mobile number for OTP and password recovery');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Please enter a valid email address for reports and alerts');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.shop_name.trim()) {
      setError('Please enter your Shop or Agro Agency Name');
      return;
    }
    if (!formData.address_line1.trim()) {
      setError('Please provide the primary shop address');
      return;
    }
    if (!formData.city.trim()) {
      setError('City / Town is required');
      return;
    }
    if (!formData.pincode.trim() || formData.pincode.length < 6) {
      setError('Valid 6-digit Pincode is required');
      return;
    }
    setStep(3);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = {
        owner_name: formData.owner_name,
        username: formData.username.toLowerCase().trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        shop_name: formData.shop_name.trim(),
        proprietor_name: formData.proprietor_name || formData.owner_name,
        address_line1: formData.address_line1.trim(),
        address_line2: formData.address_line2.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        gstin: formData.gstin.trim().toUpperCase() || undefined,
        invoice_prefix: (formData.invoice_prefix || 'KSK').trim().toUpperCase(),
        fertilizer_license_no: formData.fertilizer_license_no.trim() || undefined,
        pesticide_license_no: formData.pesticide_license_no.trim() || undefined,
        seed_license_no: formData.seed_license_no.trim() || undefined,
        bank_name: formData.bank_name.trim() || undefined,
        bank_account_no: formData.bank_account_no.trim() || undefined,
        bank_ifsc: formData.bank_ifsc.trim().toUpperCase() || undefined,
        bank_branch: formData.bank_branch.trim() || undefined,
        upi_id: formData.upi_id.trim() || undefined,
      };

      const res = await register(payload);
      await refreshSettings();
      setGeneratedCreds(res.credentials || {
        account_id: `SHOP-${res.user_id || '001'}`,
        shop_name: formData.shop_name,
        owner_name: formData.owner_name,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        initial_password: formData.password,
        console_login_url: `${window.location.origin}/login`,
        gstin: formData.gstin || 'UNREGISTERED',
        fertilizer_license: formData.fertilizer_license_no || 'N/A',
        created_at: new Date().toISOString()
      });
      setStep(4);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to register shop account. Please verify all details.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Download credentials in AWS IAM CSV Format
  const downloadCredentialsCsv = () => {
    if (!generatedCreds) return;
    const headers = ['User name', 'Password', 'Access URL', 'Account ID', 'Shop Name', 'Owner Name', 'Email', 'Phone', 'GSTIN', 'Fertilizer License', 'Created At'];
    const row = [
      `"${generatedCreds.username}"`,
      `"${generatedCreds.initial_password}"`,
      `"${generatedCreds.console_login_url}"`,
      `"${generatedCreds.account_id}"`,
      `"${generatedCreds.shop_name}"`,
      `"${generatedCreds.owner_name}"`,
      `"${generatedCreds.email}"`,
      `"${generatedCreds.phone}"`,
      `"${generatedCreds.gstin}"`,
      `"${generatedCreds.fertilizer_license}"`,
      `"${generatedCreds.created_at}"`
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), row.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${generatedCreds.username}_credentials.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download credentials in formatted Text Receipt
  const downloadCredentialsTxt = () => {
    if (!generatedCreds) return;
    const txtContent = `==================================================================
           KISAN SEVA KENDRA - SHOP ACCESS CREDENTIALS
==================================================================
Shop Name:          ${generatedCreds.shop_name}
Shop Account ID:    ${generatedCreds.account_id}
Console Login URL:  ${generatedCreds.console_login_url}

[OWNER ACCESS KEYS]
Username:           ${generatedCreds.username}
Initial Password:   ${generatedCreds.initial_password}
Registered Mobile:  ${generatedCreds.phone}
Registered Email:   ${generatedCreds.email}
Role:               OWNER (Full Master Administrative Privileges)

[SHOP REGISTRATION & LICENSES]
Proprietor:         ${generatedCreds.owner_name}
GSTIN:              ${generatedCreds.gstin}
Fertilizer Lic:     ${generatedCreds.fertilizer_license}
Generated At:       ${generatedCreds.created_at}

SECURITY WARNING:
Treat this file as your official shop master access key.
Store it in a secure business vault. Never transmit master
passwords across unencrypted emails or chat messages.
==================================================================
`;
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedCreds.username}_shop_credentials.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyCredentialsText = () => {
    if (!generatedCreds) return;
    const text = `Shop: ${generatedCreds.shop_name}\nUsername: ${generatedCreds.username}\nPassword: ${generatedCreds.initial_password}\nLogin URL: ${generatedCreds.console_login_url}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-green-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl mb-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-3 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-700 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-brand-900/20 group-hover:scale-105 transition-transform">
            <Sprout className="w-7 h-7" />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">Kisan Seva Kendra</span>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {step === 4 ? 'Shop Registration Complete' : 'Register Your Agro & Fertilizer Shop'}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          {step === 4 
            ? 'Download your secure master credentials and start billing.' 
            : 'Get ready for GST-compliant fertilizer billing, batch tracking, and scannable barcodes in minutes.'}
        </p>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === 1 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/30' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              <span>Owner Account</span>
            </div>
            <div className="w-6 h-0.5 bg-slate-300"></div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === 2 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/30' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              <span>Shop Info</span>
            </div>
            <div className="w-6 h-0.5 bg-slate-300"></div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === 3 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/30' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
              <span>Licenses & Banking</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="clay-card-pillowy p-6 sm:p-9 border border-white/80">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: OWNER ACCOUNT */}
          {step === 1 && (
            <form onSubmit={handleNextStep1} className="space-y-4">
              <div className="border-b border-slate-200/80 pb-3 mb-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-brand-700" />
                  Owner & Security Credentials
                </h3>
                <p className="text-xs text-slate-500">
                  These details will be used to generate your primary administrative access keys.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name of Owner / Proprietor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="owner_name"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={formData.owner_name}
                  onChange={handleChange}
                  className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Master Username <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      name="username"
                      required
                      placeholder="e.g. ramesh_agro"
                      value={formData.username}
                      onChange={handleChange}
                      className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Unique shop administrator login ID</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="tel"
                      name="phone"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={handleChange}
                      className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Required for OTP & password resets</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="e.g. ramesh.agro@gmail.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Used for daily sales summaries and security alerts</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Master Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={handleChange}
                      className="clay-input w-full pl-10 pr-10 py-3 text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirm_password"
                      required
                      placeholder="Re-type password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <Link to="/login" className="text-xs font-semibold text-slate-600 hover:text-brand-700">
                  Already have an account? Sign In
                </Link>
                <button
                  type="submit"
                  className="clay-btn-primary px-6 py-3 text-sm flex items-center gap-2"
                >
                  <span>Continue to Shop Info</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: SHOP & BUSINESS INFO */}
          {step === 2 && (
            <form onSubmit={handleNextStep2} className="space-y-4">
              <div className="border-b border-slate-200/80 pb-3 mb-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-brand-700" />
                  Shop & Business Information
                </h3>
                <p className="text-xs text-slate-500">
                  This appears on customer GST invoices, thermal bills, and tax reports.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Shop / Agency Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="shop_name"
                  required
                  placeholder="e.g. Kisan Seva Kendra & Fertilizer Mart"
                  value={formData.shop_name}
                  onChange={handleChange}
                  className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    GSTIN Number (Optional)
                  </label>
                  <input
                    type="text"
                    name="gstin"
                    maxLength={15}
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    value={formData.gstin}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm uppercase text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">15-digit GST identification number</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Invoice Number Prefix
                  </label>
                  <input
                    type="text"
                    name="invoice_prefix"
                    maxLength={6}
                    placeholder="e.g. KSK or INV"
                    value={formData.invoice_prefix}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm uppercase text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">e.g. KSK-202609-00001</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    name="address_line1"
                    required
                    placeholder="Shop No., Market Yard / APMC Road"
                    value={formData.address_line1}
                    onChange={handleChange}
                    className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    City / Town <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    required
                    placeholder="e.g. Nashik"
                    value={formData.city}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    required
                    placeholder="e.g. Maharashtra"
                    value={formData.state}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    required
                    maxLength={6}
                    placeholder="e.g. 422001"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="clay-btn-secondary px-5 py-3 text-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="clay-btn-primary px-6 py-3 text-sm flex items-center gap-2"
                >
                  <span>Continue to Licenses</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: LICENSES & BANKING */}
          {step === 3 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="border-b border-slate-200/80 pb-3 mb-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-700" />
                  Agricultural Licenses & Banking
                </h3>
                <p className="text-xs text-slate-500">
                  Department of Agriculture compliance numbers & UPI details for customer QR codes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fertilizer License No.
                  </label>
                  <input
                    type="text"
                    name="fertilizer_license_no"
                    placeholder="e.g. FL/2026/8941"
                    value={formData.fertilizer_license_no}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pesticide License No.
                  </label>
                  <input
                    type="text"
                    name="pesticide_license_no"
                    placeholder="e.g. PL/2026/3312"
                    value={formData.pesticide_license_no}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Seed License No.
                  </label>
                  <input
                    type="text"
                    name="seed_license_no"
                    placeholder="e.g. SL/2026/1029"
                    value={formData.seed_license_no}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200/60 pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Banking & QR Code Payments (Optional)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Shop UPI ID (for QR Billing)
                    </label>
                    <input
                      type="text"
                      name="upi_id"
                      placeholder="e.g. kisanseva@okhdfcbank"
                      value={formData.upi_id}
                      onChange={handleChange}
                      className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      name="bank_name"
                      placeholder="e.g. State Bank of India"
                      value={formData.bank_name}
                      onChange={handleChange}
                      className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      name="bank_account_no"
                      placeholder="e.g. 30981290312"
                      value={formData.bank_account_no}
                      onChange={handleChange}
                      className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      name="bank_ifsc"
                      placeholder="e.g. SBIN0001234"
                      value={formData.bank_ifsc}
                      onChange={handleChange}
                      className="clay-input w-full px-4 py-3 text-sm uppercase text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="clay-btn-secondary px-5 py-3 text-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="clay-btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: AWS STYLE CREDENTIALS DOWNLOAD */}
          {step === 4 && generatedCreds && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              {/* Top Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    Your Shop Account is Created Successfully!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Your official master access keys and shop credentials have been generated. Download your access key file below for secure record-keeping.
                  </p>
                </div>
              </div>

              {/* Master Credential Card */}
              <div className="clay-card-dark p-6 rounded-3xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-mono tracking-widest uppercase text-emerald-400 font-bold">
                      Business Master Key
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {generatedCreds.account_id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Shop Name</span>
                    <span className="text-white font-bold text-sm">{generatedCreds.shop_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Owner Username</span>
                    <span className="text-emerald-300 font-bold text-sm">{generatedCreds.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Registered Mobile</span>
                    <span className="text-slate-200">{generatedCreds.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Registered Email</span>
                    <span className="text-slate-200">{generatedCreds.email}</span>
                  </div>
                  <div className="sm:col-span-2 p-3 bg-black/40 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Master Password</span>
                      <span className="text-amber-300 font-bold text-base tracking-wider">
                        {generatedCreds.initial_password}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyCredentialsText}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-sans flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="font-bold text-slate-300">Login URL: </span>
                  <span className="text-emerald-400">{generatedCreds.console_login_url}</span>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={downloadCredentialsCsv}
                  className="clay-btn-primary py-3.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Credentials (.CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={downloadCredentialsTxt}
                  className="clay-btn-secondary py-3.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Download Receipt (.TXT)</span>
                </button>
              </div>

              {/* Proceed to Dashboard CTA */}
              <div className="pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-slate-500 text-center sm:text-left">
                  You are automatically authenticated as <strong>{generatedCreds.username}</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/subscription')}
                  className="w-full sm:w-auto px-7 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all"
                >
                  <span>Proceed to Payment & Activate License</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
