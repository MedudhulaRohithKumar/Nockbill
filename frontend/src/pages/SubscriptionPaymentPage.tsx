import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, CheckCircle2, QrCode, CreditCard, Building2, 
  ArrowRight, Sparkles, AlertCircle, Check, Lock, 
  RefreshCw, Gift, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { getErrorMessage } from '../api';

export const SubscriptionPaymentPage: React.FC = () => {
  const { user, activateSubscription, logout } = useAuth();
  const { settings } = useShop();
  const navigate = useNavigate();

  // Plan Selection: 'trial' (1-Month Free Tier) | 'monthly' | 'annual'
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'monthly' | 'annual'>('trial');

  // Payment Method Selection: UPI | CARD | NETBANKING
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');

  // Form states
  const [upiId, setUpiId] = useState('dealer@okaxis');
  const [cardNumber, setCardNumber] = useState('4532 8910 2341 7890');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('781');
  const [selectedBank, setSelectedBank] = useState('State Bank of India');

  // Processing & Success states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = {
    trial: {
      id: 'plan_trial_1m',
      name: '1-Month Free Trial (All Features)',
      basePrice: 0,
      gst: 0,
      total: 0,
      cycle: '30 Days Full Access (₹0 Due Today)',
      badge: '1 MONTH FREE',
      features: [
        'Full Access to All ERP Features',
        'Unlimited GST & POS Invoicing (Microsecond Billing)',
        'Statutory Form O Register & FCO 1985 Compliance',
        'Farmer Khata Ledger & Automated WhatsApp Reminders',
        'Barcode Sticker Generation & Scanner Integration',
        'Multi-Device Cloud Backup & Batch FEFO Expiry Radar',
        'Instant 1-Click Activation (No Credit Card / UPI Required)',
      ],
    },
    monthly: {
      id: 'plan_starter_monthly',
      name: 'NockBill Starter (Monthly)',
      basePrice: 999,
      gst: 179.82,
      total: 1178.82,
      cycle: 'Billed monthly',
      badge: 'MONTHLY',
      features: [
        'Unlimited GST & POS Invoicing',
        'Code-128 Barcode Sticker Printing (50x25mm)',
        'Sales Returns & Inventory Restocking',
        'Farmer Khata & Multi-Payment Split',
        'Government License Compliance Printouts',
      ],
    },
    annual: {
      id: 'plan_pro_annual',
      name: 'NockBill Pro (Annual)',
      basePrice: 7999,
      gst: 1439.82,
      total: 9438.82,
      cycle: 'Billed annually (Save 33%)',
      badge: 'SAVE 33%',
      features: [
        'Everything in Monthly Starter',
        'Priority Phone & WhatsApp Support',
        'Custom HSN Code & Batch Expiry Alerts',
        'Multi-Device Backup & Cloud Sync',
        'Free 1,000 Thermal Sticker Roll Starter Kit',
      ],
    },
  };

  const currentPlan = plans[selectedPlan];

  const handleActivate = async () => {
    setError(null);
    setIsProcessing(true);

    try {
      const isFreeTrial = selectedPlan === 'trial';
      setProcessingStep(
        isFreeTrial
          ? 'Activating 1-Month Free Trial (All Features Included)...'
          : 'Processing payment verification...'
      );
      await new Promise((r) => setTimeout(r, 600));

      const paymentRef = isFreeTrial
        ? `TRIAL-1M-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`
        : `PAY-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Backend Activation Call
      const res = await activateSubscription({
        plan_id: currentPlan.id,
        plan_name: currentPlan.name,
        amount: currentPlan.total,
        payment_method: isFreeTrial ? 'FREE_TRIAL' : paymentMethod,
        payment_ref: paymentRef,
      });

      setPaymentSuccess({
        paymentRef: res.payment_ref || paymentRef,
        planName: currentPlan.name,
        amount: currentPlan.total,
        shopName: settings.shop_name || 'My Fertilizer Shop',
        date: new Date().toLocaleString(),
        isTrial: isFreeTrial,
        method: isFreeTrial ? '1-Month Free Trial' : paymentMethod,
      });
    } catch (err: any) {
      setError(getErrorMessage(err, 'Activation failed. Please try again or choose the 1-Month Free Trial.'));
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Soft Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto relative z-10">
        {/* Top Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold mb-3">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span>Early Access: 1-Month Free Trial Available (All Features Included)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Activate Your Shop Cloud License
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Unlock POS billing, batch management, Form O statutory compliance, and barcode printing for{' '}
            <strong className="text-emerald-300">{settings.shop_name || user?.full_name}</strong>.
          </p>
        </div>

        {/* Payment Success View */}
        {paymentSuccess ? (
          <div className="clay-card-pillowy max-w-xl mx-auto p-8 text-center text-slate-900 border border-white/90 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="clay-badge px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black uppercase inline-block mb-2">
              {paymentSuccess.isTrial ? '1-Month Free Trial Activated' : 'Store License Activated'}
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {paymentSuccess.isTrial ? 'Free Trial Activated Successfully!' : 'Store License Activated!'}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {paymentSuccess.isTrial
                ? 'Your store now has 30 days of full, unrestricted access to all NockBill ERP features.'
                : 'Your store license is active and synced with the cloud.'}
            </p>

            {/* Receipt Summary Card */}
            <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left font-mono text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Activation Mode:</span>
                <span className="font-bold text-emerald-700">{paymentSuccess.method}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Transaction Ref:</span>
                <span className="font-bold text-slate-900">{paymentSuccess.paymentRef}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Shop Name:</span>
                <span className="font-bold text-slate-900">{paymentSuccess.shopName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Selected Plan:</span>
                <span className="font-bold text-emerald-700">{paymentSuccess.planName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Amount Charged:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {paymentSuccess.amount === 0 ? '₹0.00 (100% Free Trial)' : `₹${paymentSuccess.amount.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">License Status:</span>
                <span className="font-bold text-emerald-600">Active • 30 Days Included</span>
              </div>
            </div>

            {/* Action to Launch */}
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="clay-btn-primary w-full py-4 px-6 text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xl cursor-pointer"
            >
              <span>Enter Shop POS &amp; Dashboard</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          /* Main Two-Column Gateway */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Plan Selector & Summary */}
            <div className="lg:col-span-5 space-y-4">
              <div className="clay-card-dark p-6 rounded-3xl border border-white/10 space-y-4">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Select Business Plan
                </h3>

                {/* 3-Way Plan Toggle: Free Trial (Default) | Monthly | Annual */}
                <div className="grid grid-cols-3 gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('trial')}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all relative cursor-pointer ${
                      selectedPlan === 'trial'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1-Mo Free
                    <span className="absolute -top-2.5 -right-1 px-1.5 py-0.2 bg-emerald-400 text-slate-950 font-black text-[8px] rounded-full uppercase">
                      FREE
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPlan('monthly')}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      selectedPlan === 'monthly'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Monthly
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPlan('annual')}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all relative cursor-pointer ${
                      selectedPlan === 'annual'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Annual Pro
                    <span className="absolute -top-2.5 -right-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black text-[8px] rounded-full">
                      -33%
                    </span>
                  </button>
                </div>

                {/* Plan Price & Details */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      {selectedPlan === 'trial' ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-emerald-400">₹0</span>
                          <span className="text-xs text-emerald-300/80 font-bold">100% Free</span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-xl font-black text-white">₹{currentPlan.basePrice}</span>
                          <span className="text-xs text-slate-400"> + 18% GST</span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-emerald-400 font-semibold">{currentPlan.cycle}</span>
                  </div>

                  {/* Included features */}
                  <div className="space-y-2 pt-2 border-t border-white/10 text-xs text-slate-300">
                    {currentPlan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tax Invoice Breakdown */}
                <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5 font-mono text-xs space-y-1.5 text-slate-400">
                  <div className="flex justify-between">
                    <span>Base Subscription:</span>
                    <span className="text-slate-200">₹{currentPlan.basePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (18% IGST / CGST+SGST):</span>
                    <span className="text-slate-200">₹{currentPlan.gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white pt-1.5 border-t border-white/10 text-sm">
                    <span>Total Amount Payable:</span>
                    <span className="text-emerald-400">
                      {currentPlan.total === 0 ? '₹0.00 (FREE TRIAL)' : `₹${currentPlan.total.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security / Logout Badge */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>GST Registered &amp; Encrypted</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </div>

            {/* Right Column: Checkout or 1-Click Free Trial Activation */}
            <div className="lg:col-span-7">
              <div className="clay-card-pillowy p-6 sm:p-8 text-slate-900 border border-white/90 shadow-2xl">
                
                {/* ── MODE A: 1-MONTH FREE TRIAL ACTIVATION ── */}
                {selectedPlan === 'trial' ? (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase mb-1">
                          <Gift className="w-3.5 h-3.5 text-emerald-600" />
                          <span>No Credit Card / UPI Required</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">
                          1-Month Free Trial Activation
                        </h3>
                        <p className="text-xs text-slate-500">
                          Instant access to all NockBill ERP features for 30 days
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Due</span>
                        <span className="text-xl font-black text-emerald-600">₹0.00</span>
                      </div>
                    </div>

                    {error && (
                      <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Free Trial Value Callouts */}
                    <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <Zap className="w-4 h-4 text-emerald-600" />
                        <span>All Features Completely Unlocked for 30 Days:</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Fast 3-Sec POS Invoicing</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Statutory Form O Book</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Farmer Khata &amp; WhatsApp Alerts</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Batch FEFO Expiry Radar</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Barcode Label Printing</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Cloud Backup &amp; Sync</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Early Access Allocation:</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        Available for up to 2 new stores
                      </span>
                    </div>

                    {/* Submit 1-Click Free Trial Activation */}
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          void handleActivate();
                        }}
                        className="clay-btn-primary w-full py-4 text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-75 cursor-pointer"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span>{processingStep || 'Activating 1-Month Free Trial...'}</span>
                          </>
                        ) : (
                          <>
                            <Gift className="w-4 h-4" />
                            <span>Start 1-Month Free Trial (All Features) →</span>
                          </>
                        )}
                      </button>

                      <div className="text-center pt-2">
                        <p className="text-xs text-slate-500">
                          100% Free • No payment details needed • Instant activation
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── MODE B: PAID PAYMENT GATEWAY CHECKOUT ── */
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          Payment Checkout
                        </h3>
                        <p className="text-xs text-slate-500">
                          Choose your preferred payment method below
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Due</span>
                        <span className="text-lg font-black text-emerald-700">₹{currentPlan.total.toFixed(2)}</span>
                      </div>
                    </div>

                    {error && (
                      <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Switch to Free Trial Banner */}
                    <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-emerald-800 font-medium">
                        Want to try before paying?
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan('trial')}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                      >
                        Switch to 1-Month Free Trial (₹0) →
                      </button>
                    </div>

                    {/* Gateway Methods Tabs */}
                    <div className="grid grid-cols-3 gap-2 mb-6">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('UPI')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          paymentMethod === 'UPI'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        <span>UPI / QR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('CARD')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          paymentMethod === 'CARD'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Cards</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('NETBANKING')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          paymentMethod === 'NETBANKING'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                        <span>NetBanking</span>
                      </button>
                    </div>

                    {/* TAB 1: UPI & QR CODE */}
                    {paymentMethod === 'UPI' && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row items-center gap-4">
                          <div className="w-28 h-28 bg-white p-2 rounded-xl shadow-md border border-emerald-200 flex flex-col items-center justify-center shrink-0">
                            <QrCode className="w-20 h-20 text-slate-900" />
                            <span className="text-[8px] font-bold text-emerald-700 uppercase mt-0.5">Scan with App</span>
                          </div>

                          <div className="text-center sm:text-left space-y-1">
                            <span className="text-xs font-bold text-slate-900 block">
                              Instant Scan &amp; Pay via UPI
                            </span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Scan using Google Pay, PhonePe, Paytm, or BHIM. Instant license activation upon payment confirmation.
                            </p>
                            <span className="text-[11px] font-mono text-emerald-800 font-semibold block pt-1">
                              UPI VPA: nockbill.cloud@icici
                            </span>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="sub-upi-vpa" className="block text-xs font-bold text-slate-700 mb-1">
                            Or Pay using UPI Virtual Payment Address (VPA)
                          </label>
                          <input
                            id="sub-upi-vpa"
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="yourname@okaxis"
                            className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    {/* TAB 2: CREDIT / DEBIT CARD */}
                    {paymentMethod === 'CARD' && (
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="sub-card-number" className="block text-xs font-bold text-slate-700 mb-1">
                            Card Number
                          </label>
                          <input
                            id="sub-card-number"
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="4532 •••• •••• 8910"
                            className="clay-input w-full px-4 py-3 font-mono text-sm text-slate-900"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="sub-card-expiry" className="block text-xs font-bold text-slate-700 mb-1">
                              Expiry (MM/YY)
                            </label>
                            <input
                              id="sub-card-expiry"
                              type="text"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              placeholder="MM/YY"
                              className="clay-input w-full px-4 py-3 font-mono text-sm text-slate-900"
                            />
                          </div>

                          <div>
                            <label htmlFor="sub-card-cvv" className="block text-xs font-bold text-slate-700 mb-1">
                              CVV / CVC
                            </label>
                            <input
                              id="sub-card-cvv"
                              type="password"
                              maxLength={4}
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value)}
                              placeholder="•••"
                              className="clay-input w-full px-4 py-3 font-mono text-sm text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: NETBANKING */}
                    {paymentMethod === 'NETBANKING' && (
                      <div className="space-y-4">
                        <div>
                          <span id="sub-bank-label" className="block text-xs font-bold text-slate-700 mb-2">
                            Select Your Commercial Bank
                          </span>
                          <div role="radiogroup" aria-labelledby="sub-bank-label" className="grid grid-cols-2 gap-2">
                            {['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Bank of Baroda', 'Punjab National Bank'].map((b) => (
                              <button
                                key={b}
                                type="button"
                                onClick={() => setSelectedBank(b)}
                                className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                                  selectedBank === b
                                    ? 'border-brand-600 bg-brand-50 text-brand-900'
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                {b}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Gateway Submit Action */}
                    <div className="mt-8 pt-4 border-t border-slate-200 space-y-3">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          void handleActivate();
                        }}
                        className="clay-btn-primary w-full py-4 text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-75 cursor-pointer"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span>{processingStep || 'Processing Payment...'}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>Pay ₹{currentPlan.total.toFixed(2)} &amp; Activate License</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      <div className="text-center pt-2">
                        <p className="text-xs text-slate-400 font-medium">
                          Secure 256-bit encrypted transaction • Instant receipt generation
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
