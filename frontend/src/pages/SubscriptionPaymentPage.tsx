import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, CheckCircle2, QrCode, CreditCard, Building2, 
  ArrowRight, Sparkles, AlertCircle, Clock, Zap, Check, Lock, 
  ChevronRight, RefreshCw, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { getErrorMessage } from '../api';

export const SubscriptionPaymentPage: React.FC = () => {
  const { user, activateSubscription, logout } = useAuth();
  const { settings } = useShop();
  const navigate = useNavigate();

  // Plan Selection
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

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
    monthly: {
      id: 'plan_starter_monthly',
      name: 'Agro Retailer Starter (Monthly)',
      basePrice: 999,
      gst: 179.82,
      total: 1178.82,
      cycle: 'Billed monthly',
      features: [
        'Unlimited GST & POS Invoicing',
        'Code-128 Barcode Sticker Printing (50x25mm)',
        'Sales Returns & Inventory Restocking',
        'Farmer Khata & Multi-Payment Split',
        'Government License Compliance Printouts'
      ]
    },
    annual: {
      id: 'plan_pro_annual',
      name: 'Agro Retailer Pro (Annual)',
      basePrice: 7999,
      gst: 1439.82,
      total: 9438.82,
      cycle: 'Billed annually (Save 33%)',
      features: [
        'Everything in Monthly Starter',
        'Priority Phone & WhatsApp Support',
        'Custom HSN Code & Batch Expiry Alerts',
        'Multi-Device Backup & Cloud Sync',
        'Free 1,000 Thermal Sticker Roll Starter Kit'
      ]
    }
  };

  const currentPlan = plans[selectedPlan];

  const handleSimulatePayment = async () => {
    setError(null);
    setIsProcessing(true);

    try {
      // Step 1: Simulated Gateway Handshake
      setProcessingStep('Connecting to Secure Payment Gateway...');
      await new Promise(r => setTimeout(r, 600));

      // Step 2: Bank / UPI Verification
      setProcessingStep(`Verifying ${paymentMethod} Transaction with Bank Switch...`);
      await new Promise(r => setTimeout(r, 800));

      // Step 3: Authorization & Tokenization
      setProcessingStep('Authorizing ₹' + currentPlan.total.toFixed(2) + ' (Inc. 18% GST)...');
      await new Promise(r => setTimeout(r, 600));

      const paymentRef = `TXN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Backend Activation Call
      const res = await activateSubscription({
        plan_id: currentPlan.id,
        plan_name: currentPlan.name,
        amount: currentPlan.total,
        payment_method: paymentMethod,
        payment_ref: paymentRef
      });

      setPaymentSuccess({
        paymentRef: res.payment_ref || paymentRef,
        planName: currentPlan.name,
        amount: currentPlan.total,
        shopName: settings.shop_name || 'My Fertilizer Shop',
        date: new Date().toLocaleString(),
        method: paymentMethod
      });
    } catch (err: any) {
      setError(getErrorMessage(err, 'Payment authorization failed. Please try again.'));
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Soft Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-4xl w-full mx-auto relative z-10">
        {/* Top Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Official Shop Activation Gateway • 256-bit Encrypted</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Activate Your Shop Cloud License
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete your subscription to unlock POS billing, batch management, and barcode printing for <strong>{settings.shop_name || user?.full_name}</strong>.
          </p>
        </div>

        {/* Payment Success View */}
        {paymentSuccess ? (
          <div className="clay-card-pillowy max-w-xl mx-auto p-8 text-center text-slate-900 border border-white/90 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="clay-badge px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black uppercase inline-block mb-2">
              Subscription Active & Verified
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Payment Successful!
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Your license has been activated. Official GST tax invoice dispatched to your registered email.
            </p>

            {/* Receipt Summary Card */}
            <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left font-mono text-xs space-y-2">
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
                <span className="text-slate-500">Total Paid (Inc. 18% GST):</span>
                <span className="font-bold text-slate-900 text-sm">₹{paymentSuccess.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Payment Channel:</span>
                <span className="font-bold text-slate-700">{paymentSuccess.method} (Success)</span>
              </div>
            </div>

            {/* Action to Launch */}
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="clay-btn-primary w-full py-4 px-6 text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xl"
            >
              <span>Enter Shop POS & Dashboard</span>
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

                {/* Plan Toggle */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('monthly')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      selectedPlan === 'monthly'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Monthly Starter
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('annual')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all relative ${
                      selectedPlan === 'annual'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Annual Pro
                    <span className="absolute -top-2 -right-1 px-1.5 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full">
                      SAVE 33%
                    </span>
                  </button>
                </div>

                {/* Plan Price & Details */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-black text-white">₹{currentPlan.basePrice}</span>
                      <span className="text-xs text-slate-400"> + 18% GST</span>
                    </div>
                    <span className="text-xs text-emerald-400 font-semibold">{currentPlan.cycle}</span>
                  </div>

                  {/* Included bullets */}
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
                    <span className="text-emerald-400">₹{currentPlan.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>GST Invoice with Input Tax Credit</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  Log Out
                </button>
              </div>
            </div>

            {/* Right Column: Dummy Payment Gateway */}
            <div className="lg:col-span-7">
              <div className="clay-card-pillowy p-6 sm:p-8 text-slate-900 border border-white/90 shadow-2xl">
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

                {/* Gateway Methods Tabs */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
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
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
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
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
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
                      {/* Simulated QR Code Graphic */}
                      <div className="w-28 h-28 bg-white p-2 rounded-xl shadow-md border border-emerald-200 flex flex-col items-center justify-center shrink-0">
                        <QrCode className="w-20 h-20 text-slate-900" />
                        <span className="text-[8px] font-bold text-emerald-700 uppercase mt-0.5">Scan with App</span>
                      </div>

                      <div className="text-center sm:text-left space-y-1">
                        <span className="text-xs font-bold text-slate-900 block">
                          Instant Scan & Pay via UPI
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Or Pay using UPI Virtual Payment Address (VPA)
                      </label>
                      <input
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Card Number
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4532 •••• •••• 8910"
                        className="clay-input w-full px-4 py-3 font-mono text-sm text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Expiry (MM/YY)
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="clay-input w-full px-4 py-3 font-mono text-sm text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          CVV / CVC
                        </label>
                        <input
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
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Select Your Commercial Bank
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Bank of Baroda', 'Punjab National Bank'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setSelectedBank(b)}
                            className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
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
                    onClick={handleSimulatePayment}
                    className="clay-btn-primary w-full py-4 text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-75"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>{processingStep || 'Processing Payment...'}</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Pay ₹{currentPlan.total.toFixed(2)} & Activate Shop</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Sandbox Instant Simulation Shortcut */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleSimulatePayment}
                      className="text-xs text-brand-700 hover:text-brand-900 underline font-bold inline-flex items-center gap-1"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Simulate Instant Gateway Approval (Sandbox Demo Mode)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
