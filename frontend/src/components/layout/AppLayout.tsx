import React, { useState, useEffect } from 'react';
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
  ScanLine,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Tag,
  BookOpen,
  Send,
  Users,
  Truck,
  Sparkles,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { INVENTORY_CATEGORIES, INVENTORY_CATEGORY_CONFIGS } from '../../config/inventoryCategories';

const KHATA_SUB_ITEMS = [
  { id: 'farmers', label: 'Farmer Credit Ledger', icon: Users, badge: 'Credit' },
  { id: 'suppliers', label: 'Supplier Payables Ledger', icon: Truck, badge: 'Payables' },
  { id: 'catalog', label: '1-Click Agri Catalog & Clearance', icon: Sparkles, badge: 'Clearance' },
  { id: 'handover', label: 'Cashier Shift Handover', icon: Clock, badge: 'Shift' },
  { id: 'compliance', label: 'Agri Inspector Register (Form O)', icon: ShieldCheck, badge: 'Form O' },
];

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { settings } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inventoryDropdownOpen, setInventoryDropdownOpen] = useState(
    location.pathname.startsWith('/inventory')
  );
  const [khataDropdownOpen, setKhataDropdownOpen] = useState(
    location.pathname.startsWith('/khata')
  );

  useEffect(() => {
    if (location.pathname.startsWith('/inventory')) {
      setInventoryDropdownOpen(true);
    }
    if (location.pathname.startsWith('/khata')) {
      setKhataDropdownOpen(true);
    }
  }, [location.pathname]);

  const activeKhataTab = React.useMemo(() => {
    if (!location.pathname.startsWith('/khata')) return null;
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'farmers';
  }, [location.pathname, location.search]);

  const activeInventoryCategory = React.useMemo(() => {
    if (!location.pathname.startsWith('/inventory')) return null;
    const params = new URLSearchParams(location.search);
    return params.get('category') || 'ALL';
  }, [location.pathname, location.search]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/billing', label: 'New Bill (POS)', icon: Receipt, badge: 'Quick' },
    { to: '/returns', label: 'Sales Returns', icon: RotateCcw },
    { to: '/khata', label: 'Khata & Compliance', icon: BookOpen, badge: 'Credit' },
    { to: '/campaigns', label: 'WhatsApp Broadcast', icon: Send, badge: 'Marketing' },
    { to: '/inventory', label: 'Inventory & Stock', icon: Package },
    ...(isOwner ? [{ to: '/price-lists', label: 'Price Lists', icon: Tag, badge: 'Owner' }] : []),
    { to: '/purchases', label: 'Inward / Purchases', icon: ShoppingBag },
    { to: '/reports', label: 'GST & Reports', icon: BarChart3 },
    { to: '/analytics', label: 'Analytics', icon: TrendingUp, badge: 'Live' },
    { to: '/settings', label: 'Shop Management', icon: Settings },
  ];

  const bottomNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/billing', label: 'Billing', icon: Receipt },
    { to: '/inventory', label: 'Stock', icon: Package },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row pb-24 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col bg-brand-900 text-white shadow-xl z-20 sticky top-0 h-screen">
        {/* Brand header: User's Shop Name on top, NockBill Solutions company name right below */}
        <div className="p-5 border-b border-brand-800 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-500 to-emerald-300 flex items-center justify-center text-brand-950 font-bold shadow-md shrink-0">
            <Sprout className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm tracking-tight truncate text-brand-50" title={settings.shop_name}>
              {settings.shop_name || 'My Shop'}
            </h1>
            <p className="text-[11px] font-semibold text-emerald-300 truncate tracking-wide">
              NockBill Solutions
            </p>
            {settings.gstin && (
              <p className="text-[10px] text-brand-300 truncate mt-0.5">GST: {settings.gstin}</p>
            )}
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            if (item.to === '/khata') {
              const isKhataRoute = location.pathname.startsWith('/khata');
              return (
                <div key={item.to} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={khataDropdownOpen}
                    aria-controls="desktop-khata-subitems"
                    onClick={() => {
                      setKhataDropdownOpen((prev) => !prev);
                      if (!isKhataRoute) {
                        navigate('/khata');
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                      isKhataRoute
                        ? 'bg-brand-700 text-white shadow-sm ring-1 ring-white/20 font-semibold'
                        : 'text-brand-100 hover:bg-brand-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isKhataRoute ? 'text-emerald-300' : 'text-brand-300'}`} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-brand-300 transition-transform duration-200 ${
                        khataDropdownOpen ? 'rotate-180 text-emerald-300' : ''
                      }`}
                    />
                  </button>

                  {khataDropdownOpen && (
                    <div
                      id="desktop-khata-subitems"
                      className="ml-4 pl-3 border-l border-brand-700/80 space-y-0.5 py-1"
                    >
                      {KHATA_SUB_ITEMS.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = isKhataRoute && activeKhataTab === sub.id;
                        return (
                          <Link
                            key={sub.id}
                            to={`/khata?tab=${sub.id}`}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              isSubActive
                                ? 'bg-brand-800 text-emerald-300 font-bold'
                                : 'text-brand-200 hover:bg-brand-800/60 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <SubIcon className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
                              <span className="truncate">{sub.label}</span>
                            </span>
                            {sub.badge && (
                              <span className="text-[9px] bg-brand-700/70 text-brand-200 px-1.5 py-0.5 rounded uppercase font-semibold">
                                {sub.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.to === '/inventory') {
              const isInventoryRoute = location.pathname.startsWith('/inventory');
              return (
                <div key={item.to} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={inventoryDropdownOpen}
                    aria-controls="desktop-inventory-categories"
                    onClick={() => {
                      setInventoryDropdownOpen((prev) => !prev);
                      if (!isInventoryRoute) {
                        navigate('/inventory');
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                      isInventoryRoute
                        ? 'bg-brand-700 text-white shadow-sm ring-1 ring-white/20 font-semibold'
                        : 'text-brand-100 hover:bg-brand-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isInventoryRoute ? 'text-emerald-300' : 'text-brand-300'}`} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-brand-300 transition-transform duration-200 ${
                        inventoryDropdownOpen ? 'rotate-180 text-emerald-300' : ''
                      }`}
                    />
                  </button>

                  {inventoryDropdownOpen && (
                    <div
                      id="desktop-inventory-categories"
                      className="ml-4 pl-3 border-l border-brand-700/80 space-y-0.5 py-1"
                    >
                      <Link
                        to="/inventory"
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isInventoryRoute && activeInventoryCategory === 'ALL'
                            ? 'bg-brand-800 text-emerald-300 font-bold'
                            : 'text-brand-200 hover:bg-brand-800/60 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-300 shrink-0" />
                          <span>All Categories</span>
                        </span>
                      </Link>
                      {INVENTORY_CATEGORIES.map((catId) => {
                        const cfg = INVENTORY_CATEGORY_CONFIGS[catId];
                        const isCatActive =
                          isInventoryRoute &&
                          (activeInventoryCategory || '').toLowerCase() === catId.toLowerCase();
                        return (
                          <Link
                            key={catId}
                            to={`/inventory?category=${encodeURIComponent(catId)}`}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              isCatActive
                                ? 'bg-brand-800 text-white font-bold ring-1 ring-emerald-400/40'
                                : 'text-brand-200 hover:bg-brand-800/60 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
                              <span className="truncate">{cfg.label}</span>
                            </span>
                            <span className="text-[10px] font-mono text-brand-300 shrink-0 ml-1">
                              {cfg.defaultGstRate}%
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-700 text-white shadow-sm ring-1 ring-white/20 font-semibold'
                      : 'text-brand-100 hover:bg-brand-800/80 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-300' : 'text-brand-300'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-brand-500 text-brand-950 font-bold px-2 py-0.5 rounded-full uppercase">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & footer */}
        <div className="p-4 border-t border-brand-800 bg-brand-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                {user?.username?.[0] || 'A'}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Administrator'}</p>
                <p className="text-[11px] text-brand-300 capitalize">{user?.role || 'Owner'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-brand-300 hover:text-red-300 hover:bg-brand-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-brand-900 text-white px-4 py-3 sticky top-0 z-30 shadow flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-8 w-8 rounded-lg bg-emerald-400 text-brand-950 flex items-center justify-center font-bold shrink-0">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="truncate">
            <h2 className="text-sm font-bold truncate leading-tight">{settings.shop_name || 'My Shop'}</h2>
            <p className="text-[10px] font-semibold text-emerald-300 truncate">NockBill Solutions</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NavLink
            to="/billing"
            className="bg-brand-600 hover:bg-brand-500 text-white p-2 rounded-lg flex items-center gap-1 text-xs font-medium mr-1"
          >
            <ScanLine className="w-4 h-4" />
            <span className="hidden sm:inline">Scan Bill</span>
          </NavLink>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-brand-100 hover:bg-brand-800 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[52px] z-40 flex">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 top-[52px] bg-slate-900/60 backdrop-blur-sm cursor-default"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside 
            aria-label="Mobile navigation drawer"
            className="relative z-10 bg-white text-slate-800 w-3/4 max-w-xs h-full p-4 flex flex-col shadow-2xl space-y-2 animate-in slide-in-from-left duration-200"
          >
            <div className="pb-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signed in as</p>
              <p className="font-bold text-slate-800">{user?.full_name || 'Administrator'}</p>
              <p className="text-xs text-brand-700 capitalize font-medium">{user?.role || 'Store Owner'}</p>
            </div>

            <div className="flex-1 py-2 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;

                if (item.to === '/khata') {
                  const isKhataRoute = location.pathname.startsWith('/khata');
                  return (
                    <div key={item.to} className="space-y-1">
                      <button
                        type="button"
                        aria-expanded={khataDropdownOpen}
                        aria-controls="mobile-khata-subitems"
                        onClick={() => setKhataDropdownOpen((prev) => !prev)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                          isKhataRoute ? 'bg-brand-50 text-brand-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-brand-700" />
                          <span>{item.label}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            khataDropdownOpen ? 'rotate-180 text-brand-700' : ''
                          }`}
                        />
                      </button>
                      {khataDropdownOpen && (
                        <div
                          id="mobile-khata-subitems"
                          className="ml-5 pl-3 border-l border-slate-200 space-y-0.5 py-1"
                        >
                          {KHATA_SUB_ITEMS.map((sub) => {
                            const SubIcon = sub.icon;
                            const isSubActive = isKhataRoute && activeKhataTab === sub.id;
                            return (
                              <Link
                                key={sub.id}
                                to={`/khata?tab=${sub.id}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs ${
                                  isSubActive
                                    ? 'bg-brand-50 text-brand-900 font-bold'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span className="flex items-center gap-2 truncate">
                                  <SubIcon className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                                  <span className="truncate">{sub.label}</span>
                                </span>
                                {sub.badge && (
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                                    {sub.badge}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.to === '/inventory') {
                  const isInventoryRoute = location.pathname.startsWith('/inventory');
                  return (
                    <div key={item.to} className="space-y-1">
                      <button
                        type="button"
                        aria-expanded={inventoryDropdownOpen}
                        aria-controls="mobile-inventory-categories"
                        onClick={() => setInventoryDropdownOpen((prev) => !prev)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                          isInventoryRoute ? 'bg-brand-50 text-brand-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-brand-700" />
                          <span>{item.label}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            inventoryDropdownOpen ? 'rotate-180 text-brand-700' : ''
                          }`}
                        />
                      </button>
                      {inventoryDropdownOpen && (
                        <div
                          id="mobile-inventory-categories"
                          className="ml-5 pl-3 border-l border-slate-200 space-y-0.5 py-1"
                        >
                          <Link
                            to="/inventory"
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs ${
                              isInventoryRoute && activeInventoryCategory === 'ALL'
                                ? 'bg-brand-50 text-brand-900 font-bold'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />
                            <span>All Categories</span>
                          </Link>
                          {INVENTORY_CATEGORIES.map((catId) => {
                            const cfg = INVENTORY_CATEGORY_CONFIGS[catId];
                            const isCatActive =
                              isInventoryRoute &&
                              (activeInventoryCategory || '').toLowerCase() === catId.toLowerCase();
                            return (
                              <Link
                                key={catId}
                                to={`/inventory?category=${encodeURIComponent(catId)}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs ${
                                  isCatActive
                                    ? 'bg-brand-50 text-brand-900 font-bold'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
                                  <span>{cfg.label}</span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {cfg.defaultGstRate}% GST
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                        isActive ? 'bg-brand-50 text-brand-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-brand-700" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </NavLink>
                );
              })}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 border-t border-slate-100"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex items-center justify-around z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          const isBilling = item.to === '/billing';
          
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
                    : 'bg-brand-800 text-emerald-300 ring-4 ring-white shadow-brand-900/20'
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
                isActive ? 'text-brand-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-brand-700 stroke-[2.5]' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        {/* Quick Menu Button for Mobile */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[11px] font-medium transition-colors ${
            mobileMenuOpen ? 'text-brand-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5 mb-0.5 text-brand-800 stroke-[2.5]" />
          ) : (
            <Menu className="w-5 h-5 mb-0.5 text-slate-400" />
          )}
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};
