import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { getErrorMessage } from '../api';

interface PlanData {
  id: string;
  key: 'trial' | 'monthly' | 'semi' | 'annual';
  title: string;
  tag: string;
  monthlyDisplay: string;
  billingDisplay: string;
  base: number;
  discount: number;
  gstRate: number;
  gst: number;
  total: number;
  duration: string;
  badge?: string;
  badgeColor?: string;
  badgeHighlight?: string;
}

export const SubscriptionPaymentPage: React.FC = () => {
  const { user, activateSubscription, logout } = useAuth();
  const { settings } = useShop();
  const navigate = useNavigate();

  // Active Plan Selection: 'trial' | 'monthly' | 'semi' | 'annual'
  const [activePlanKey, setActivePlanKey] = useState<'trial' | 'monthly' | 'semi' | 'annual'>('annual');

  // Active Tab in Payment Gateway: 'upi' | 'cards' | 'netbanking'
  const [paymentTab, setPaymentTab] = useState<'upi' | 'cards' | 'netbanking'>('upi');

  // Sandbox / Demo Mode Toggle
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Form states
  const [upiVpaInput, setUpiVpaInput] = useState<string>('dealer@okaxis');
  const [vpaStatus, setVpaStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [copiedVpa, setCopiedVpa] = useState<boolean>(false);

  const [cardNumber, setCardNumber] = useState<string>('4532 8910 2341 8921');
  const [cardExpiry, setCardExpiry] = useState<string>('08/28');
  const [cardCvv, setCardCvv] = useState<string>('781');
  const [cardHolder, setCardHolder] = useState<string>(settings?.shop_name || "King's Agri Pvt Ltd / Proprietor");

  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');

  // Timer countdown: 9 min 48 sec (588 seconds)
  const [secondsLeft, setSecondsLeft] = useState<number>(588);

  // Processing & Success states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<{
    txRef: string;
    planName: string;
    amount: string;
    validTill: string;
    shopName: string;
  } | null>(null);

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Plan data definition
  const plansData: Record<'trial' | 'monthly' | 'semi' | 'annual', PlanData> = {
    trial: {
      id: 'plan_trial_1m',
      key: 'trial',
      title: '1-Month Free Trial (All Features)',
      tag: '₹0 × 1 mo',
      monthlyDisplay: '₹0',
      billingDisplay: '₹0.00 billed today (30 Days Full Access)',
      base: 0.0,
      discount: 999.0,
      gstRate: 0.18,
      gst: 0.0,
      total: 0.0,
      duration: '1 Month (30 Days)',
      badge: '1 MONTH FREE',
      badgeColor: 'bg-emerald-500 text-slate-950',
      badgeHighlight: '★ 100% Free Trial',
    },
    monthly: {
      id: 'plan_starter_monthly',
      key: 'monthly',
      title: 'Monthly Starter (1 Month)',
      tag: '₹999 × 1 mo',
      monthlyDisplay: '₹999',
      billingDisplay: '₹999.00 billed monthly',
      base: 999.0,
      discount: 0.0,
      gstRate: 0.18,
      gst: 179.82,
      total: 1178.82,
      duration: '1 Month',
      badgeHighlight: 'Standard Billing',
    },
    semi: {
      id: 'plan_semi_annual_6m',
      key: 'semi',
      title: 'Semi-Annual Agro Plan (6 Months)',
      tag: '₹849 × 6 mos',
      monthlyDisplay: '₹849',
      billingDisplay: '₹5,094 billed semi-annually',
      base: 5094.0,
      discount: 899.0,
      gstRate: 0.18,
      gst: 916.92,
      total: 6010.92,
      duration: '6 Months',
      badge: 'Save 15%',
      badgeColor: 'bg-emerald-500 text-slate-950',
      badgeHighlight: '⚡ Most Popular',
    },
    annual: {
      id: 'plan_annual_pro_1y',
      key: 'annual',
      title: 'Annual Agro Cloud License (12 Months)',
      tag: '₹699 × 12 mos',
      monthlyDisplay: '₹699',
      billingDisplay: '₹8,388 billed annually',
      base: 8388.0,
      discount: 3600.0,
      gstRate: 0.18,
      gst: 1509.84,
      total: 9897.84,
      duration: '1 Year',
      badge: 'Save 30%',
      badgeColor: 'bg-amber-400 text-slate-950',
      badgeHighlight: '★ Best Agro Value',
    },
  };

  const currentPlan = plansData[activePlanKey];

  const formatINR = (num: number) => {
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Copy VPA Handler
  const handleCopyVpa = () => {
    navigator.clipboard.writeText('nockbill.cloud@icici').then(() => {
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2200);
    }).catch(() => {
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2200);
    });
  };

  // Verify VPA input
  const handleVerifyVpa = () => {
    const val = upiVpaInput.trim();
    if (!val || !val.includes('@')) {
      setVpaStatus({
        message: 'Please enter a valid UPI handle (e.g. dealer@okhdfcbank)',
        isError: true,
      });
      return;
    }
    const storeLabel = settings?.shop_name || "King's Agri";
    setVpaStatus({
      message: `✓ Valid VPA verified for ${storeLabel}: ${val}`,
      isError: false,
    });
  };

  // Trigger Activation Action
  const handleTriggerActivation = async () => {
    setError(null);
    setIsProcessing(true);

    try {
      const isFreeTrial = activePlanKey === 'trial';
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      const generatedRef = isFreeTrial
        ? `TRIAL-1M-${Date.now().toString().slice(-6)}`
        : `TXN-AGRO-${randomSuffix}`;

      // Call backend activation API
      const res = await activateSubscription({
        plan_id: currentPlan.id,
        plan_name: currentPlan.title,
        amount: isFreeTrial ? 0 : (isDemoMode ? currentPlan.total : currentPlan.total),
        payment_method: paymentTab.toUpperCase(),
        payment_ref: generatedRef,
      });

      // Calculate future expiry date
      const futureDate = new Date();
      if (activePlanKey === 'trial') futureDate.setDate(futureDate.getDate() + 30);
      else if (activePlanKey === 'monthly') futureDate.setMonth(futureDate.getMonth() + 1);
      else if (activePlanKey === 'semi') futureDate.setMonth(futureDate.getMonth() + 6);
      else if (activePlanKey === 'annual') futureDate.setFullYear(futureDate.getFullYear() + 1);

      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      const validTillString = futureDate.toLocaleDateString('en-IN', options);

      setSuccessModalData({
        txRef: res?.payment_ref || generatedRef,
        planName: currentPlan.title,
        amount: isFreeTrial ? '₹0.00 (Free Tier)' : formatINR(currentPlan.total),
        validTill: validTillString,
        shopName: settings?.shop_name || "King's Agri",
      });
    } catch (err: any) {
      console.error('Subscription activation failed:', err);
      setError(getErrorMessage(err, 'Failed to activate license. Please try again or switch to 1-Month Free Trial.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseModal = () => {
    setSuccessModalData(null);
    navigate('/billing', { replace: true });
  };

  const getCtaButtonLabel = () => {
    if (isProcessing) return 'Verifying & Activating License...';
    if (activePlanKey === 'trial') return 'Activate 1-Month Free Trial (₹0) Now →';
    if (isDemoMode) {
      return `Demo Activation (${formatINR(currentPlan.total)}) — No Payment Processed →`;
    }
    return `Pay ${formatINR(currentPlan.total)} & Activate License Now →`;
  };

  const shopDisplayName = settings?.shop_name || (user?.email ? user.email.split('@')[0] : "King's Agri");
  const shopDisplayId = settings?.id ? `KA-MND-${String(settings.id).padStart(4, '0')}` : (settings?.shop_account_id || 'KA-MND-4902');

  return (
    <div className="license-atmosphere min-h-screen text-slate-100 flex flex-col justify-between antialiased selection:bg-emerald-500 selection:text-white font-sans">
      {/* BEGIN: MainHeader */}
      <header className="w-full bg-[#07130f]/90 border-b border-emerald-900/40 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Shop Badge */}
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950 flex items-center justify-center shrink-0">
              <div className="h-full w-full bg-[#081712] rounded-[10px] flex items-center justify-center">
                {/* Agro Sprout Logo SVG */}
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M7 20h10" />
                  <path d="M12 20v-8" />
                  <path d="M12 12a5 5 0 0 0 5-5 5 5 0 0 0-5 0" />
                  <path d="M12 12a5 5 0 0 1-5-5 5 5 0 0 1 5 0" />
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">NockBill Solutions</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/30">Agro ERP</span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <span>Store: <strong className="text-slate-200 font-semibold">{shopDisplayName}</strong></span>
                <span className="text-emerald-500">•</span>
                <span className="text-emerald-400/90 font-medium tracking-wide">ID: #{shopDisplayId}</span>
              </p>
            </div>
          </div>

          {/* Center Status Badge */}
          <div className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 text-xs shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium tracking-wide">Secure Billing Terminal 256-bit SSL</span>
            <span className="text-emerald-700">|</span>
            <span className="text-slate-300 text-[11px]">Server: IN-MUM-02</span>
          </div>

          {/* Header Utilities & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            <button
              onClick={() => window.open('https://nockbill.com/docs', '_blank')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-emerald-400 rounded-lg hover:bg-emerald-950/60 transition border border-transparent hover:border-emerald-800/50"
              type="button"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              Agro Manuals
            </button>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 rounded-lg border border-slate-700/70 transition"
              type="button"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <span className="hidden sm:inline">Switch Outlet</span>
            </button>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-rose-300 hover:text-rose-200 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-800/40 rounded-lg transition"
              title="Log Out Session"
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </header>
      {/* END: MainHeader */}

      {/* BEGIN: HeroAnnouncement */}
      <div className="px-4 sm:px-6 pt-6 pb-2">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          {/* Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-medium shadow-sm backdrop-blur">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd" />
            </svg>
            <span>Shop Cloud License Inactive / Renewal Required</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Activate Your Agro Cloud License
          </h1>
          <p className="text-xs sm:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Choose an annual, multi-month, or 1-month free trial plan to unlock high-speed offline-first POS billing, statutory Form O registers, and automated WhatsApp farmer Khata recovery.
          </p>
        </div>
      </div>
      {/* END: HeroAnnouncement */}

      {/* BEGIN: MainContentGrid */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⚠️</span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setActivePlanKey('trial')}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shrink-0"
              type="button"
            >
              Switch to 1-Month Free Trial →
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ==============================================
              LEFT COLUMN: Plan Selection & Breakdown (7 Cols)
              ============================================== */}
          <section aria-labelledby="plan-selection-heading" className="lg:col-span-7 space-y-6">
            <h2 className="sr-only" id="plan-selection-heading">Choose License Subscription Plan</h2>

            {/* Plan Cards Container */}
            <div className="bg-[#08130f]/80 p-5 sm:p-6 rounded-2xl border border-emerald-900/60 backdrop-blur glow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                  Select Subscription Tenure:
                </h3>
                <span className="text-xs text-slate-400">All features included across all plans</span>
              </div>

              {/* 4 Plan Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                {/* Plan 0: 1-Month Free Trial (Requested Free Tier) */}
                <button
                  type="button"
                  onClick={() => setActivePlanKey('trial')}
                  className={`text-left p-4 rounded-xl border relative flex flex-col justify-between group focus:outline-none transition-all duration-200 ${
                    activePlanKey === 'trial'
                      ? 'active-plan-ring bg-emerald-950/40 border-emerald-500'
                      : 'border-emerald-800/40 bg-[#0a1310] hover:border-emerald-700/60'
                  }`}
                >
                  <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-emerald-400 text-[10px] font-bold text-slate-950 uppercase tracking-wider shadow">
                    1 Month Free
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300 font-bold">Free Trial Tier</span>
                      <span className={`h-4 w-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-bold ${activePlanKey === 'trial' ? '' : 'hidden'}`}>
                        ✓
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                      ₹0<span className="text-xs font-normal text-slate-400">/mo</span>
                    </div>
                    <p className="text-[11px] text-emerald-300/90 mt-1">₹0.00 billed for 30 days full access</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-800/60 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    ★ 1-Month Full Access Free Trial
                  </div>
                </button>

                {/* Plan 1: Monthly Starter */}
                <button
                  type="button"
                  onClick={() => setActivePlanKey('monthly')}
                  className={`text-left p-4 rounded-xl border relative flex flex-col justify-between group focus:outline-none transition-all duration-200 ${
                    activePlanKey === 'monthly'
                      ? 'active-plan-ring bg-emerald-950/40 border-emerald-500'
                      : 'border-emerald-800/40 bg-[#0a1310] hover:border-emerald-700/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">1 Month</span>
                      <span className={`h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] ${activePlanKey === 'monthly' ? '' : 'hidden'}`}>
                        ✓
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                      ₹999<span className="text-xs font-normal text-slate-400">/mo</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">₹999.00 billed monthly</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-medium">
                    Standard Billing
                  </div>
                </button>

                {/* Plan 2: 6 Months Semi-Annual */}
                <button
                  type="button"
                  onClick={() => setActivePlanKey('semi')}
                  className={`text-left p-4 rounded-xl border relative flex flex-col justify-between group focus:outline-none transition-all duration-200 ${
                    activePlanKey === 'semi'
                      ? 'active-plan-ring bg-emerald-950/40 border-emerald-500'
                      : 'border-emerald-800/40 bg-[#0a1310] hover:border-emerald-700/60'
                  }`}
                >
                  <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-emerald-500 text-[10px] font-bold text-emerald-950 uppercase tracking-wider shadow">
                    Save 15%
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">6 Months</span>
                      <span className={`h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] ${activePlanKey === 'semi' ? '' : 'hidden'}`}>
                        ✓
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                      ₹849<span className="text-xs font-normal text-slate-400">/mo</span>
                    </div>
                    <p className="text-[11px] text-emerald-400/90 mt-1">₹5,094 billed semi-annually</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-emerald-400 font-medium">
                    ⚡ Most Popular
                  </div>
                </button>

                {/* Plan 3: 1 Year Annual Pro */}
                <button
                  type="button"
                  onClick={() => setActivePlanKey('annual')}
                  className={`text-left p-4 rounded-xl border relative flex flex-col justify-between group focus:outline-none transition-all duration-200 ${
                    activePlanKey === 'annual'
                      ? 'active-plan-ring bg-emerald-950/40 border-emerald-500'
                      : 'border-emerald-800/40 bg-[#0a1310] hover:border-emerald-700/60'
                  }`}
                >
                  <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-amber-400 text-[10px] font-bold text-slate-950 uppercase tracking-wider shadow">
                    Save 30%
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300 font-bold">1 Year Pro</span>
                      <span className={`h-4 w-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-bold ${activePlanKey === 'annual' ? '' : 'hidden'}`}>
                        ✓
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                      ₹699<span className="text-xs font-normal text-slate-400">/mo</span>
                    </div>
                    <p className="text-[11px] text-emerald-300/90 mt-1">₹8,388 billed annually</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-800/60 text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                    ★ Best Agro Value
                  </div>
                </button>
              </div>

              {/* Price & Tax Summary Breakdown (Dynamic) */}
              <div className="bg-[#070e0b] rounded-xl border border-emerald-950 p-4 space-y-2.5 mb-6" data-purpose="tax-computation-breakdown">
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span>{currentPlan.title}</span>
                    <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded">{currentPlan.tag}</span>
                  </span>
                  <span className="font-mono text-slate-200 font-medium">{formatINR(currentPlan.base)}</span>
                </div>

                {currentPlan.discount > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-400">
                    <span>Duration Discount Benefit</span>
                    <span className="font-mono font-medium">- {formatINR(currentPlan.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs text-slate-400 border-t border-emerald-950/80 pt-2">
                  <span className="flex items-center gap-1">
                    <span>GST Tax (18% IGST or CGST 9% + SGST 9%)</span>
                    <span className="cursor-pointer text-slate-500 hover:text-slate-300" title="Full ITC Claim eligibility under HSN 997331">ⓘ</span>
                  </span>
                  <span className="font-mono text-slate-300 font-medium">{formatINR(currentPlan.gst)}</span>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-emerald-900/50">
                  <div>
                    <span className="text-sm font-bold text-white tracking-wide">Net Payable Amount</span>
                    <p className="text-[11px] text-slate-400">Inclusive of all statutory taxes & cloud hosting</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-emerald-400 font-mono tracking-tight">
                      {formatINR(currentPlan.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Specialized Agro Features List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    Included in Your {shopDisplayName} Cloud License:
                  </h4>
                  <span className="text-[11px] text-emerald-400 font-medium">All Modules Active</span>
                </div>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300" data-purpose="feature-checklist">
                  <li className="flex items-start gap-2 bg-[#091410] p-2.5 rounded-lg border border-emerald-950/80">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                    <span>
                      <strong>Unlimited GST & POS Invoicing</strong>
                      <br />
                      <span className="text-[11px] text-slate-400">Thermal 80mm, 3-inch, & A4 full size prints</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2 bg-[#091410] p-2.5 rounded-lg border border-emerald-950/80">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                    <span>
                      <strong>Statutory Form O Registers</strong>
                      <br />
                      <span className="text-[11px] text-slate-400">Price-cum-stock FCO 1985 audit ready</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2 bg-[#091410] p-2.5 rounded-lg border border-emerald-950/80">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                    <span>
                      <strong>Batch & Barcode Tracking</strong>
                      <br />
                      <span className="text-[11px] text-slate-400">Mfg/Expiry alert & Code-128 sticker prints</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2 bg-[#091410] p-2.5 rounded-lg border border-emerald-950/80">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                    <span>
                      <strong>Farmer Khata & Udhar Ledger</strong>
                      <br />
                      <span className="text-[11px] text-slate-400">Split payments & WhatsApp payment reminders</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2 bg-[#091410] p-2.5 rounded-lg border border-emerald-950/80">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                    <span>
                      <strong>Fertilizer DBT Aadhaar Sync</strong>
                      <br />
                      <span className="text-[11px] text-slate-400">Multi-godown stock transfer & POS sync</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2 bg-[#091410] p-2.5 rounded-lg border border-emerald-950/80">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                    <span>
                      <strong>1-Click GSTR Auto Filing</strong>
                      <br />
                      <span className="text-[11px] text-slate-400">GSTR-1, 3B & ITC 2B auto-reconciliation</span>
                    </span>
                  </li>
                </ul>
              </div>

              {/* Bottom Micro Footer: GST Guarantee & Switch Store */}
              <div className="mt-6 pt-4 border-t border-emerald-950 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <span>Instant B2B Tax Invoice provided with GSTIN input credit</span>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-slate-400 hover:text-slate-200 transition underline underline-offset-2"
                >
                  Switch Store License
                </button>
              </div>
            </div>
          </section>

          {/* ==============================================
              RIGHT COLUMN: Interactive Payment Gateway (5 Cols)
              ============================================== */}
          <section aria-labelledby="payment-gateway-heading" className="lg:col-span-5 w-full">
            <h2 className="sr-only" id="payment-gateway-heading">Payment Gateway & UPI Terminal</h2>

            {/* White Contrast High-End Card */}
            <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-7 payment-modal-glow relative border border-emerald-100 flex flex-col justify-between min-h-[640px]">
              {/* Top Row: Payment Header & Total Due Amount */}
              <div>
                <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-4">
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-emerald-800 uppercase">Payment Terminal</p>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">Select Payment Mode</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Total Due</p>
                    <span className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
                      {formatINR(currentPlan.total)}
                    </span>
                  </div>
                </div>

                {/* Payment Option Switcher Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mb-5" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={paymentTab === 'upi'}
                    onClick={() => setPaymentTab('upi')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                      paymentTab === 'upi'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>⚡ UPI / QR</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={paymentTab === 'cards'}
                    onClick={() => setPaymentTab('cards')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                      paymentTab === 'cards'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>💳 Cards</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={paymentTab === 'netbanking'}
                    onClick={() => setPaymentTab('netbanking')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                      paymentTab === 'netbanking'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🏦 NetBanking</span>
                  </button>
                </div>

                {/* Tab Content 1: UPI / Dynamic QR */}
                {paymentTab === 'upi' && (
                  <div className="space-y-4">
                    {/* Visual QR Container */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
                      {/* Detailed SVG QR Code */}
                      <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200 shrink-0">
                        <svg className="w-36 h-36" viewBox="0 0 140 140">
                          {/* Corner Top-Left */}
                          <rect fill="#059669" height="32" rx="4" width="32" x="10" y="10" />
                          <rect fill="white" height="18" rx="2" width="18" x="17" y="17" />
                          <rect fill="#0f172a" height="10" rx="1" width="10" x="21" y="21" />

                          {/* Corner Top-Right */}
                          <rect fill="#059669" height="32" rx="4" width="32" x="98" y="10" />
                          <rect fill="white" height="18" rx="2" width="18" x="105" y="17" />
                          <rect fill="#0f172a" height="10" rx="1" width="10" x="109" y="21" />

                          {/* Corner Bottom-Left */}
                          <rect fill="#059669" height="32" rx="4" width="32" x="10" y="98" />
                          <rect fill="white" height="18" rx="2" width="18" x="17" y="105" />
                          <rect fill="#0f172a" height="10" rx="1" width="10" x="21" y="109" />

                          {/* Pseudo Data Pattern Pixels */}
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="52" y="16" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="68" y="16" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="80" y="24" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="12" x="52" y="32" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="76" y="36" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="12" y="56" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="28" y="56" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="44" y="56" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="20" x="60" y="56" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="88" y="56" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="104" y="56" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="120" y="56" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="12" y="72" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="28" y="72" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="56" y="72" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="72" y="72" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="104" y="72" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="56" y="92" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="72" y="92" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="92" y="92" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="108" y="92" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="124" y="92" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="56" y="108" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="72" y="108" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="88" y="108" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="120" y="108" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="56" y="124" />
                          <rect fill="#059669" height="8" rx="1.5" width="8" x="72" y="124" />
                          <rect fill="#0f172a" height="8" rx="1.5" width="8" x="104" y="124" />

                          {/* Center Badge Brand Mark */}
                          <circle cx="70" cy="70" fill="#047857" r="14" />
                          <path d="M66 73h8m-4-7v7" stroke="white" strokeLinecap="round" strokeWidth="2" />
                        </svg>
                        <div className="text-[9px] font-bold text-center uppercase tracking-wider text-slate-600 mt-1">
                          Scan with any UPI
                        </div>
                      </div>

                      {/* QR Right Info & Timer */}
                      <div className="text-left space-y-2 flex-1 w-full">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Dynamic Auto-Verifying QR</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-snug">
                          Open Google Pay, PhonePe, Paytm, BHIM or Cred on your mobile phone to complete payment.
                        </p>

                        {/* Live Timer and VPA string */}
                        <div className="bg-white/90 p-2 rounded-lg border border-emerald-200/90 text-xs">
                          <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                            <span>Verified Merchant:</span>
                            <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                              ⏱️ <span>{formatTimer(secondsLeft)}</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between font-mono font-bold text-slate-800 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            <span>nockbill.cloud@icici</span>
                            <button
                              type="button"
                              onClick={handleCopyVpa}
                              className={`font-sans text-[10px] font-bold underline transition ${
                                copiedVpa ? 'text-emerald-500' : 'text-emerald-700 hover:text-emerald-900'
                              }`}
                            >
                              {copiedVpa ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Manual UPI ID / VPA field option */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="upi-vpa-input">
                        Or Pay using UPI Virtual Payment Address (VPA):
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            id="upi-vpa-input"
                            type="text"
                            value={upiVpaInput}
                            onChange={(e) => setUpiVpaInput(e.target.value)}
                            placeholder="e.g. mobile@upi / shop@icici"
                            className="w-full text-xs font-mono font-medium rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring focus:ring-emerald-200/50 py-2.5 px-3 bg-slate-50"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleVerifyVpa}
                          className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shrink-0"
                        >
                          Verify & Pay
                        </button>
                      </div>
                      {vpaStatus && (
                        <p className={`text-[11px] mt-1 ${vpaStatus.isError ? 'text-rose-600' : 'text-emerald-700 font-medium'}`}>
                          {vpaStatus.message}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab Content 2: Cards (Debit / Credit) */}
                {paymentTab === 'cards' && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-2.5">
                      <div>
                        <label htmlFor="card-number-input" className="block text-xs font-semibold text-slate-700 mb-1">Card Number</label>
                        <div className="relative">
                          <input
                            id="card-number-input"
                            type="text"
                            maxLength={19}
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="4532 •••• •••• 8921"
                            className="w-full text-xs font-mono rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring focus:ring-emerald-200/50 py-2.5 px-3"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">RuPay / Visa</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="card-expiry-input" className="block text-xs font-semibold text-slate-700 mb-1">Expiry (MM/YY)</label>
                          <input
                            id="card-expiry-input"
                            type="text"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="08 / 28"
                            className="w-full text-xs font-mono rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring focus:ring-emerald-200/50 py-2 px-3"
                          />
                        </div>
                        <div>
                          <label htmlFor="card-cvv-input" className="block text-xs font-semibold text-slate-700 mb-1">CVV / CVC</label>
                          <input
                            id="card-cvv-input"
                            type="password"
                            maxLength={4}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="•••"
                            className="w-full text-xs font-mono rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring focus:ring-emerald-200/50 py-2 px-3"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="card-holder-input" className="block text-xs font-semibold text-slate-700 mb-1">
                          Cardholder Name (as on {shopDisplayName} Bank Account)
                        </label>
                        <input
                          id="card-holder-input"
                          type="text"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          placeholder="King's Agri Pvt Ltd / Proprietor"
                          className="w-full text-xs rounded-xl border border-slate-300 focus:border-emerald-600 py-2 px-3"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content 3: NetBanking */}
                {paymentTab === 'netbanking' && (
                  <div className="space-y-3 pt-1">
                    <span className="block text-xs font-semibold text-slate-700 mb-1">Select Bank for Direct Debit:</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { name: 'State Bank of India', tag: 'SBI' },
                        { name: 'HDFC Bank', tag: '★ Primary' },
                        { name: 'ICICI Agro Current', tag: 'ICICI' },
                        { name: 'Axis Bank', tag: 'AXIS' },
                      ].map((bank) => (
                        <button
                          key={bank.name}
                          type="button"
                          onClick={() => setSelectedBank(bank.name)}
                          className={`border rounded-lg p-2.5 text-left font-medium transition flex items-center justify-between ${
                            selectedBank === bank.name
                              ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold'
                              : 'border-slate-200 hover:border-emerald-500 hover:bg-emerald-50'
                          }`}
                        >
                          <span>{bank.name}</span>
                          <span className={`text-[10px] ${selectedBank === bank.name ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                            {bank.tag}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500">Supports all RTGS, NEFT, and Agri Business Current accounts.</p>
                  </div>
                )}
              </div>

              {/* Bottom Action Buttons & Trust Badges */}
              <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
                {/* Primary Execution CTA Button */}
                <button
                  type="button"
                  id="cta-pay-button"
                  disabled={isProcessing}
                  onClick={handleTriggerActivation}
                  className={`w-full py-3.5 px-5 rounded-2xl text-white font-bold text-sm sm:text-base tracking-wide shadow-lg shadow-emerald-700/30 hover:shadow-emerald-600/50 transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-[0.99] ${
                    isDemoMode
                      ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 ring-2 ring-emerald-400'
                      : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-500 hover:to-teal-700'
                  }`}
                >
                  <svg className="w-5 h-5 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <span id="cta-button-label">{getCtaButtonLabel()}</span>
                </button>

                {/* Demo Mode Toggle & Activation Simulator */}
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <input
                      id="demo-mode-checkbox"
                      type="checkbox"
                      checked={isDemoMode}
                      onChange={(e) => setIsDemoMode(e.target.checked)}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                    />
                    <label htmlFor="demo-mode-checkbox" className="text-xs text-slate-700 font-medium cursor-pointer">
                      Test / Demo Activation Mode (No actual charge)
                    </label>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">Sandbox</span>
                </div>

                {/* Guarantee & ITC Delivery Note */}
                <p className="text-[11px] text-slate-500 text-center leading-tight">
                  GST ITC Invoice will be automatically dispatched to <strong className="text-slate-800">{user?.email || 'dealer@kingsagri.in'}</strong>. Instant 7-day no-questions-asked refund policy.
                </p>

                {/* Trust Payment Badges */}
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-slate-400 pt-1 text-[11px]">
                  <span className="flex items-center gap-1 font-semibold text-slate-600">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path clipRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd" />
                    </svg>
                    PCI-DSS Compliant
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-slate-600">NPCI Unified Payments</span>
                  <span>•</span>
                  <span className="font-semibold text-slate-600">256-Bit SSL</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      {/* END: MainContentGrid */}

      {/* BEGIN: SuccessModalNotification */}
      {successModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1713] border border-emerald-500/80 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl relative">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-400/40">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">License Activated Successfully!</h3>
            <p className="text-xs text-emerald-300 font-mono mb-4">Transaction Ref: <span>{successModalData.txRef}</span></p>

            <div className="bg-black/40 rounded-xl p-3 text-left text-xs space-y-2 border border-emerald-950 mb-5 text-slate-300">
              <div className="flex justify-between">
                <span>Shop Outlet:</span>
                <strong className="text-white">{successModalData.shopName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Plan Tenure:</span>
                <strong className="text-white">{successModalData.planName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <strong className="text-emerald-400 font-mono">{successModalData.amount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Valid Till:</span>
                <strong className="text-white">{successModalData.validTill}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-lg shadow-emerald-900/50"
            >
              Enter Billing Dashboard →
            </button>
          </div>
        </div>
      )}
      {/* END: SuccessModalNotification */}

      {/* BEGIN: MainFooter */}
      <footer className="w-full border-t border-emerald-950/70 bg-[#030706] py-5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-400">NockBill Agro Billing ERP v4.8.2 Cloud Terminal</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-500">FCO Compliance Info</span>
            <span>•</span>
            <span className="text-slate-500">GST E-Way Rules</span>
            <span>•</span>
            <span className="text-slate-400">24x7 Agro Desk: 1800-419-AGRO</span>
          </div>
        </div>
      </footer>
      {/* END: MainFooter */}
    </div>
  );
};

export default SubscriptionPaymentPage;
