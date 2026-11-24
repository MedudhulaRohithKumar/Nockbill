import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Package,
  ShoppingBag,
  BarChart3,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  Sprout,
  RotateCcw,
  Tag,
  BookOpen,
  Send,
  Users,
  Truck,
  ShieldCheck,
  ChevronRight,
  Bell,
  Sun,
  Moon,
  Lock,
  UserCheck,
  KeyRound,
  Banknote,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { reportsApi } from '../../api';
import { formatCurrency } from '../../utils/formatters';

interface NavFlyoutItem {
  to: string;
  label: string;
  shortcut?: string;
  badge?: string;
}

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  badge?: string;
  flyoutTitle: string;
  flyoutBadge: string;
  flyoutItems: NavFlyoutItem[];
}

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { settings } = useShop();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [drawerCash, setDrawerCash] = useState<number>(42850);
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      const isDarkCookie = document.cookie.includes('theme=dark');
      const isSystemDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDarkCookie || document.documentElement.classList.contains('dark') || Boolean(isSystemDark);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        document.cookie = 'theme=dark;path=/;max-age=31536000';
      } else {
        document.documentElement.classList.remove('dark');
        document.cookie = 'theme=light;path=/;max-age=31536000';
      }
      return next;
    });
  };

  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  // Fetch live counter cash drawer telemetry from reports API
  const fetchTelemetry = useCallback(async () => {
    setIsRefreshingTelemetry(true);
    try {
      const summary = await reportsApi.getDashboard();
      if (summary && typeof summary.today_sales === 'number') {
        setDrawerCash(summary.today_sales > 0 ? summary.today_sales : 42850);
      }
    } catch {
      // Graceful fallback to default counter float balance
    } finally {
      setIsRefreshingTelemetry(false);
    }
  }, []);

  useEffect(() => {
    void fetchTelemetry();
  }, [fetchTelemetry]);

  // Global hotkeys (F1-F10) for rapid counter switching
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        navigate('/pos');
      } else if (e.key === 'F2') {
        e.preventDefault();
        navigate('/inventory');
      } else if (e.key === 'F3' && isOwner) {
        e.preventDefault();
        navigate('/price-lists');
      } else if (e.key === 'F4') {
        e.preventDefault();
        navigate('/purchases');
      } else if (e.key === 'F6') {
        e.preventDefault();
        navigate('/khata');
      } else if (e.key === 'F7') {
        e.preventDefault();
        navigate('/returns');
      } else if (e.key === 'F8') {
        e.preventDefault();
        navigate('/campaigns');
      } else if (e.key === 'F10') {
        e.preventDefault();
        navigate('/analytics');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [navigate, isOwner]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems: NavItemDef[] = useMemo(() => [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      shortcut: 'F0',
      badge: 'LIVE',
      flyoutTitle: 'Modern Fluid ERP Dashboard',
      flyoutBadge: 'OVERVIEW',
      flyoutItems: [
        { to: '/dashboard', label: '🌾 Today’s Gross & Kharif Cycle', shortcut: 'LIVE' },
        { to: '/dashboard', label: '⚡ Counter Till & Fast-Till Radar' },
        { to: '/dashboard', label: '⚠️ FIFO Expiry Radar (<30 Days)' },
        { to: '/khata?tab=compliance', label: '📜 Form O Allocated Quotas' },
      ],
    },
    {
      to: '/pos',
      label: 'POS Billing',
      icon: Receipt,
      shortcut: 'F1',
      badge: 'Quick',
      flyoutTitle: 'POS Quick Billing Terminal',
      flyoutBadge: 'ACTIVE TILL',
      flyoutItems: [
        { to: '/pos', label: '⚡ New Fertilizer Bill', shortcut: '[F1]' },
        { to: '/pos', label: '⚡ Fast Counter Bill', shortcut: 'Fast' },
        { to: '/pos?mode=invoices', label: '📜 Recent Invoices & 80mm Slips' },
        { to: '/pos', label: '🔍 Instant Farmer Mobile Lookup' },
      ],
    },
    {
      to: '/returns',
      label: 'Sales Returns',
      icon: RotateCcw,
      shortcut: 'F7',
      flyoutTitle: 'Sales Returns & Credit Notes',
      flyoutBadge: 'REFUNDS',
      flyoutItems: [
        { to: '/returns', label: '🔄 Reverse Bill Search', shortcut: '[F7]' },
        { to: '/returns?mode=credit-note', label: '🧾 Issue GST Credit Note' },
        { to: '/returns?mode=defect', label: '📦 Batch Defect & Quarantine' },
      ],
    },
    {
      to: '/khata',
      label: 'Khata & Compliance',
      icon: BookOpen,
      shortcut: 'F6',
      badge: 'Credit',
      flyoutTitle: 'Farmer Khata & Form O Compliance',
      flyoutBadge: 'LEDGER',
      flyoutItems: [
        { to: '/khata?tab=farmers', label: '👥 Farmer Credit Ledger (Khata)', shortcut: '[F6]' },
        { to: '/khata?tab=suppliers', label: '🚚 Supplier Payables Ledger' },
        { to: '/khata?tab=compliance', label: '🛡️ Form O Statutory Audit Register' },
        { to: '/khata?tab=farmers', label: '💬 WhatsApp 1-Click Payment Chaser' },
      ],
    },
    {
      to: '/campaigns',
      label: 'WhatsApp Broadcast',
      icon: Send,
      shortcut: 'F8',
      badge: 'Marketing',
      flyoutTitle: 'WhatsApp Broadcast & Crop Campaigns',
      flyoutBadge: 'META CLOUD',
      flyoutItems: [
        { to: '/campaigns', label: '📢 Seasonal Kharif/Rabi Outbreak Alert', shortcut: '[F8]' },
        { to: '/campaigns', label: '💬 Meta Cloud API Dispatcher' },
        { to: '/campaigns', label: '📱 Live Smartphone Chat Simulator' },
        { to: '/campaigns', label: '🏷️ Audience Cluster Matcher' },
      ],
    },
    {
      to: '/inventory',
      label: 'Inventory & Stock',
      icon: Package,
      shortcut: 'F2',
      flyoutTitle: 'Inventory & Godown Stock Management',
      flyoutBadge: 'STOCK',
      flyoutItems: [
        { to: '/inventory', label: '📦 SKU Master & FIFO Batches', shortcut: '[F2]' },
        { to: '/inventory', label: '🏷️ 50x25mm Barcode Label Simulator' },
        { to: '/inventory', label: '⚠️ Near-Expiry Alerts (<45 Days)' },
        { to: '/inventory', label: '📍 Godown Bay Allocation (Bays A-D)' },
      ],
    },
    ...(isOwner
      ? [
          {
            to: '/price-lists',
            label: 'Price Lists',
            icon: Tag,
            shortcut: 'F3',
            badge: 'Owner',
            flyoutTitle: 'Price Lists & Tier Pricing',
            flyoutBadge: 'MARGINS',
            flyoutItems: [
              { to: '/price-lists', label: '🏷️ 4-Tier Price Matrix', shortcut: '[F3]' },
              { to: '/price-lists', label: '📊 Automated Margin Guardrails' },
              { to: '/price-lists', label: '📜 Form O APMC Price Board PDF' },
            ],
          },
        ]
      : []),
    {
      to: '/purchases',
      label: 'Inward Purchases',
      icon: ShoppingBag,
      shortcut: 'F4',
      flyoutTitle: 'Inward / Godown Purchases',
      flyoutBadge: 'GRN',
      flyoutItems: [
        { to: '/purchases', label: '🚚 Inward Delivery Challan Entry', shortcut: '[F4]' },
        { to: '/purchases?mode=new', label: '📑 Supplier GST Tax Inward' },
        { to: '/purchases', label: '📦 Godown Bay Intake Reconciliation' },
      ],
    },
    {
      to: '/reports',
      label: 'GST & Reports',
      icon: BarChart3,
      shortcut: 'F5',
      flyoutTitle: 'GST & Statutory Reports',
      flyoutBadge: 'AUDIT',
      flyoutItems: [
        { to: '/reports', label: '📊 GSTR-1 & B2C Daily Registers', shortcut: '[F5]' },
        { to: '/reports?type=form-o', label: '🌾 Form O State APMC Filings' },
        { to: '/reports?type=hsn', label: '📑 HSN-wise Fertilizer & Pesticide Tax' },
      ],
    },
    {
      to: '/analytics',
      label: 'Analytics',
      icon: TrendingUp,
      shortcut: 'F10',
      badge: 'Live',
      flyoutTitle: 'Business Analytics & Insights',
      flyoutBadge: 'METRICS',
      flyoutItems: [
        { to: '/analytics', label: '📈 Seasonal Margin Velocity Curve', shortcut: '[F10]' },
        { to: '/analytics', label: '🍩 Category Profit Mix (FCO vs CIB vs Seeds)' },
        { to: '/analytics', label: '⏳ Credit Aging Risk Brackets' },
        { to: '/analytics', label: '🤖 Agri Doctor Restocking Radar' },
      ],
    },
    {
      to: '/settings',
      label: 'Settings & Config',
      icon: Settings,
      shortcut: 'F12',
      flyoutTitle: 'Store Settings & Hardware Config',
      flyoutBadge: 'ADMIN',
      flyoutItems: [
        { to: '/settings', label: '🏪 Dealership & APMC Profile', shortcut: '[F12]' },
        { to: '/settings', label: '🖨️ ESC/POS 80mm Thermal Hardware' },
        { to: '/settings', label: '💳 Canara Bank Merchant Dynamic UPI QR' },
        { to: '/settings', label: '👥 Cashier & RBAC Terminal PINs' },
      ],
    },
  ], [isOwner]);

  const bottomNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/pos', label: 'Billing', icon: Receipt },
    { to: '/inventory', label: 'Stock', icon: Package },
    { to: '/khata', label: 'Credit', icon: BookOpen },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ];

  // User initials for the bottom profile badge
  const userInitials = useMemo(() => {
    if (user?.full_name) {
      return user.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    return (user?.username || 'OP').slice(0, 2).toUpperCase();
  }, [user]);

  const shopNameDisplay = settings.shop_name || `${user?.full_name || 'Store'}'s Agro Kendra`;
  const gstinDisplay = settings.gstin ? settings.gstin.slice(0, 10) : 'KA-BLR-2023';

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 font-sans text-on-surface dark:text-slate-100 antialiased flex flex-col transition-colors">
      {/* =========================================================================
          1. COMPACT VERTICAL ICON RAIL (w-20 / 80px)
      ========================================================================= */}
      <aside
        aria-label="Sidebar Navigation"
        className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 z-40 bg-surface-container-low dark:bg-slate-900 border-r border-outline-variant/30 dark:border-slate-800 flex-col justify-between py-3.5 select-none transition-colors"
      >
        {/* Top: Sprout Branding Emblem with gentle pulse */}
        <div className="flex flex-col items-center gap-3">
          <Link
            to="/dashboard"
            title={`${shopNameDisplay} • NockBill Agro ERP`}
            className="w-11 h-11 bg-primary text-on-primary rounded-xl flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95 group relative"
          >
            <Sprout className="w-6 h-6 animate-pulse" />
            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </Link>

          {/* Navigation Items with Smart Hover Flyouts */}
          <nav className="flex flex-col items-center gap-1.5 mt-2 w-full px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.to ||
                (item.to === '/pos' && location.pathname === '/billing') ||
                (item.to === '/inventory' && location.pathname === '/products') ||
                (item.to === '/campaigns' && location.pathname === '/marketing') ||
                (item.to === '/returns' && location.pathname === '/sales-returns');

              return (
                <div key={item.to} className="relative group flex items-center justify-center w-full">
                  <NavLink
                    to={item.to}
                    aria-label={item.label}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 relative ${
                      isActive
                        ? 'bg-primary text-on-primary shadow-sm font-bold'
                        : 'text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-emerald-400 hover:bg-primary-container/20 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5 stroke-[2.2]" />

                    {/* Keyboard shortcut tiny tag */}
                    <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-mono font-bold bg-surface-container-high/90 dark:bg-slate-800 text-primary dark:text-emerald-400 px-1 py-0.2 rounded-xs shadow-2xs">
                      {item.shortcut}
                    </span>
                  </NavLink>

                  {/* Smart Floating Sub-Category Box */}
                  <div className="absolute left-20 ml-2 top-0 invisible opacity-0 translate-x-2 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50 w-64 bg-surface-container-lowest/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-outline-variant/30 dark:border-slate-800 p-3 pointer-events-auto">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container-high dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="font-bold text-xs text-on-surface dark:text-white truncate max-w-[140px]">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-primary dark:text-emerald-400 bg-primary-container/20 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full uppercase">
                        {item.flyoutBadge}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {item.flyoutItems.map((sub, sIdx) => (
                        <Link
                          key={sIdx}
                          to={sub.to}
                          className="flex items-center justify-between px-2.5 py-1.5 text-xs text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-emerald-400 hover:bg-primary-container/15 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                        >
                          <span className="truncate pr-1">{sub.label}</span>
                          {sub.shortcut && (
                            <span className="text-[9px] font-mono font-bold text-outline-variant dark:text-slate-500 shrink-0">
                              {sub.shortcut}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile Trigger with Admin Flyout */}
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-outline-variant/20 dark:border-slate-800 w-full px-2">
          <div className="relative group flex items-center justify-center w-full">
            <button
              type="button"
              aria-label="User Profile and Session Options"
              className="w-11 h-11 rounded-full bg-forest-emerald text-on-primary font-black text-xs flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95 ring-2 ring-emerald-200 dark:ring-emerald-800"
            >
              {userInitials}
            </button>

            {/* Operator Details & PIN Switcher Flyout */}
            <div className="absolute left-20 ml-2 bottom-0 invisible opacity-0 translate-x-2 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50 w-64 bg-surface-container-lowest/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-outline-variant/30 dark:border-slate-800 p-3.5 pointer-events-auto">
              <div className="flex items-center gap-2.5 pb-2.5 mb-2.5 border-b border-surface-container-high dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {userInitials}
                </div>
                <div className="overflow-hidden">
                  <div className="font-bold text-xs text-on-surface dark:text-white truncate">
                    {user?.full_name || user?.username || 'Store Operator'}
                  </div>
                  <div className="text-[10px] font-mono text-outline-variant dark:text-slate-400 truncate">
                    @{user?.username || 'operator'}
                  </div>
                  <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 uppercase">
                    {isOwner ? 'ADMINISTRATOR' : 'CASHIER POS'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Link
                  to="/settings"
                  className="flex items-center justify-between px-2.5 py-1.5 text-xs text-on-surface-variant dark:text-slate-300 hover:text-primary dark:hover:text-emerald-400 hover:bg-primary-container/15 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-outline dark:text-slate-400" />
                    <span>Terminal PIN & Roster</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-outline-variant dark:text-slate-500" />
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-critical-rose hover:bg-critical-rose-bg/60 dark:hover:bg-rose-950/40 rounded-lg transition-colors font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Lock Till & Logout</span>
                  </span>
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. STICKY HEADER TELEMETRY RIBBON (h-16 / 64px)
      ========================================================================= */}
      <header
        role="banner"
        className="fixed top-0 left-0 md:left-20 right-0 h-16 z-30 bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-outline-variant/30 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors"
      >
        {/* Left: Mobile Toggle & Store Credentials */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger trigger */}
          <button
            type="button"
            aria-label="Toggle Mobile Menu"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden p-2 text-on-surface-variant dark:text-slate-300 hover:text-primary rounded-xl"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Store Credentials */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-forest-emerald" />
              </span>
              <span className="text-xs sm:text-sm font-black text-on-surface dark:text-white tracking-tight truncate max-w-[200px] sm:max-w-xs">
                {shopNameDisplay}
              </span>
              <span className="hidden sm:inline-block rounded-md bg-surface-container-high dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-bold text-on-surface-variant dark:text-slate-300">
                #{gstinDisplay}
              </span>
            </div>

            {/* Statutory Agricultural Badges */}
            <div className="hidden lg:flex items-center gap-1.5 text-[9px] font-bold mt-0.5">
              <span className="text-outline dark:text-slate-400 uppercase tracking-wider text-[8px]">LICENSES:</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                FERT: {settings.fertilizer_license_no || 'FERT-OK'}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                PEST: {settings.pesticide_license_no || 'PEST-2026'}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                SEED: {settings.seed_license_no || 'SEED-REG'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Telemetry Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Real-time Till / Drawer Cash Balance */}
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 shadow-2xs">
            <Banknote className="h-4 w-4 text-forest-emerald shrink-0" />
            <div className="text-left">
              <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-outline dark:text-slate-400">
                Drawer Cash
              </div>
              <div className="font-mono text-xs sm:text-sm font-black text-on-surface dark:text-white">
                ₹{formatCurrency(drawerCash, 0)}
              </div>
            </div>
          </div>

          {/* Central Govt Cloud Sync Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 text-forest-emerald" />
            <span className="text-[11px] font-bold">Cloud Sync</span>
            <span className="rounded bg-emerald-200/80 dark:bg-emerald-900/80 px-1 py-0.2 text-[9px] font-mono font-bold text-emerald-900 dark:text-emerald-200">
              ONLINE
            </span>
          </div>

          {/* Dark / Light Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="rounded-xl border border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-800 p-2 text-on-surface-variant dark:text-amber-400 hover:text-primary transition-all active:scale-95"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>

          {/* Refresh Telemetry Action */}
          <button
            type="button"
            onClick={() => void fetchTelemetry()}
            disabled={isRefreshingTelemetry}
            aria-label="Refresh Counter Telemetry"
            className="rounded-xl border border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-800 p-2 text-on-surface-variant dark:text-slate-300 hover:text-primary transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Live Telemetry"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshingTelemetry ? 'animate-spin text-primary' : ''}`} />
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setShowNotificationToast(prev => !prev)}
              className="rounded-xl border border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-800 p-2 text-on-surface-variant dark:text-slate-300 hover:text-primary transition-all relative"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-critical-rose" />
            </button>

            {showNotificationToast && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 text-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">
                  <span>Store Notifications</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono">1 NEW</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <p className="font-semibold text-slate-900 dark:text-white">Kharif Cycle Active</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Kharif seasonal catalog and fertilizer quota limits updated.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-outline-variant/30 dark:border-slate-800">
            <div className="text-right">
              <div className="text-xs font-bold text-on-surface dark:text-white truncate max-w-[120px]">
                {user?.full_name || user?.username || 'Store Owner'}
              </div>
              <div className="text-[9px] font-bold tracking-wider text-purple-700 dark:text-purple-400 uppercase">
                {isOwner ? 'Authorized Licensee' : 'Counter Operator'}
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-800 text-xs font-black text-white shadow-xs">
              {userInitials}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          3. RECLAIMED CANVAS WORKSTATION
      ========================================================================= */}
      <main className="md:pl-20 md:pt-16 min-h-screen bg-surface dark:bg-slate-950 text-on-surface dark:text-slate-100 flex-1 overflow-x-hidden pt-16 transition-colors">
        <Outlet />
      </main>

      {/* =========================================================================
          4. MOBILE SLIDE-OVER DRAWER MENU
      ========================================================================= */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="md:hidden fixed inset-0 z-50 flex bg-black/40 backdrop-blur-xs"
        >
          <aside
            aria-label="Mobile Menu"
            className="w-72 bg-white h-full p-4 flex flex-col justify-between shadow-2xl overflow-y-auto"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-xs text-slate-900 truncate max-w-[150px]">{shopNameDisplay}</h2>
                    <p className="text-[10px] text-emerald-700 font-semibold">NockBill Agro ERP</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close Mobile Navigation"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-emerald-700" />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{item.shortcut}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-bold text-critical-rose hover:bg-rose-50 border-t border-slate-100 mt-4"
            >
              <LogOut className="w-4 h-4" />
              <span>Lock Counter & Logout</span>
            </button>
          </aside>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* =========================================================================
          5. MOBILE BOTTOM NAVIGATION BAR
      ========================================================================= */}
      <nav
        aria-label="Mobile Quick Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex items-center justify-around z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || (item.to === '/pos' && location.pathname === '/billing');
          const isBilling = item.to === '/pos';

          if (isBilling) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center -mt-4 relative group"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                  isActive
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-emerald-700/30'
                    : 'bg-emerald-800 text-emerald-100 ring-4 ring-white shadow-emerald-900/20'
                }`}>
                  <Icon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[11px] font-medium transition-colors ${
                isActive ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-emerald-700 stroke-[2.5]' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* Quick Menu Button for Mobile */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[11px] font-medium transition-colors ${
            mobileMenuOpen ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5 mb-0.5 text-emerald-800 stroke-[2.5]" />
          ) : (
            <Menu className="w-5 h-5 mb-0.5 text-slate-400" />
          )}
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};
