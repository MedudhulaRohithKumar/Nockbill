import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, Lock, User as UserIcon, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { settings } = useShop();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-7 sm:p-8 border border-white/20">
          <div className="text-center space-y-2 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-700 to-emerald-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-brand-900/30">
              <Sprout className="w-9 h-9" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {settings.shop_name || 'Kisan Seva Kendra'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Fertilizer & Agro Management System
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username / Mobile
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-900/25 active:scale-[0.98] transition-all disabled:opacity-70"
            >
              <span>{isLoading ? 'Signing In...' : 'Sign In to Shop'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              GST Compliant • Offline Ready • Mobile First
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
