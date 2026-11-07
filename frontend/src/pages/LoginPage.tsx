import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  Sprout, Lock, User as UserIcon, AlertCircle, ArrowRight, 
  ShieldCheck, Eye, EyeOff, KeyRound, Mail, CheckCircle2, 
  Sparkles, X, ExternalLink, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { authApi, getErrorMessage } from '../api';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Search parameters for deep links (e.g. ?action=reset&user=...&code=...)
  const [searchParams] = useSearchParams();

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null);

  // Google OAuth Modal / State
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '995123724994-6ejbal37p88sp32fmedph6k296uf8n7k.apps.googleusercontent.com';

  const { login, loginWithGoogle } = useAuth();
  const { settings } = useShop();
  const navigate = useNavigate();

  // Handle URL deep links for password reset
  useEffect(() => {
    const action = searchParams.get('action');
    const user = searchParams.get('user');
    const code = searchParams.get('code') || searchParams.get('token');

    if (action === 'reset' || code) {
      if (user) setForgotIdentifier(user);
      if (code) setResetOtp(code);
      setForgotStep(2);
      setShowForgotModal(true);
    }
  }, [searchParams]);

  // Initialize Google Identity Services if client ID is configured
  useEffect(() => {
    if (!googleClientId) return;

    const checkAndInitGoogle = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) return false;

      try {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              setIsLoading(true);
              setError(null);
              try {
                await loginWithGoogle(response.credential);
                navigate('/billing');
              } catch (err: any) {
                setError(getErrorMessage(err, 'Google Sign-In failed. Please try again or use your password.'));
              } finally {
                setIsLoading(false);
              }
            }
          },
          auto_select: false,
        });

        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 360,
            text: 'continue_with',
            shape: 'pill',
          });
        }
        return true;
      } catch (err) {
        console.error('Google Identity initialization error:', err);
        return false;
      }
    };

    if (!checkAndInitGoogle()) {
      const interval = setInterval(() => {
        if (checkAndInitGoogle()) clearInterval(interval);
      }, 300);
      return () => clearInterval(interval);
    }
  }, [googleClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/billing');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError(err.response?.data?.detail || 'Incorrect username, mobile, or password.');
      } else {
        setError(getErrorMessage(err, 'Invalid username, mobile, or password.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    try {
      const res = await authApi.requestPasswordReset(forgotIdentifier.trim());
      setMaskedTarget(res.masked_target || null);
      setForgotSuccess(res.message || 'Verification code dispatched via Amazon SES.');
      setForgotStep(2);
    } catch (err: any) {
      setForgotError(getErrorMessage(err, 'Failed to send verification code.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match');
      return;
    }

    setForgotLoading(true);
    try {
      await authApi.resetPassword({
        identifier: forgotIdentifier.trim(),
        reset_token: resetOtp.trim(),
        new_password: newPassword
      });
      setForgotSuccess('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotSuccess(null);
        setPassword(newPassword);
      }, 2000);
    } catch (err: any) {
      setForgotError(getErrorMessage(err, 'Failed to reset password. Check verification code.'));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-green-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Clay Ambient Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Navigation back to landing */}
        <div className="mb-4 text-center">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-emerald-300/80 hover:text-white text-xs font-semibold px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md transition-all hover:bg-white/10"
          >
            <span>← Back to NockBill Solutions Home</span>
          </Link>
        </div>

        {/* Claymorphism Login Card */}
        <div className="clay-card-pillowy p-7 sm:p-9 border border-white/90 shadow-2xl">
          {/* Brand Logo & Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-700 to-emerald-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-brand-700/30">
              <Sprout className="w-9 h-9" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              NockBill Solutions
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Smart Agro, Fertilizer, Pesticide & Seeds Retail ERP
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-In Container */}
          {googleClientId ? (
            <div className="flex justify-center mb-4 min-h-[44px]">
              <div ref={googleBtnRef} className="w-full flex justify-center"></div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowGoogleGuide(true)}
              className="w-full mb-4 py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-[0.99] group"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold group-hover:bg-slate-200">
                Setup
              </span>
            </button>
          )}

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-slate-50 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 absolute">
              or sign in with shop credentials
            </span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Username / Mobile Number / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                  placeholder="admin or mobile number"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotIdentifier(username);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="clay-input w-full pl-10 pr-10 py-3 text-sm text-slate-900"
                  placeholder="Enter shop password"
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

            <button
              type="submit"
              disabled={isLoading}
              className="clay-btn-primary w-full mt-2 py-3.5 px-4 text-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Shop</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 pt-5 border-t border-slate-200/80 text-center space-y-3">
            <p className="text-xs text-slate-600">
              New Agro Dealer or Need Multi-Shop Setup?
            </p>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2.5 rounded-xl border border-emerald-200/80 transition-colors w-full"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Register Your Shop & Download Credentials →</span>
            </Link>

            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                GST Compliant • Code-128 Barcodes • Offline Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal (Amazon SES Verified) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="clay-card-pillowy max-w-md w-full p-6 sm:p-7 relative border border-white/90">
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false);
                setForgotStep(1);
                setForgotError(null);
                setForgotSuccess(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {forgotStep === 1 ? 'Reset Shop Password' : 'Enter OTP & Set New Password'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {forgotStep === 1
                  ? 'Enter your registered email, username, or phone. A secure reset code will be delivered via Amazon SES.'
                  : 'Enter the 6-digit verification code or token sent to your email to update your password.'}
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registered Email / Username / Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. dealer@nockbill.com or 9876543210"
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-emerald-600" />
                    Sent via verified sender <strong>admin@nockbill.com</strong>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="clay-btn-primary w-full py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
                >
                  {forgotLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Dispatching via Amazon SES...</span>
                    </>
                  ) : (
                    'Send Verification Code'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-emerald-600" />
                    Dispatched from admin@nockbill.com
                  </p>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Check your email inbox (and spam/junk folder) for the 6-digit code or click the direct one-click reset link in the message.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6-Digit Verification Code (or Token)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={64}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    placeholder="e.g. 784920"
                    className="clay-input w-full px-4 py-3 text-center tracking-widest font-mono text-base text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-type password"
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="clay-btn-primary px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Google OAuth Setup Guide Modal */}
      {showGoogleGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="clay-card-pillowy max-w-lg w-full p-6 sm:p-7 relative border border-white/90 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowGoogleGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-100">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Google Single Sign-On Setup</h4>
                <p className="text-xs text-slate-500">How to activate Sign in with Google for NockBill</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed mb-5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                <p className="font-bold text-slate-800">Quick 3-step setup in Google Cloud Console:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-700">
                  <li>
                    Open <strong>Google Cloud Console</strong> &rarr; <strong>APIs & Services</strong> &rarr; <strong>Credentials</strong>.
                  </li>
                  <li>
                    Click <strong>+ CREATE CREDENTIALS</strong> &rarr; <strong>OAuth client ID</strong> &rarr; Application type: <strong>Web application</strong>.
                  </li>
                  <li>
                    Under <strong>Authorized JavaScript origins</strong>, add:
                    <div className="font-mono bg-white p-1.5 rounded border border-slate-200 mt-1 select-all text-[11px] text-slate-800">
                      http://localhost:5173<br/>
                      https://nockbill.com
                    </div>
                  </li>
                  <li>
                    Copy your new <strong>Client ID</strong> and add it to your environment:
                    <div className="font-mono bg-white p-1.5 rounded border border-slate-200 mt-1 select-all text-[11px] text-emerald-800 font-bold">
                      VITE_GOOGLE_CLIENT_ID=&lt;your-id&gt;.apps.googleusercontent.com
                    </div>
                  </li>
                </ol>
              </div>

              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                <strong>Development Note:</strong> While obtaining your Client ID, you can immediately test all ERP functions using the built-in Master Admin account.
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                  setShowGoogleGuide(false);
                }}
                className="clay-btn-primary w-full py-2.5 text-xs font-bold"
              >
                Autofill Admin Demo Credentials (admin / admin123)
              </button>
              <button
                type="button"
                onClick={() => setShowGoogleGuide(false)}
                className="clay-btn-secondary w-full py-2 text-xs font-semibold"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
