import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sprout, ArrowRight, ShieldCheck, Barcode, Receipt, RotateCcw, 
  TrendingUp, Users, CheckCircle2, ChevronRight, Zap, Award, 
  Clock, Database, Printer, Layers, Smartphone, Sparkles, Check, BarChart3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';

export const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { settings } = useShop();

  // Active tab for interactive dashboard screenshot showcase
  const [activeModule, setActiveModule] = useState<'analytics' | 'billing' | 'barcode' | 'returns' | 'reports'>('analytics');

  const moduleData = {
    analytics: {
      title: 'Live Financial & Profit Margin Analytics',
      subtitle: 'Track total sales revenue, gross margins, customer footfall, farmer credit khata, and top agrochemical brands in real time.',
      image: '/images/dashboard/analytics_screen.png',
      badge: 'Real-Time KPI Intelligence',
      points: [
        'Gross profit margin & net revenue tracking across all product categories',
        'Top-selling fertilizer and pesticide brands ranking',
        'Daily footfall and transaction volume velocity charts',
        'Outstanding farmer khata credit vs collected revenue balances'
      ]
    },
    billing: {
      title: 'High-Speed POS & GST Billing',
      subtitle: 'Fast farmer billing with split payments (Cash + UPI), barcode scanner integration, and automatic HSN tax calculation.',
      image: '/images/dashboard/billing_screen.png',
      badge: '3-Second Checkout',
      points: [
        'Instant customer / farmer lookup with Khata balance tracking',
        'Split payment support (e.g. ₹600 Cash + ₹400 UPI in one receipt)',
        'Automatic 5%, 12%, 18% GST calculation with HSN codes',
        'Thermal receipt & standard A4 tax invoice printouts'
      ]
    },
    barcode: {
      title: 'Thermal Code-128 Barcode Printing',
      subtitle: 'Print crisp, scannable sticker labels for fertilizer bags, pesticide bottles, and seed packets with exact label boundaries.',
      image: '/images/dashboard/barcode_screen.png',
      badge: '50mm × 25mm Thermal Roll',
      points: [
        'Supports standard 50×25mm (2"×1"), 50×30mm, 38×25mm rolls & A4 sheets',
        'Dedicated isolated print engine with zero blank pages',
        'High-density vector Code-128 scannable by any 1D/2D scanner',
        'Includes MRP, Batch number, Expiry date, and Shop name'
      ]
    },
    returns: {
      title: 'Sales Returns & Auto-Restocking',
      subtitle: 'Handle farmer returns for unused quantities with precision, restock items back into inventory, and record refund vouchers.',
      image: '/images/dashboard/returns_screen.png',
      badge: 'Accurate Khata Refund',
      points: [
        'Instant invoice lookup showing all previously purchased items',
        'Partial quantity return support with real-time refund calculation',
        'Automatic physical inventory restock with audit log tracking',
        'Returns receipt generation with unique return voucher numbers'
      ]
    },
    reports: {
      title: 'Financial Reports & Profit Analytics',
      subtitle: 'Comprehensive daily sales reports, expense tracking, fast-moving fertilizer insights, and monthly tax summaries.',
      image: '/images/dashboard/reports_screen.png',
      badge: 'Real-Time Insights',
      points: [
        'Downloadable official PDF sales and tax summary reports',
        'Inventory re-order alerts for low-stock fertilizers & pesticides',
        'Expense categorization (Rent, Electricity, Labor, Transport)',
        'Visual revenue charts and profit margin breakdown'
      ]
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8F6] text-slate-800 font-sans selection:bg-brand-500 selection:text-white">
      {/* ─── STICKY CLAYMORPHIC NAVBAR ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/60 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-700 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-brand-800/25 group-hover:scale-105 transition-transform">
              <Sprout className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 tracking-tight block">
                NockBill Solutions
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700 block">
                Agro & Fertilizer ERP Platform
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#features" className="hover:text-brand-700 transition-colors">Features</a>
            <a href="#dashboard-tour" className="hover:text-brand-700 transition-colors">Dashboard Tour</a>
            <a href="#barcode-stickers" className="hover:text-brand-700 transition-colors">Thermal Barcodes</a>
            <a href="#compliance" className="hover:text-brand-700 transition-colors">Agri Compliance</a>
          </nav>

          {/* Top Action Buttons */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/billing"
                className="clay-btn-primary px-5 py-2.5 text-xs sm:text-sm flex items-center gap-2"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="clay-btn-secondary px-5 py-2.5 text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <span>Log In</span>
                </Link>
                <Link
                  to="/register"
                  className="clay-btn-primary hidden sm:flex px-5 py-2.5 text-xs sm:text-sm items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Register Shop</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─────────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 overflow-hidden">
        {/* Soft Background Clay Glows */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-emerald-200/40 via-green-100/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-300/80 text-emerald-900 text-xs font-black shadow-sm mb-6 clay-badge">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Tailored for Indian Fertilizer, Pesticide & Seed Dealers</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] mb-6">
              Modern Billing & Inventory Built for{' '}
              <span className="bg-gradient-to-r from-brand-700 via-emerald-600 to-green-600 bg-clip-text text-transparent">
                Agri-Retailers
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-medium mb-8">
              Lightning-fast GST invoicing, split cash/UPI billing, thermal Code-128 barcode stickers, stock return restock, and pesticide license compliance — sculpted in a tactile claymorphism workspace.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="clay-btn-primary w-full sm:w-auto px-8 py-4 text-base flex items-center justify-center gap-2 group"
              >
                <span>Register Your Shop</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="clay-btn-secondary w-full sm:w-auto px-7 py-4 text-base flex items-center justify-center gap-2"
              >
                <span>Launch Existing Shop</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* ─── HERO SHOWCASE: 3D CLAY FRAME WITH REAL DASHBOARD PREVIEW ───── */}
          <div className="relative mt-8 max-w-5xl mx-auto">
            <div className="clay-card-pillowy p-3 sm:p-5 border-2 border-white/80 shadow-2xl relative">
              {/* Window Controls Mock */}
              <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-200/80 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <span className="ml-2 text-xs font-mono text-slate-500 font-bold">
                    nockbill-solutions.cloud • POS Billing Engine
                  </span>
                </div>
                <span className="clay-badge px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                  Live POS Active
                </span>
              </div>

              {/* Main Billing Screenshot */}
              <div className="rounded-2xl overflow-hidden shadow-inner border border-slate-200/80 bg-slate-900">
                <img
                  src="/images/dashboard/billing_screen.png"
                  alt="NockBill Solutions Billing Dashboard"
                  className="w-full h-auto object-cover object-top hover:scale-[1.01] transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FARMING & HARVEST VISUAL PHOTO GALLERY ─────────────────────────────── */}
      <section className="py-14 bg-gradient-to-b from-white via-slate-50 to-[#F5F8F6] border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-brand-700 block mb-1">
              Field to Counter
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Empowering Over 15,000+ Farmers & Fertilizer Stores
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              From Urea bags and NPK sprayers to hybrid seeds and drip irrigation — manage every single batch with full traceability.
            </p>
          </div>

          {/* Photo Cards Grid with Clay Touch */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Photo 1: Lush Crops & Fertilizer */}
            <div className="clay-card overflow-hidden group">
              <div className="h-56 overflow-hidden relative bg-emerald-950">
                <img
                  src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80"
                  alt="Fertilizers & Nutrients"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-brand-600/90 px-2 py-0.5 rounded-full inline-block mb-1">
                    Fertilizers & Nutrients
                  </span>
                  <h3 className="text-base font-bold leading-tight">Urea, DAP, Potash & Micronutrient Bags</h3>
                </div>
              </div>
              <div className="p-4 bg-white">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Track Government subsidy rates, bag weights (45kg/50kg), manufacture batches, and mandatory farmer Aadhaar records.
                </p>
              </div>
            </div>

            {/* Photo 2: Agricultural Retail & Seeds */}
            <div className="clay-card overflow-hidden group">
              <div className="h-56 overflow-hidden relative bg-emerald-950">
                <img
                  src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=800&q=80"
                  alt="Seed Varieties & Germination"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-600/90 px-2 py-0.5 rounded-full inline-block mb-1">
                    Seed Varieties & Germination
                  </span>
                  <h3 className="text-base font-bold leading-tight">Hybrid Cotton, Wheat, Soy & Paddy</h3>
                </div>
              </div>
              <div className="p-4 bg-white">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Manage certified seed test dates, germination percentage stamps, lot serials, and packet warranties effortlessly.
                </p>
              </div>
            </div>

            {/* Photo 3: Pesticide & Crop Protection */}
            <div className="clay-card overflow-hidden group">
              <div className="h-56 overflow-hidden relative bg-emerald-950">
                <img
                  src="https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&w=800&q=80"
                  alt="Crop Protection & Sprays"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-amber-600/90 px-2 py-0.5 rounded-full inline-block mb-1">
                    Crop Protection & Sprays
                  </span>
                  <h3 className="text-base font-bold leading-tight">Insecticides, Fungicides & Herbicides</h3>
                </div>
              </div>
              <div className="p-4 bg-white">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automated expiry date triggers prevent selling outdated chemical stocks and guarantee 100% CIBRC compliance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE DASHBOARD TOUR (TABBED SCREENSHOTS) ───────────────────── */}
      <section id="dashboard-tour" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <span className="text-xs font-black uppercase tracking-widest text-brand-700 block mb-1">
            Real Software Screenshots
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Designed for Ground Realities of Indian Agro Stores
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Switch between the core operational modules below to see real screenshots from your live dashboard.
          </p>
        </div>

        {/* Module Selector Tabs (Clean wrap, no horizontal scrollbar or clipping) */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mb-10 max-w-5xl mx-auto px-4">
          <button
            onClick={() => setActiveModule('analytics')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              activeModule === 'analytics' 
                ? 'clay-btn-primary shadow-lg scale-105' 
                : 'clay-btn-secondary hover:scale-102'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Live Analytics & KPIs</span>
          </button>

          <button
            onClick={() => setActiveModule('billing')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              activeModule === 'billing' 
                ? 'clay-btn-primary shadow-lg scale-105' 
                : 'clay-btn-secondary hover:scale-102'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>POS Billing & Split Pay</span>
          </button>

          <button
            onClick={() => setActiveModule('barcode')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              activeModule === 'barcode' 
                ? 'clay-btn-primary shadow-lg scale-105' 
                : 'clay-btn-secondary hover:scale-102'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>50×25mm Barcode Stickers</span>
          </button>

          <button
            onClick={() => setActiveModule('returns')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              activeModule === 'returns' 
                ? 'clay-btn-primary shadow-lg scale-105' 
                : 'clay-btn-secondary hover:scale-102'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Returns & Restocking</span>
          </button>

          <button
            onClick={() => setActiveModule('reports')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              activeModule === 'reports' 
                ? 'clay-btn-primary shadow-lg scale-105' 
                : 'clay-btn-secondary hover:scale-102'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Reports & PDF Export</span>
          </button>
        </div>

        {/* Active Module Showcase Card */}
        <div className="clay-card-pillowy p-6 sm:p-8 border border-white/90">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-5 space-y-4">
              <span className="clay-badge px-3 py-1 bg-brand-100 text-brand-800 text-xs font-bold uppercase inline-block">
                {moduleData[activeModule].badge}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {moduleData[activeModule].title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {moduleData[activeModule].subtitle}
              </p>

              <div className="space-y-2.5 pt-2">
                {moduleData[activeModule].points.map((pt, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link
                  to="/register"
                  className="clay-btn-primary inline-flex px-6 py-3 text-xs sm:text-sm items-center gap-2"
                >
                  <span>Try This Module Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Screenshot Preview */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-200/90 bg-slate-950 group">
                <img
                  src={moduleData[activeModule].image}
                  alt={moduleData[activeModule].title}
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CLAYMORPHISM 6 CORE FEATURES GRID ─────────────────────────────────── */}
      <section id="features" className="py-20 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-brand-700 block mb-1">
              Everything Included
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Crafted Specifically for Agricultural Retail
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Say goodbye to generic accounting tools. Here is why top dealers across India switch to NockBill Solutions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="clay-card p-7 hover:-translate-y-1.5 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5 shadow-sm">
                <Receipt className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Split Multi-Payment POS</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Farmers often pay partially in cash and partially via UPI. Split bills seamlessly into Cash + PhonePe/GPay amounts with separate audit records.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="clay-card p-7 hover:-translate-y-1.5 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-5 shadow-sm">
                <Barcode className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Thermal Barcode Generator</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Generates vector Code-128 barcodes formatted specifically for 50×25mm thermal roll printers with isolated single-page print guarantees.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="clay-card p-7 hover:-translate-y-1.5 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5 shadow-sm">
                <RotateCcw className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Stock Return & Refund Engine</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Unopened pesticides or excess fertilizer bags returned by farmers are verified against invoice numbers and restocked automatically.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="clay-card p-7 hover:-translate-y-1.5 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center mb-5 shadow-sm">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Agri License Compliance</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Displays Fertilizer, Insecticide, and Seed license numbers along with proprietor signatures and terms on every generated tax invoice.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="clay-card p-7 hover:-translate-y-1.5 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-5 shadow-sm">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Batch & Expiry Date Alerts</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Identifies chemicals nearing expiration 90 days in advance, allowing you to return stock to distributors or offer promotional clearance.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="clay-card p-7 hover:-translate-y-1.5 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-5 shadow-sm">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Multi-User Roles & Audit Security</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Empower counter staff with fast billing operator logins while safeguarding business settings, with detailed audit logging for every invoice, return, and stock adjustment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CALL TO ACTION BANNER ────────────────────────────────────────────── */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="clay-card-green p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Ready to Upgrade Your Agro Retail Store?
            </h2>
            <p className="text-sm sm:text-base text-emerald-100 leading-relaxed font-medium">
              Join leading agricultural dealers across Maharashtra, Punjab, Gujarat, and Andhra Pradesh. Setup takes less than 2 minutes.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 bg-white text-emerald-900 rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-50 active:scale-95 transition-all"
              >
                Register Your Agro Business
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-7 py-4 bg-emerald-900/40 hover:bg-emerald-900/60 text-white rounded-2xl font-bold text-sm border border-white/20 active:scale-95 transition-all"
              >
                Sign In to Existing Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-700 text-white flex items-center justify-center">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <span className="text-white font-bold block text-sm">NockBill Solutions</span>
              <span className="text-[11px] text-slate-500">Enterprise Cloud Platform for Agro & Fertilizer Retailing</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-semibold">
            <Link to="/login" className="hover:text-white transition-colors">Shop Login</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register Agency</Link>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#dashboard-tour" className="hover:text-white transition-colors">Tour</a>
          </div>

          <div className="text-center sm:text-right text-[11px] text-slate-500">
            © {new Date().getFullYear()} NockBill Solutions. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
