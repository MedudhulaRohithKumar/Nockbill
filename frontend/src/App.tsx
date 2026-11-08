import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShopProvider } from './context/ShopContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { HomePage } from './pages/HomePage';

// Route-level code splitting: keep initial landing page lightweight and fast
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const SubscriptionPaymentPage = lazy(() => import('./pages/SubscriptionPaymentPage').then(m => ({ default: m.SubscriptionPaymentPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const BillingPage = lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const SalesReturnPage = lazy(() => import('./pages/SalesReturnPage').then(m => ({ default: m.SalesReturnPage })));
const PriceListsPage = lazy(() => import('./pages/PriceListsPage').then(m => ({ default: m.PriceListsPage })));

const RouteLoading: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Enforce payment gateway for new accounts before accessing dashboard
  if (user?.username !== 'admin' && user?.subscription_status === 'PENDING') {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ShopProvider>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                {/* Public Marketing & Landing Page */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/subscription" element={<SubscriptionPaymentPage />} />

                {/* Protected Shop ERP Routes */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
                  <Route path="/billing" element={<ErrorBoundary><BillingPage /></ErrorBoundary>} />
                  <Route path="/returns" element={<ErrorBoundary><SalesReturnPage /></ErrorBoundary>} />
                  <Route path="/inventory" element={<ErrorBoundary><InventoryPage /></ErrorBoundary>} />
                  <Route path="/price-lists" element={<ErrorBoundary><PriceListsPage /></ErrorBoundary>} />
                  <Route path="/purchases" element={<ErrorBoundary><PurchasesPage /></ErrorBoundary>} />
                  <Route path="/expenses" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/reports" element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
                  <Route path="/analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
                  <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ShopProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
