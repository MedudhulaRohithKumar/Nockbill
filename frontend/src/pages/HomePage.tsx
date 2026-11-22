import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sprout, 
  ArrowRight, 
  Play, 
  ShieldCheck, 
  Store, 
  Receipt, 
  Layers, 
  ChevronRight, 
  Printer, 
  QrCode, 
  Scale, 
  Fingerprint, 
  Activity, 
  CheckCircle2, 
  Stethoscope, 
  Bug, 
  Droplets, 
  ExternalLink, 
  Search, 
  X,
  Lock,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AgriDoctorModal } from '../components/billing/AgriDoctorModal';

interface ChapterFeature {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  badgeColor: string;
  image: string;
  route: string;
}

const CHAPTER_FEATURES: ChapterFeature[] = [
  {
    id: 'agri-doctor',
    title: 'Agri Doctor & Crop Diagnostic AI',
    subtitle: 'Field-Grade Pest & Disease Telemetry',
    description: 'Instant plant disease detection with approved chemical molecules, standard pump/acre dosages, and 1-click WhatsApp advisory dispatch.',
    badge: 'AI Telemetry 01',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    image: 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/cd2d844f-ae3f-4fa9-8067-b077530b6e71.webp',
    route: '/billing',
  },
  {
    id: 'pos-billing',
    title: 'High-Speed POS & 80mm ESC/POS',
    subtitle: 'F1 Instant Counter Checkout',
    description: 'Single-keystroke billing with multi-batch selection, barcode scanning, split payments (Cash + UPI), and thermal roll printer dispatch.',
    badge: 'Retail Module 02',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    image: 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/48f5b97e-c27c-4afd-9427-eb35aebd1751.webp',
    route: '/billing',
  },
  {
    id: 'khata-form-o',
    title: 'Farmer Credit Khata & Form O Ledger',
    subtitle: 'Statutory Agriculture Compliance',
    description: 'Digital farmer credit recovery with UPI payment reminders, cashier shift handovers, and certified Form O regulatory registers.',
    badge: 'Compliance Module 03',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    image: 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/cde5384e-ce4d-423f-925a-451b779066e0.webp',
    route: '/khata',
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Floating Agri Doctor modal toggle
  const [isAgriDoctorOpen, setIsAgriDoctorOpen] = useState<boolean>(false);

  // Portal auth tab state
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [storeSlug, setStoreSlug] = useState<string>('green-valley-agro');
  const [username, setUsername] = useState<string>('owner@green-valley');
  const [password, setPassword] = useState<string>('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<string>('owner');

  // Preview feature modal state
  const [activePreview, setActivePreview] = useState<ChapterFeature | null>(null);

  const handleFillDemo = () => {
    setStoreSlug('green-valley-agro');
    setUsername('devendra@green-valley');
    setPassword('RuralPass#2026');
    setSelectedRole('owner');
  };

  const handlePortalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authTab === 'login') {
      navigate('/login');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-slate-900 font-sans selection:bg-emerald-600 selection:text-white">
      {/* ─── FLOATING TOP NAVIGATION BAR ─────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Mark */}
          <Link
            to="/"
            className="flex items-center gap-2.5 bg-white/70 hover:bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/80 shadow-sm transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center text-emerald-200 shadow-inner">
              <Sprout className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="font-['Grandstander'] font-black text-lg text-emerald-950 leading-none tracking-tight">
                  NockBill
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold">
                  Meadowbell
                </span>
              </div>
            </div>
          </Link>

          {/* Frosted Glass Pill Menu */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-5 px-6 py-2 rounded-full border shadow-sm backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(173, 196, 174, 0.45)',
              borderColor: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <Link
              to="/billing"
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              POS Counter
            </Link>
            <span className="text-white/40 text-xs">·</span>
            <Link
              to="/khata"
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              Farmer Credit
            </Link>
            <span className="text-white/40 text-xs">·</span>
            <button
              type="button"
              onClick={() => setIsAgriDoctorOpen(true)}
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" />
              Agri Doctor AI
            </button>
            <span className="text-white/40 text-xs">·</span>
            <Link
              to="/khata?tab=compliance"
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
              Form O Regulatory
            </Link>
            <span className="text-white/40 text-xs">·</span>
            <a
              href="#portal-auth"
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors"
            >
              Pricing &amp; Portal
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs bg-white text-emerald-800 shadow-md hover:bg-emerald-50 transition-all"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-full text-xs font-bold text-white bg-black/25 hover:bg-black/40 backdrop-blur-md border border-white/30 transition-all shadow-sm"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs bg-white text-[#5b875c] shadow-md hover:bg-emerald-50 transition-all transform hover:-translate-y-0.5"
                >
                  <span>Open Store</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#5b875c]" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO CANVAS (9:8 FRAMING WITH MIRROR-PADDED LOOPING VIDEO) ──────── */}
      <section className="relative w-full overflow-hidden min-h-[920px] lg:min-h-[1020px] flex flex-col justify-between pt-24 pb-16">
        {/* Layer 1: Hand-painted Ghibli pastoral plate + Looping Video Overlay */}
        <div className="absolute inset-0 z-0 select-none pointer-events-none overflow-hidden">
          {/* Static Background Plate */}
          <img
            src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/3ca5d10d-ea2f-4907-876f-33bde169469e.jpg"
            alt="Hollyoak pastoral meadow hillside, boy and beagle looking at sunny cumulus sky"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />

          {/* Ambient Video Overlay: 100% width, 112.5% height, top -6.25% */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute left-0 w-full object-cover pointer-events-none opacity-90 transition-opacity duration-1000"
            style={{
              height: '112.5%',
              top: '-6.25%',
              mixBlendMode: 'screen',
            }}
          >
            <source
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/d2cb5bef-f92b-4e91-ae93-8dc6555e56ac.mp4"
              type="video/mp4"
            />
          </video>

          {/* Atmospheric Contrast Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-950/20 to-black/30" />
          <div className="absolute inset-0 bg-radial-at-c from-transparent via-transparent to-emerald-950/40" />
        </div>

        {/* Layer 2: Centered Copy & Grandstander Title */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 flex flex-col items-start">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/35 shadow-sm mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-mono text-white uppercase tracking-widest font-black drop-shadow">
              HOLLYOAK&apos;S RURAL REVOLUTION
            </span>
          </div>

          <div className="flex flex-col select-none">
            <h1 className="font-['Grandstander'] text-6xl sm:text-7xl md:text-8xl lg:text-[104px] text-white font-black drop-shadow-[0_6px_22px_rgba(20,83,45,0.7)] leading-[0.92] tracking-tight">
              PLUCKY
            </h1>
            <h1 className="font-['Grandstander'] text-6xl sm:text-7xl md:text-8xl lg:text-[104px] text-emerald-200 font-black drop-shadow-[0_6px_26px_rgba(20,83,45,0.75)] leading-[0.92] tracking-tight mt-1">
              SPROUT SQUAD
            </h1>
          </div>

          <p className="text-base sm:text-xl md:text-2xl text-white/95 max-w-2xl mt-6 font-medium leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
            Learn the Ways of the Meadow with Hollyoak&apos;s Plucky Sprout Squad! The high-speed rural billing ERP and statutory Form O platform engineered for agri-retailers.
          </p>

          {/* Action Button Row */}
          <div className="flex flex-wrap items-center gap-4 mt-8">
            <Link
              to="/register"
              className="flex items-center justify-center px-8 py-3.5 rounded-full bg-white text-[#5b875c] font-black text-sm sm:text-base shadow-2xl hover:bg-emerald-50 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
            >
              Join us / Launch Store
            </Link>

            <button
              type="button"
              onClick={() => {
                const target = document.getElementById('portal-auth');
                if (target) target.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full shadow-lg backdrop-blur-md transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
              style={{
                backgroundColor: 'rgba(204, 218, 173, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.45)',
              }}
            >
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Play className="w-3.5 h-3.5 fill-emerald-900 text-emerald-900 ml-0.5" />
              </div>
              <span className="font-bold text-emerald-950 text-xs sm:text-sm">
                Explore Console Demo
              </span>
            </button>
          </div>
        </div>

        {/* Layer 3: Chapters & Specialized Modules Carousel Row */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 md:mt-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="font-['Grandstander'] text-base sm:text-lg font-black text-white uppercase tracking-wider drop-shadow-md">
                CHAPTERS &amp; MODULES
              </h2>
            </div>
            <a
              href="#features"
              className="font-mono text-xs sm:text-sm text-white/90 hover:text-white flex items-center gap-1 drop-shadow transition-colors group"
            >
              <span>browse all platform chapters</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* 3 Bespoke Chapter Cards with CloudFront WebP Artwork */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CHAPTER_FEATURES.map((feature) => (
              <div
                key={feature.id}
                onClick={() => {
                  if (feature.id === 'agri-doctor') {
                    setIsAgriDoctorOpen(true);
                  } else {
                    setActivePreview(feature);
                  }
                }}
                className="group relative rounded-2xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:shadow-emerald-950/40 cursor-pointer border border-white/25"
              >
                <div className="h-48 md:h-52 w-full overflow-hidden relative">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                  <div className="absolute bottom-3 left-3 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:bg-emerald-600 group-hover:text-white text-emerald-800 transition-colors">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-white/90 text-emerald-900 font-mono text-[10px] font-black uppercase shadow-sm">
                    {feature.badge}
                  </div>
                </div>

                <div className="p-5 bg-white/95 backdrop-blur-md">
                  <span className="font-mono text-[11px] text-[#5b875c] uppercase tracking-wider font-bold block mb-1">
                    {feature.subtitle}
                  </span>
                  <h3 className="text-base font-bold text-emerald-950 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TABBED PORTAL AUTHENTICATION HUB ─────────────────────────────────── */}
      <section id="portal-auth" className="w-full py-16 md:py-24 bg-gradient-to-b from-[#faf8ff] via-[#f0f4ff] to-[#faf8ff] border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-mono text-xs uppercase tracking-widest font-bold mb-3 border border-emerald-200">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero-Friction Access Gateway</span>
            </div>
            <h2 className="font-['Grandstander'] text-3xl md:text-4xl text-emerald-950 font-black tracking-tight">
              NockBill Multi-Tenant Store Portal
            </h2>
            <p className="text-slate-600 max-w-2xl mt-2 text-sm md:text-base">
              Sign into your agro-center counter or register your dealership in under 2 minutes with complete FCO compliance verification.
            </p>
          </div>

          {/* Tab Switcher Box */}
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-2 p-2 bg-slate-50 border-b border-slate-200 gap-2">
              <button
                type="button"
                id="portal-tab-login"
                onClick={() => setAuthTab('login')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Store className="w-4 h-4 text-emerald-700" />
                <span>Store &amp; Cashier Login</span>
              </button>
              <button
                type="button"
                id="portal-tab-register"
                onClick={() => setAuthTab('register')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <span>New Agri-Dealer Registration</span>
              </button>
            </div>

            <div className="p-6 md:p-10">
              {authTab === 'login' ? (
                <form onSubmit={handlePortalSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="portal-store-slug" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Store Identifier / Slug
                      </label>
                      <input
                        id="portal-store-slug"
                        type="text"
                        value={storeSlug}
                        onChange={(e) => setStoreSlug(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono text-slate-900 bg-slate-50"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">Your assigned cloud node subdomain.</span>
                    </div>

                    <div>
                      <label htmlFor="portal-role-select" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        IAM Role Selector
                      </label>
                      <select
                        id="portal-role-select"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm text-slate-900 bg-slate-50"
                      >
                        <option value="owner">Owner / Root Administrator</option>
                        <option value="manager">Store Manager (Pricing &amp; Batches)</option>
                        <option value="cashier">Counter Cashier (POS Locked)</option>
                        <option value="agronomist">Agri Doctor Specialist</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="portal-username" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Username or Cashier PIN
                      </label>
                      <input
                        id="portal-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono text-slate-900 bg-slate-50"
                      />
                    </div>

                    <div>
                      <label htmlFor="portal-password" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Security Password
                      </label>
                      <input
                        id="portal-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono text-slate-900 bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                      <span className="text-xs font-semibold text-emerald-950">Demo Node Credentials Ready:</span>
                      <span className="font-mono text-xs text-emerald-800 font-bold">green-valley-agro</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleFillDemo}
                      className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      1-Click Auto-Fill
                    </button>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
                      <input type="checkbox" defaultChecked className="rounded text-emerald-700 focus:ring-emerald-500" />
                      <span>Remember till on this terminal</span>
                    </label>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-8 py-3 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Launch Counter POS</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handlePortalSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-legal-name" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Agro Center Legal Name
                      </label>
                      <input
                        id="reg-legal-name"
                        type="text"
                        placeholder="e.g. Kaveri Agro Seeds &amp; Fertilisers"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm bg-slate-50"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-license-no" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Fertilizer / Pesticide Lic No.
                      </label>
                      <input
                        id="reg-license-no"
                        type="text"
                        placeholder="e.g. KA-MND-2026-F84"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm font-mono bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="reg-gstin" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        GSTIN Number
                      </label>
                      <input
                        id="reg-gstin"
                        type="text"
                        placeholder="29AABCU9603R1ZM"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm font-mono bg-slate-50"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-state" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        State &amp; District
                      </label>
                      <select
                        id="reg-state"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm bg-slate-50"
                      >
                        <option>Karnataka (Mandya)</option>
                        <option>Karnataka (Mysuru)</option>
                        <option>Maharashtra (Nashik)</option>
                        <option>Andhra Pradesh (Guntur)</option>
                        <option>Punjab (Ludhiana)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="reg-phone" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Owner Mobile (OTP)
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        placeholder="+91 98450 XXXXX"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm font-mono bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 leading-relaxed">
                      <strong>Statutory Guarantee:</strong> Automated registration triggers automatic Form O and Seed Certificate ledgers synced with local Directorate of Agriculture guidelines.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Register Agro Center (14-Day Free Pilot)</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATE-WIDE NETWORK TELEMETRY ───────────────────────────────────── */}
      <section className="w-full px-4 sm:px-6 lg:px-8 py-16 bg-[#faf8ff]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-emerald-800">
                <Activity className="w-5 h-5 text-emerald-700" />
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-800 font-black">
                  STATE-WIDE NETWORK TELEMETRY
                </span>
              </div>
              <h2 className="font-['Grandstander'] text-3xl md:text-4xl text-emerald-950 font-black tracking-tight mt-1">
                Unified Rural Commerce Grid
              </h2>
              <p className="text-sm md:text-base text-slate-600 max-w-xl mt-1">
                Live statutory sync across retail hubs, fertilizer ration nodes, and community credit cooperatives.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <span className="font-mono text-xs text-slate-700 font-semibold">NIC Ag-Stack Gateway:</span>
              <span className="text-[11px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                OPERATIONAL
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-[#5b875c] uppercase tracking-wider font-bold">Active Agro-Centers</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Store className="w-5 h-5" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl text-emerald-950 font-black">12,482</span>
                <span className="text-xs text-emerald-700 flex items-center font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                  +18.4% YoY
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Registered fertilizer, seed, and biopesticide counters online.
              </p>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: '82%' }} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-sky-700 uppercase tracking-wider font-bold">Form O Cleared Volume</span>
                <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
                  <ShieldCheck className="w-5 h-5" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl text-emerald-950 font-black">₹84.22 Cr</span>
                <span className="text-xs text-sky-700 flex items-center font-bold bg-sky-50 px-2 py-0.5 rounded-full">
                  100% CIB Audited
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Regulated bulk urea, DAP, and complex sales with zero discrepancy.
              </p>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-sky-600 h-full rounded-full" style={{ width: '96%' }} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-amber-700 uppercase tracking-wider font-bold">Khata Recovery Rate</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <Receipt className="w-5 h-5" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl text-emerald-950 font-black">94.6%</span>
                <span className="text-xs text-amber-700 flex items-center font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                  14-Day Cycle
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Automated English WhatsApp receipt reminders with UPI link.
              </p>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-600 h-full rounded-full" style={{ width: '94%' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── OPERATIONAL MODULE CONSOLES BENTO GRID ──────────────────────────── */}
      <section id="features" className="w-full px-4 sm:px-6 lg:px-8 py-16 bg-slate-100/70">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-6 h-6 text-emerald-900" />
              <h3 className="font-['Grandstander'] text-2xl font-black text-emerald-950">
                Fast Operational Consoles
              </h3>
            </div>
            <span className="font-mono text-xs text-slate-500 font-semibold">
              TOUCH TARGET OPTIMIZED · GLOVED OPERATOR READY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Link
              to="/billing"
              className="group flex flex-col justify-between p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-sm">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">[F1 KEY]</span>
                </div>
                <h4 className="text-base text-emerald-950 group-hover:text-emerald-700 transition-colors font-bold">
                  POS Quick Billing
                </h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Barcode scan, 80mm thermal receipt dispatcher, and integrated credit drawer.
                </p>
              </div>
              <div className="flex items-center justify-between pt-6 mt-4 text-emerald-700 font-semibold text-xs border-t border-slate-100">
                <span>Launch Counter</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              to="/inventory"
              className="group flex flex-col justify-between p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shadow-sm">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-1 rounded-md font-bold">EXPIRY WATCH</span>
                </div>
                <h4 className="text-base text-emerald-950 group-hover:text-emerald-700 transition-colors font-bold">
                  Inventory &amp; Batches
                </h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  FIFO batch tracking, seed germination expiry alerts, and fertilizer warehouse lots.
                </p>
              </div>
              <div className="flex items-center justify-between pt-6 mt-4 text-sky-700 font-semibold text-xs border-t border-slate-100">
                <span>Manage Batches</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              to="/khata"
              className="group flex flex-col justify-between p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-sm">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded-md font-bold">FORM-O SYNC</span>
                </div>
                <h4 className="text-base text-emerald-950 group-hover:text-emerald-700 transition-colors font-bold">
                  Khata &amp; Form O
                </h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Grower ledger books, Aadhaar subsidy caps, and verified dealer endorsement slips.
                </p>
              </div>
              <div className="flex items-center justify-between pt-6 mt-4 text-amber-700 font-semibold text-xs border-t border-slate-100">
                <span>Review Ledgers</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              to="/settings"
              className="group flex flex-col justify-between p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shadow-sm">
                    <Lock className="w-6 h-6" />
                  </div>
                  <span className="font-mono text-[10px] bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-bold">ROLE RBAC</span>
                </div>
                <h4 className="text-base text-emerald-950 group-hover:text-emerald-700 transition-colors font-bold">
                  IAM &amp; Invoice Setup
                </h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Cashier shift limits, till locks, and thermal header template customizer.
                </p>
              </div>
              <div className="flex items-center justify-between pt-6 mt-4 text-purple-700 font-semibold text-xs border-t border-slate-100">
                <span>Security Console</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── HARDWARE MATRIX & 80MM ESC/POS BILLING SIMULATOR ────────────────── */}
      <section className="w-full px-4 sm:px-6 lg:px-8 py-16 bg-[#faf8ff]">
        <div className="max-w-7xl mx-auto bg-slate-100/80 rounded-3xl p-6 md:p-12 border border-slate-200">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="flex flex-col max-w-xl">
              <span className="font-mono text-xs bg-emerald-100 text-emerald-900 uppercase px-3 py-1 rounded-full font-bold w-fit mb-3">
                FIELD-HARDENED HARDWARE INTEGRATION
              </span>
              <h3 className="font-['Grandstander'] text-3xl md:text-4xl text-emerald-950 font-black tracking-tight">
                80mm ESC/POS Thermal Engine
              </h3>
              <p className="text-sm md:text-base text-slate-600 mt-3 leading-relaxed">
                Engineered for high-dust counter environments with instantaneous thermal ESC/POS protocol execution. Supports vernacular farmer SMS dispatch and dynamic UPI collection QR codes.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <Printer className="w-5 h-5 text-emerald-700" />
                  <span className="text-xs font-semibold text-emerald-950">TVS &amp; Epson 80mm</span>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <QrCode className="w-5 h-5 text-emerald-700" />
                  <span className="text-xs font-semibold text-emerald-950">USB / BT Barcode Guns</span>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <Scale className="w-5 h-5 text-emerald-700" />
                  <span className="text-xs font-semibold text-emerald-950">Weighing Serial Link</span>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <Fingerprint className="w-5 h-5 text-emerald-700" />
                  <span className="text-xs font-semibold text-emerald-950">Biometric Aadhaar Till</span>
                </div>
              </div>
            </div>

            {/* Simulated 80mm Receipt */}
            <div className="w-full max-w-[340px] bg-white p-5 shadow-2xl rounded-xl font-mono text-xs text-slate-900 select-none border border-slate-200">
              <div className="text-center pb-2">
                <span className="text-xs font-bold block text-emerald-950">GREEN VALLEY AGRO RETAIL</span>
                <span className="text-[10px] text-slate-500 block">Mandya Dist Hub, Lic: KA-BLR-F9</span>
                <span className="text-[10px] text-slate-500 block">GSTIN: 29AABCU9603R1ZM</span>
                <span className="text-[10px] text-emerald-700 font-bold block mt-1">FORM O VERIFIED RECEIPT</span>
              </div>
              <div className="py-1.5 my-1 border-t border-b border-dashed border-slate-300 flex justify-between text-[10px] text-slate-500">
                <span>INV: #NB-98421</span>
                <span>26-NOV-2026 10:42</span>
              </div>
              <div className="text-[11px] py-1">
                <div className="flex justify-between font-bold">
                  <span>FARMER: Ramesh Gowda</span>
                  <span className="text-amber-700">[CREDIT]</span>
                </div>
                <span className="text-[10px] text-slate-500 block">Aadhaar: XXXX-XXXX-4912</span>
              </div>
              <div className="py-2 space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold block">IFFCO Neem Urea (45kg)</span>
                    <span className="text-[9px] text-slate-500">BATCH: UF-902 | HSN: 3102</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold">2 x 266.50</span>
                    <span className="font-bold">₹533.00</span>
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold block">Bayer Regent 0.3G (1kg)</span>
                    <span className="text-[9px] text-slate-500">BATCH: BR-411 | HSN: 3808</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold">1 x 640.00</span>
                    <span className="font-bold">₹640.00</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal (CGST+SGST Incl.)</span>
                  <span>₹1,173.00</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>DBT Subsidy Deduction</span>
                  <span>-₹120.00</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-900 text-emerald-950">
                  <span>NET PAYABLE</span>
                  <span>₹1,053.00</span>
                </div>
              </div>
              <div className="text-center pt-3 mt-3 border-t border-dashed border-slate-300">
                <span className="text-[10px] font-semibold text-emerald-950 block">Thank you for nourishing the earth!</span>
                <span className="text-[9px] text-[#5b875c] block mt-0.5">Powered by Meadowbell Sprout Core V4.2</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PUBLIC FOOTER ───────────────────────────────────────────────────── */}
      <footer className="w-full bg-emerald-950 text-white/90 pt-16 pb-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-white/10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-emerald-400 flex items-center justify-center text-emerald-950 font-bold">
                  <Sprout className="w-4 h-4 text-emerald-950" />
                </div>
                <span className="font-['Grandstander'] font-bold text-lg text-white">NockBill Meadowbell</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                The next-generation rural retail operating system and agricultural billing standard designed for resilient cooperatives and input dealers.
              </p>
              <div className="flex items-center gap-2 mt-4 text-xs text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                <span>CIB&amp;RC &amp; FCO 1985 Certified</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3">Solutions</h4>
              <ul className="space-y-2 text-xs text-white/80">
                <li><Link to="/billing" className="hover:text-white transition-colors">Fast Counter POS [F1]</Link></li>
                <li><Link to="/khata?tab=compliance" className="hover:text-white transition-colors">Fertilizer Form O Records</Link></li>
                <li><Link to="/khata" className="hover:text-white transition-colors">Digital Farmer Khata</Link></li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsAgriDoctorOpen(true)}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Agri Doctor Disease AI
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3">Statutory Standards</h4>
              <ul className="space-y-2 text-xs text-white/80">
                <li><span>Fertilizer Control Order (FCO 1985)</span></li>
                <li><span>Insecticides Act 1968 Compliance</span></li>
                <li><span>Aadhaar POS Ration Ledger</span></li>
                <li><span>State NIC Ag-Stack Direct API</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3">Dealership Support</h4>
              <p className="text-xs text-white/70 mb-3">Need on-site terminal setup, ESC/POS printer driver packs, or barcode rolls?</p>
              <Link
                to="/register"
                className="inline-block w-full text-center py-2.5 px-4 rounded-full bg-emerald-400 text-emerald-950 font-bold text-xs hover:bg-white transition-all"
              >
                Contact Support Desk
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-white/60 gap-4">
            <span>&copy; 2026 NockBill Technologies Pvt Ltd. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <a href="#features" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#features" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#features" className="hover:text-white transition-colors">Security Architecture</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── FLOATING AGRI DOCTOR ICON IN RIGHT BOTTOM CORNER ─────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 group">
        {/* Subtle Tooltip Pill */}
        <div className="bg-emerald-950/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg border border-emerald-500/30 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-200 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Agri Doctor AI · Crop Diagnosis</span>
        </div>

        {/* Floating Beacon Button */}
        <button
          type="button"
          id="floating-agri-doctor-btn"
          aria-label="Open Agri Doctor AI Crop Advisory"
          onClick={() => setIsAgriDoctorOpen(true)}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-white/80 cursor-pointer"
        >
          {/* Pulsing Beacon Ring */}
          <span className="absolute -inset-1 rounded-full bg-emerald-400/40 animate-ping pointer-events-none" />

          {/* Stethoscope + Leaf Icon Hybrid */}
          <div className="relative z-10 flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-white stroke-[2.2]" />
            <Sprout className="w-3.5 h-3.5 text-emerald-200 absolute -top-1 -right-1" />
          </div>

          {/* Micro Notification Dot */}
          <span className="absolute top-1 right-1 w-3 h-3 bg-amber-400 border-2 border-white rounded-full" />
        </button>
      </div>

      {/* ─── AGRI DOCTOR MODAL (POPUP ON FRONT PAGE) ─────────────────────────── */}
      <AgriDoctorModal
        isOpen={isAgriDoctorOpen}
        onClose={() => setIsAgriDoctorOpen(false)}
      />

      {/* ─── CHAPTER PREVIEW MODAL ───────────────────────────────────────────── */}
      {activePreview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setActivePreview(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <span className={`font-mono text-xs uppercase px-2.5 py-0.5 rounded-full ${activePreview.badgeColor} font-bold mb-2 inline-block border`}>
              {activePreview.badge}
            </span>
            <h3 className="text-xl font-bold text-emerald-950 mt-1">
              {activePreview.title}
            </h3>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              {activePreview.description}
            </p>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActivePreview(null)}
                className="px-5 py-2 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <Link
                to={activePreview.route}
                className="px-5 py-2 rounded-full text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm cursor-pointer"
              >
                Explore In Console
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
