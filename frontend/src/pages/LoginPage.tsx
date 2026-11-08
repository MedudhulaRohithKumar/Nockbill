import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  Sprout, Lock, User as UserIcon, AlertCircle, ArrowRight, 
  ShieldCheck, Eye, EyeOff, KeyRound, Mail, CheckCircle2, 
  Sparkles, X, ScanLine, FileText, Users, Award, Check, RefreshCw
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

  // Server-Side Cryptographic CAPTCHA State
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // Search parameters for deep links (e.g. ?action=reset&user=...&code=...)
  const [searchParams] = useSearchParams();

  // Forgot Password Modal State (3-Step Flow: 1=Identify, 2=Verify 6-Digit OTP, 3=Set New Password)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [verifiedResetToken, setVerifiedResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null);
  const [emailSentStatus, setEmailSentStatus] = useState<boolean>(true);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Cooldown timer for OTP Resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Google OAuth Guide Modal State
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '995123724994-6ejbal37p88sp32fmedph6k296uf8n7k.apps.googleusercontent.com';

  const { login, loginWithGoogle } = useAuth();
  const { settings } = useShop();
  const navigate = useNavigate();

  // Fetch server-side cryptographic CAPTCHA challenge
  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const data = await authApi.getCaptcha();
      setCaptchaToken(data.captcha_token);
      setCaptchaImage(data.captcha_image);
      setCaptchaCode('');
    } catch (err) {
      console.error('Failed to load security CAPTCHA:', err);
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  // Handle URL deep links for password reset
  useEffect(() => {
    const action = searchParams.get('action');
    const user = searchParams.get('user');
    const code = searchParams.get('code');
    const token = searchParams.get('token');

    if (action === 'reset' || code || token) {
      if (user) setForgotIdentifier(user);
      if (token) {
        setVerifiedResetToken(token);
        setForgotStep(3);
      } else if (code) {
        setResetOtp(code.replace(/\D/g, '').slice(0, 6));
        setForgotStep(2);
      }
      setShowForgotModal(true);
    }
  }, [searchParams]);

  // Initialize Google Identity Services (GIS) on mount
  useEffect(() => {
    if (!googleClientId) return;

    const initGIS = () => {
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
          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'pill',
          });
        }
        return true;
      } catch (err) {
        console.warn('Google Identity initialization failed:', err);
        return false;
      }
    };

    if (!initGIS()) {
      const interval = setInterval(() => {
        if (initGIS()) clearInterval(interval);
      }, 400);
      return () => clearInterval(interval);
    }
  }, [googleClientId]);

  // Handle Click on Continue with Google Button
  const handleGoogleSignIn = () => {
    setError(null);
    const google = (window as any).google;

    // 1. Try Google OAuth2 Token Client (opens native, responsive popup on user gesture)
    if (google?.accounts?.oauth2) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setError('Google sign-in was cancelled or encountered an error.');
              }
              return;
            }
            if (tokenResponse.access_token) {
              setIsLoading(true);
              setError(null);
              try {
                await loginWithGoogle(tokenResponse.access_token);
                navigate('/billing');
              } catch (err: any) {
                setError(getErrorMessage(err, 'Google Sign-In failed. Please try again or use your password.'));
              } finally {
                setIsLoading(false);
              }
            }
          },
        });
        client.requestAccessToken();
        return;
      } catch (err) {
        console.warn('OAuth2 client initiation error, falling back to One Tap:', err);
      }
    }

    // 2. Fallback: Prompt Google One Tap
    if (google?.accounts?.id) {
      try {
        google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setShowGoogleGuide(true);
          }
        });
        return;
      } catch (err) {
        console.warn('Google prompt fallback failed:', err);
      }
    }

    // 3. Fallback: If Google scripts are blocked or not loaded
    setShowGoogleGuide(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCaptcha = captchaCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    if (cleanCaptcha.length !== 6) {
      setError('Please enter all 6 characters shown in the security CAPTCHA image.');
      return;
    }
    if (!captchaToken) {
      await fetchCaptcha();
      setError('Security challenge expired. Please enter the new code shown.');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password, captchaToken, cleanCaptcha);
      navigate('/billing');
    } catch (err: any) {
      // Every verification attempt burns the single-use server nonce — always issue a fresh CAPTCHA
      fetchCaptcha();
      if (err.response?.status === 401) {
        setError(err.response?.data?.detail || 'Incorrect username, mobile, or password.');
      } else {
        setError(getErrorMessage(err, 'Invalid credentials or security verification code.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    setForgotLoading(true);
    try {
      const res = await authApi.requestPasswordReset(forgotIdentifier.trim());
      setMaskedTarget(res.masked_target || null);
      setEmailSentStatus(res.email_sent !== false);
      setDevOtpCode(res.dev_otp || null);
      setResetOtp('');
      setResendCooldown(30);
      setForgotStep(2);
    } catch (err: any) {
      setForgotError(getErrorMessage(err, 'Failed to send verification code.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || forgotLoading) return;
    setForgotError(null);
    setForgotSuccess(null);
    setForgotLoading(true);
    try {
      const res = await authApi.requestPasswordReset(forgotIdentifier.trim());
      setMaskedTarget(res.masked_target || null);
      setEmailSentStatus(res.email_sent !== false);
      setDevOtpCode(res.dev_otp || null);
      setResetOtp('');
      setResendCooldown(30);
      setForgotSuccess('A fresh 6-digit verification code has been dispatched to your email.');
    } catch (err: any) {
      setForgotError(getErrorMessage(err, 'Failed to resend verification code. Please try again.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    const cleanedOtp = resetOtp.replace(/\D/g, '').slice(0, 6);
    if (cleanedOtp.length !== 6) {
      setForgotError('Please enter a valid 6-digit numeric verification code.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authApi.verifyResetOtp({
        identifier: forgotIdentifier.trim(),
        otp_code: cleanedOtp,
      });
      setVerifiedResetToken(res.reset_token || cleanedOtp);
      setForgotStep(3);
    } catch (err: any) {
      setForgotError(getErrorMessage(err, 'Invalid or expired 6-digit verification code.'));
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
        reset_token: verifiedResetToken || resetOtp.trim(),
        new_password: newPassword
      });
      setForgotSuccess('Password updated successfully! You can now sign in.');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotSuccess(null);
        setResetOtp('');
        setVerifiedResetToken('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPassword(newPassword);
      }, 1500);
    } catch (err: any) {
      setForgotError(getErrorMessage(err, 'Failed to update password. Please verify your code again.'));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-green-950 flex flex-col justify-center items-center p-3 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-3/4 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto relative z-10 py-3">
        {/* Top Bar with Home Link */}
        <div className="mb-4 sm:mb-6 flex items-center justify-between">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-emerald-300 hover:text-white text-xs font-semibold px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md transition-all hover:bg-white/10 active:scale-95"
          >
            <span>← Back to NockBill Solutions</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-emerald-300/80 bg-emerald-900/40 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Cloud Serverless v1.0.0 Active</span>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          
          {/* Left Column: AgriTech 3D Showcase & Feature Value */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-4 sm:space-y-6 text-white order-2 lg:order-1">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-semibold w-fit">
              <Sprout className="w-4 h-4 text-emerald-400" />
              <span>NockBill Solutions • Retail &amp; Inventory ERP</span>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Empowering Retailers with <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Fast Billing &amp; Stock Control</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                All-in-one GST billing, barcode scanning, batch ledger, price lists, and stock analytics built for high-speed retail counters.
              </p>
            </div>

            {/* 3D AgriTech Visual Showcase Card */}
            <div className="relative rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl p-3 sm:p-4 shadow-2xl shadow-emerald-950/60 overflow-hidden group">
              <div className="relative overflow-hidden rounded-2xl">
                <img 
                  src="/images/agritech_3d.jpg" 
                  alt="NockBill AgriTech 3D Smart Agriculture" 
                  className="w-full h-48 sm:h-64 lg:h-72 object-cover object-center transform transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to dashboard screen if needed
                    e.currentTarget.src = '/images/dashboard/billing_screen.png';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
                
                {/* Floating Highlights over 3D Image */}
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/30 font-semibold shadow-md">
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    GST & Govt Compliant
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                    Offline Ready POS
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Feature Value Pills */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
              <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[11px] sm:text-xs">GST Tax Invoicing</div>
                  <div className="text-[10px] text-slate-400 hidden sm:block">1-Click B2B & B2C GSTR-1</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                  <ScanLine className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[11px] sm:text-xs">Camera OCR Scanner</div>
                  <div className="text-[10px] text-slate-400 hidden sm:block">Auto-read Supplier Bills</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[11px] sm:text-xs">Batch & Expiry Control</div>
                  <div className="text-[10px] text-slate-400 hidden sm:block">Pesticide & Seed Tracking</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[11px] sm:text-xs">Farmers Khata Ledger</div>
                  <div className="text-[10px] text-slate-400 hidden sm:block">Udhar & Balance Tracking</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Modern Claymorphism Login Card */}
          <div className="lg:col-span-5 w-full order-1 lg:order-2">
            <div className="clay-card-pillowy p-5 sm:p-7 lg:p-8 border border-white/90 shadow-2xl relative">
              
              {/* Card Header */}
              <div className="text-center space-y-1.5 mb-5 sm:mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-brand-700 to-emerald-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-brand-700/30">
                  <Sprout className="w-8 h-8 sm:w-9 sm:h-9" />
                </div>
                <div className="flex items-baseline justify-center gap-1.5">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Nock<span className="text-emerald-700">Bill</span>
                  </h2>
                  <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    Solutions
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Sign in to your Shop Dashboard
                </p>
              </div>

              {/* Error Notification */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* PROMINENT GOOGLE SIGN-IN BUTTON (Always Visible) */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border-2 border-slate-200/90 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-[0.99] disabled:opacity-70 group relative overflow-hidden"
                >
                  <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                  <span className="tracking-tight text-slate-800">Continue with Google</span>
                </button>
                {/* Embedded GIS container (if rendered by SDK) */}
                <div ref={googleBtnRef} className="hidden"></div>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-slate-200 w-full"></div>
                <span className="bg-slate-50 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 absolute">
                  or sign in with shop credentials
                </span>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email / Username / Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      inputMode="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                      placeholder="Google email, username, or mobile"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Supports Google email + password or master shop credentials
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
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
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="clay-input w-full pl-10 pr-10 py-3 text-sm text-slate-900"
                      placeholder="Enter shop password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Server-Side Cryptographic CAPTCHA Verification */}
                <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Security Verification (CAPTCHA)</span>
                    </label>
                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      disabled={captchaLoading}
                      title="Generate new security challenge"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${captchaLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-2.5 items-center">
                    {/* Server-Rendered Distorted Raster Image */}
                    <div className="col-span-7 relative h-12 rounded-xl overflow-hidden border border-slate-300 bg-slate-200 flex items-center justify-center shadow-inner select-none">
                      {captchaImage ? (
                        <img
                          src={captchaImage}
                          alt="Security CAPTCHA Challenge"
                          draggable={false}
                          onContextMenu={(e) => e.preventDefault()}
                          className={`w-full h-full object-cover select-none pointer-events-none transition-opacity duration-200 ${
                            captchaLoading ? 'opacity-40' : 'opacity-100'
                          }`}
                        />
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium">
                          {captchaLoading ? 'Generating...' : 'Unavailable'}
                        </span>
                      )}
                    </div>

                    {/* Strictly Sanitized 6-Character Code Input */}
                    <div className="col-span-5 relative">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        autoComplete="off"
                        spellCheck={false}
                        value={captchaCode}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
                          setCaptchaCode(sanitized);
                        }}
                        className="clay-input w-full h-12 px-2.5 text-center font-mono text-base font-black tracking-[0.2em] text-slate-900 uppercase"
                        placeholder="6-CHAR"
                      />
                      {captchaCode.length === 6 && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 absolute right-2 top-1.5 pointer-events-none" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Type the 6 characters shown in the image</span>
                    <span className="font-mono font-semibold text-slate-600">{captchaCode.length}/6</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || captchaCode.length !== 6}
                  className="clay-btn-primary w-full mt-2 py-3.5 px-4 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 shadow-md"
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

              {/* Registration CTA */}
              <div className="mt-5 pt-4 border-t border-slate-200/80 text-center space-y-2.5">
                <p className="text-xs text-slate-600">
                  New Store Owner or Need Multi-Shop Setup?
                </p>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2.5 rounded-xl border border-emerald-200/80 transition-colors w-full"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Register Your Shop & Download Credentials →</span>
                </Link>

                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    GST Compliant • Code-128 Barcodes • Offline Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal (3-Step Flow: 1. Identify -> 2. Verify 6-Digit Code -> 3. Set New Password) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="clay-card-pillowy max-w-md w-full p-6 sm:p-7 relative border border-white/90">
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false);
                setForgotStep(1);
                setForgotError(null);
                setForgotSuccess(null);
                setResetOtp('');
                setVerifiedResetToken('');
                setDevOtpCode(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Step Progress Indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${forgotStep === 1 ? 'bg-brand-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                1. Account
              </span>
              <span className="w-4 h-0.5 bg-slate-200"></span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${forgotStep === 2 ? 'bg-brand-700 text-white' : forgotStep > 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                2. Verify OTP
              </span>
              <span className="w-4 h-0.5 bg-slate-200"></span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${forgotStep === 3 ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                3. New Password
              </span>
            </div>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {forgotStep === 1
                  ? 'Reset Shop Password'
                  : forgotStep === 2
                  ? 'Verify 6-Digit Code'
                  : 'Create New Password'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {forgotStep === 1
                  ? 'Enter your registered email, username, or mobile number to receive a 6-digit verification code.'
                  : forgotStep === 2
                  ? `Enter the 6-digit code for ${maskedTarget || forgotIdentifier} to verify your identity.`
                  : 'Your identity has been verified. Choose a new password below.'}
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

            {/* STEP 1: IDENTIFY ACCOUNT */}
            {forgotStep === 1 && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registered Email / Username / Mobile
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. yourname@gmail.com or 9876543210"
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotIdentifier.trim()}
                  className="clay-btn-primary w-full py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {forgotLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    'Send 6-Digit Verification Code'
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: VERIFY 6-DIGIT OTP ONLY */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {emailSentStatus ? (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-emerald-600" />
                      Verification code sent to {maskedTarget || 'your email'}
                    </p>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      Please check your email inbox (and spam folder) and enter the 6-digit code below.
                    </p>
                  </div>
                ) : (
                  devOtpCode && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Local Dev Verification Code:</span>
                        <button
                          type="button"
                          onClick={() => setResetOtp(devOtpCode)}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline"
                        >
                          Click to Fill
                        </button>
                      </div>
                      <div className="font-mono text-lg font-black tracking-widest text-center py-1 bg-white rounded-lg border border-amber-200">
                        {devOtpCode}
                      </div>
                      <p className="text-[10px] text-amber-700">
                        Shown locally because outbound email credentials are not active in the local container.
                      </p>
                    </div>
                  )
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      6-Digit Verification Code
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      {resetOtp.length}/6 digits
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                    maxLength={6}
                    autoFocus
                    value={resetOtp}
                    onChange={(e) => {
                      // Strictly allow only digits 0-9 and cap at 6 characters
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setResetOtp(digitsOnly);
                    }}
                    placeholder="000000"
                    className="clay-input w-full px-4 py-3.5 text-center tracking-[0.5em] font-mono text-xl text-slate-900 font-black"
                  />
                </div>

                <div className="flex items-center justify-between text-xs py-1 px-1">
                  <span className="text-slate-500">Didn't receive the code?</span>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || forgotLoading}
                    onClick={handleResendOtp}
                    className="font-bold text-emerald-700 hover:text-emerald-800 disabled:text-slate-400 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${forgotLoading ? 'animate-spin' : ''}`} />
                    <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotError(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    ← Change Account
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || resetOtp.length !== 6}
                    className="clay-btn-primary px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 disabled:opacity-60"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: SET NEW PASSWORD (ONLY AFTER OTP IS VERIFIED) */}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Code verified for <strong>{maskedTarget || forgotIdentifier}</strong></span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Master Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoFocus
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="clay-input w-full pl-4 pr-10 py-3 text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(2);
                      setForgotError(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || newPassword.length < 6}
                    className="clay-btn-primary px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 disabled:opacity-60"
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
                <h4 className="text-base font-bold text-slate-900">Google Single Sign-On Help</h4>
                <p className="text-xs text-slate-500">Sign in with Google OAuth 2.0</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed mb-5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                <p className="font-bold text-slate-800">Ensure your origin is authorized in Google Cloud:</p>
                <div className="text-slate-700 space-y-1">
                  <div>1. Go to <strong>Google Cloud Console &rarr; APIs & Services &rarr; Credentials</strong></div>
                  <div>2. Open your Web Client ID: <code className="text-[10px] bg-slate-200 px-1 py-0.5 rounded font-mono break-all">{googleClientId}</code></div>
                  <div>3. In <strong>Authorized JavaScript Origins</strong>, verify that your current browser URL origin is added:
                    <div className="font-mono bg-white p-1.5 rounded border border-slate-200 mt-1 select-all text-[11px] text-slate-800">
                      http://localhost:5173<br/>
                      http://localhost:3000<br/>
                      https://nockbill.com
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px]">
                <strong>Quick Test:</strong> You can also log in immediately using the Master Admin account below.
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
