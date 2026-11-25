import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  Sprout, Lock, User as UserIcon, AlertCircle, ArrowRight, 
  ShieldCheck, Eye, EyeOff, KeyRound, Mail, CheckCircle2, 
  Sparkles, X, FileText, RefreshCw, MessageCircle, BookOpen, Globe, Phone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, getErrorMessage } from '../api';

export const LoginPage: React.FC = () => {
  const [loginMode, setLoginMode] = useState<'owner' | 'iam'>('owner');
  const [shopAccountId, setShopAccountId] = useState('');
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
    void fetchCaptcha();
  }, []);

  // Handle URL deep links for password reset and staff console sign-in (?account=SHOP-00001).
  useEffect(() => {
    const action = searchParams.get('action');
    const user = searchParams.get('user');
    const account = searchParams.get('account');

    if (account && account.trim()) {
      setLoginMode('iam');
      setShopAccountId(account.trim().toUpperCase());
    }

    if (action === 'reset') {
      if (user) setForgotIdentifier(user);
      setResetOtp('');
      setForgotStep(user ? 2 : 1);
      setShowForgotModal(true);
    }
  }, [searchParams]);

  const completeGoogleLogin = async (googleToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithGoogle(googleToken, { mode: 'login' });
      navigate('/billing');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 404 && detail?.code === 'ACCOUNT_NOT_FOUND') {
        navigate('/register', {
          state: {
            googlePrefill: {
              token: googleToken,
              email: detail.email || '',
              name: detail.name || '',
              fromLogin: true,
            },
          },
        });
        return;
      }
      setError(getErrorMessage(err, 'Google Sign-In failed. Please try again or use your password.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Google Identity Services (GIS) on mount (lazy-loaded only on auth routes)
  useEffect(() => {
    if (!googleClientId) return;

    if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const initGIS = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) return false;

      try {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              await completeGoogleLogin(response.credential);
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

    // 1. Try Google OAuth2 Token Client
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
              await completeGoogleLogin(tokenResponse.access_token);
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

    if (loginMode === 'iam' && !shopAccountId.trim()) {
      setError('Please enter your Shop Account ID or Alias (e.g. SHOP-00001).');
      return;
    }

    const cleanCaptcha = captchaCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    if (cleanCaptcha.length !== 6) {
      setError('Please enter all 6 characters shown in the security CAPTCHA verification.');
      return;
    }
    if (!captchaToken) {
      await fetchCaptcha();
      setError('Security challenge expired. Please enter the new code shown.');
      return;
    }

    setIsLoading(true);
    try {
      await login(
        username.trim(),
        password,
        captchaToken,
        cleanCaptcha,
        loginMode === 'iam' ? shopAccountId.trim() : undefined,
      );
      navigate('/billing');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 404 && detail?.code === 'ACCOUNT_NOT_FOUND') {
        navigate('/register', {
          state: {
            loginPrefill: {
              identifier: detail.identifier || username.trim(),
              fromLogin: true,
            },
          },
        });
        return;
      }
      void fetchCaptcha();
      if (err.response?.status === 401) {
        setError(getErrorMessage(err, 'Incorrect username, mobile, or password.'));
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
    <div className="login-atmosphere min-h-screen text-slate-100 font-sans selection:bg-emerald-500 selection:text-white relative overflow-x-hidden flex flex-col justify-between select-none">
      
      {/* ─── AMBIENT BACKGROUND PARTICLES (NO IMAGES) ────────────────────────── */}
      <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="particle w-3.5 h-3.5 top-[12%] left-[8%] [animation-duration:9s]" />
        <div className="particle w-2.5 h-2.5 top-[28%] left-[22%] [animation-duration:11s] [animation-delay:1s]" />
        <div className="particle w-4 h-4 top-[18%] left-[45%] [animation-duration:14s] [animation-delay:2s]" />
        <div className="particle w-3 h-3 top-[65%] left-[15%] [animation-duration:8s] [animation-delay:0.5s]" />
        <div className="particle w-2 h-2 top-[80%] left-[38%] [animation-duration:10s]" />
        <div className="particle w-3.5 h-3.5 top-[32%] left-[58%] [animation-duration:13s] [animation-delay:3s]" />
        <div className="particle w-2 h-2 top-[75%] left-[70%] [animation-duration:9s] [animation-delay:1.5s]" />
        <div className="particle w-4 h-4 top-[22%] left-[88%] [animation-duration:12s]" />
        <div className="particle w-2.5 h-2.5 top-[50%] left-[92%] [animation-duration:10s] [animation-delay:2.5s]" />
        <div className="particle w-3 h-3 top-[85%] left-[84%] [animation-duration:15s] [animation-delay:0.8s]" />
      </div>

      {/* ─── TOP NAVIGATION BAR ──────────────────────────────────────────────── */}
      <header className="relative z-20 w-full px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-emerald-900/40 bg-[#051c14]/70 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-forest-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/40 shrink-0">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="text-lg font-black tracking-tight text-white">Nock<span className="text-emerald-400">Bill</span></span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 uppercase">ERP</span>
            </div>
            <span className="text-[11px] font-medium text-emerald-300/70 tracking-wide">Agro Billing &amp; Statutory Compliance</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4 text-emerald-300/70">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-emerald-200/90 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-full bg-forest-850/60 border border-emerald-500/20 transition-all hover:bg-forest-800"
          >
            <span>← Back to Store</span>
          </Link>

          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-emerald-300/80 px-3 py-1 rounded-full bg-forest-850/60 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span>Cloud Grid Online</span>
          </div>
        </div>
      </header>

      {/* ─── MAIN HERO + AUTH GRID ──────────────────────────────────────────── */}
      <main className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 lg:py-10 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* ── LEFT HERO INFORMATION SECTION (ZERO IMAGES) ── */}
          <section className="lg:col-span-7 flex flex-col justify-center pt-2 lg:pt-4" data-purpose="hero-overview">
            <div className="inline-flex items-center space-x-2 self-start px-3.5 py-1.5 rounded-full bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide mb-4">
              <Sprout className="w-3.5 h-3.5 text-emerald-400" />
              <span className="uppercase font-mono text-[11px] tracking-wider">AGRI RETAIL ERP &amp; STATUTORY PLATFORM</span>
            </div>

            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-white leading-[1.18] tracking-tight mb-3">
              Empower Your Agro-Store <span className="text-emerald-400 underline decoration-emerald-500/40 decoration-wavy decoration-2">Instantly</span>
            </h1>

            <p className="text-emerald-100/75 text-sm sm:text-base leading-relaxed max-w-xl mb-6 font-normal">
              Next-generation point-of-sale engineered for fertilizer dealers, pesticide distributors, and seed retail centers across India.
            </p>

            {/* 3 Glass Subcards (Pure SVG Icons, Zero Images) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
              {/* Card 1: Billing */}
              <div className="glass-subcard rounded-2xl p-4 border border-emerald-500/20 hover:border-emerald-400/50 transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-sm font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                    Zero-Error Fertilizer &amp; Pesticide Billing
                  </h2>
                  <p className="text-xs text-emerald-100/75 leading-relaxed">
                    Automated batch number, expiry date tracking, and statutory price-cap checks at the counter.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-emerald-500/10 flex items-center space-x-1.5 text-[10px] font-mono text-emerald-400/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>100% Price Capped</span>
                </div>
              </div>

              {/* Card 2: Khata */}
              <div className="glass-subcard rounded-2xl p-4 border border-emerald-500/20 hover:border-emerald-400/50 transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h2 className="text-sm font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                    Real-Time Farmer Khata &amp; Udhar Ledger
                  </h2>
                  <p className="text-xs text-emerald-100/75 leading-relaxed">
                    Keep track of seasonal farmer debts, crop cycles, and send automated WhatsApp payment reminders.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-emerald-500/10 flex items-center space-x-1.5 text-[10px] font-mono text-amber-300/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Auto WhatsApp Alert</span>
                </div>
              </div>

              {/* Card 3: Compliance */}
              <div className="glass-subcard rounded-2xl p-4 border border-emerald-500/20 hover:border-emerald-400/50 transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="text-sm font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                    Instant GST &amp; Govt Statutory Filing
                  </h2>
                  <p className="text-xs text-emerald-100/75 leading-relaxed">
                    1-Click GSTR-1 preparation, POS machine integration, and official Form O registers ready for agriculture officers.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-emerald-500/10 flex items-center space-x-1.5 text-[10px] font-mono text-emerald-400/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>FCO 1985 &amp; GSTR-1</span>
                </div>
              </div>
            </div>

            {/* 4 Feature Value Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-forest-850/70 border border-emerald-500/20 text-xs text-emerald-200/90 hover:border-emerald-400/40 hover:bg-[#133d2e] transition-all cursor-default">
                <span className="text-sm">⚡</span>
                <span className="font-medium truncate">3-Sec POS Invoicing</span>
              </div>
              <div className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-forest-850/70 border border-emerald-500/20 text-xs text-emerald-200/90 hover:border-emerald-400/40 hover:bg-[#133d2e] transition-all cursor-default">
                <span className="text-sm">📜</span>
                <span className="font-medium truncate">Instant Form O Book</span>
              </div>
              <div className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-forest-850/70 border border-emerald-500/20 text-xs text-emerald-200/90 hover:border-emerald-400/40 hover:bg-[#133d2e] transition-all cursor-default">
                <span className="text-sm">🌾</span>
                <span className="font-medium truncate">Digital Farmer Khata</span>
              </div>
              <div className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-forest-850/70 border border-emerald-500/20 text-xs text-emerald-200/90 hover:border-emerald-400/40 hover:bg-[#133d2e] transition-all cursor-default">
                <span className="text-sm">🛡️</span>
                <span className="font-medium truncate">Central Sync Ready</span>
              </div>
            </div>
          </section>

          {/* ── RIGHT AUTH FORM CARD ── */}
          <section className="lg:col-span-5 w-full max-w-md mx-auto" data-purpose="auth-modal-card">
            <div className="glass-panel rounded-3xl p-6 sm:p-7 shadow-2xl relative">
              
              {/* Seedling Sprout Brand Icon Badge */}
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-forest-950 flex items-center justify-center shadow-xl shadow-emerald-500/25 border border-emerald-300/40 relative">
                <div className="absolute -inset-1 rounded-2xl bg-emerald-400/20 blur-sm pointer-events-none" />
                <Sprout className="w-7 h-7 text-white relative z-10" />
              </div>

              {/* Card Header Texts */}
              <div className="text-center mb-5">
                <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back!</h2>
                <p className="text-xs text-emerald-200/60 mt-1">
                  Log in to manage your agro-store &amp; billing
                </p>
              </div>

              {/* User Role Tab Switcher: Store Owner vs Staff / Cashier */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-forest-950/80 border border-emerald-900/60 mb-4" data-purpose="role-tab-selector">
                <button
                  type="button"
                  id="tab-owner"
                  onClick={() => {
                    setLoginMode('owner');
                    setError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                    loginMode === 'owner'
                      ? 'bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 shadow-sm'
                      : 'text-emerald-300/70 hover:text-white'
                  }`}
                >
                  Shop Owner (Root)
                </button>
                <button
                  type="button"
                  id="tab-iam"
                  onClick={() => {
                    setLoginMode('iam');
                    setError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                    loginMode === 'iam'
                      ? 'bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 shadow-sm'
                      : 'text-emerald-300/70 hover:text-white'
                  }`}
                >
                  Staff / Cashier User
                </button>
              </div>

              {/* Notice Banners */}
              {loginMode === 'owner' ? (
                <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/25 p-2.5 mb-4 flex items-start space-x-2.5 transition-all duration-200">
                  <div className="p-1 rounded-md bg-emerald-800/40 text-emerald-400 mt-0.5 shrink-0">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-200">Store Owner Master Account</p>
                    <p className="text-[10px] text-emerald-300/70 leading-normal">
                      Sign in with your registered Mobile Number, Email, or GSTIN to access the root store portal.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/20 p-2.5 mb-4 flex items-start space-x-2.5 transition-all duration-200">
                  <div className="p-1 rounded-md bg-emerald-800/40 text-emerald-400 mt-0.5 shrink-0">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-200">Staff &amp; Cashier Console Sign-In</p>
                    <p className="text-[10px] text-emerald-300/70 leading-normal">
                      Enter the <strong className="text-emerald-200">Shop Account ID</strong> along with your Staff username and password.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-2.5 bg-red-950/80 border border-red-500/50 text-red-200 rounded-xl text-xs flex items-center gap-2 shadow-md">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Google Sign-in for Owner */}
              {loginMode === 'owner' && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-70 group cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span className="text-slate-900 font-extrabold text-xs">Sign in with Google</span>
                  </button>
                  <div ref={googleBtnRef} className="hidden" />

                  <div className="relative flex items-center justify-center my-3">
                    <div className="border-t border-emerald-900/60 w-full" />
                    <span className="bg-forest-950 px-2.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300/60 absolute rounded-full border border-emerald-900/60">
                      or continue with credentials
                    </span>
                  </div>
                </div>
              )}

              {/* Form Container */}
              <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-3.5" autoComplete="off">
                {/* Shop Account ID (Staff Mode Only) */}
                {loginMode === 'iam' && (
                  <div>
                    <label htmlFor="login-shopId" className="block text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300/80 mb-1">
                      SHOP ACCOUNT ID OR ALIAS <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-400/60">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <input
                        id="login-shopId"
                        name="shopId"
                        type="text"
                        required
                        value={shopAccountId}
                        onChange={(e) => setShopAccountId(e.target.value.toUpperCase())}
                        placeholder="E.G. SHOP-00001 OR SHOP GSTIN"
                        className="agro-input w-full pl-9 pr-3 py-2 text-xs rounded-xl font-mono text-emerald-100 placeholder:text-emerald-500/40 uppercase"
                      />
                    </div>
                  </div>
                )}

                {/* Username / Identifier */}
                <div>
                  <label htmlFor="login-username" className="block text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300/80 mb-1">
                    {loginMode === 'iam' ? (
                      <>STAFF USERNAME <span className="text-rose-400">*</span></>
                    ) : (
                      <>STORE EMAIL, MOBILE NUMBER, OR GSTIN <span className="text-rose-400">*</span></>
                    )}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-400/60">
                      {loginMode === 'iam' ? <UserIcon className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </div>
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={loginMode === 'iam' ? 'e.g. cashier_ravi' : 'e.g. 9845211092 or owner@agrokendra.in'}
                      className="agro-input w-full pl-9 pr-3 py-2 text-xs rounded-xl font-mono text-emerald-100 placeholder:text-emerald-500/40"
                    />
                  </div>
                </div>

                {/* Password with Forgot Password Link */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="login-password" className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300/80">
                      {loginMode === 'iam' ? 'STAFF PASSWORD' : 'MASTER PASSWORD'} <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdentifier(username);
                        setShowForgotModal(true);
                      }}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-400/60">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={loginMode === 'iam' ? 'Enter staff password' : 'Enter master owner password'}
                      className="agro-input w-full pl-9 pr-9 py-2 text-xs rounded-xl text-emerald-100 placeholder:text-emerald-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-400/60 hover:text-emerald-300 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Security Verification (CAPTCHA) */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-captcha" className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300/80 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Security Verification (CAPTCHA)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { void fetchCaptcha(); }}
                      disabled={captchaLoading}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-transform duration-300 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${captchaLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* CAPTCHA Box Grid */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Distorted Graphic Style CAPTCHA Image Container (Zero <img> tags) */}
                    <div 
                      className="col-span-7 h-10 rounded-xl bg-forest-950 border border-emerald-500/25 relative overflow-hidden flex items-center justify-center select-none captcha-noise"
                      style={captchaImage ? { backgroundImage: `url(${captchaImage})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}
                    >
                      {/* Abstract distorted lines */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 160 40">
                        <path d="M0,22 Q30,5 70,28 T160,18" fill="none" stroke="#34d399" strokeWidth="1.8" />
                        <path d="M0,8 Q45,35 90,12 T160,25" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                        <path d="M10,38 Q80,2 150,30" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
                      </svg>
                      {captchaLoading && (
                        <span className="text-[10px] font-mono text-emerald-300 z-10 bg-black/60 px-2 py-0.5 rounded">
                          Refreshing...
                        </span>
                      )}
                    </div>

                    {/* Input code box with counter */}
                    <div className="col-span-5 relative">
                      <input
                        id="login-captcha"
                        name="captcha"
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
                        placeholder="6-CHAR"
                        className="agro-input w-full text-center py-2 text-xs font-mono font-bold tracking-widest uppercase rounded-xl text-emerald-100 placeholder:text-emerald-500/30"
                      />
                      <span className={`absolute -bottom-4 right-1 text-[9px] font-mono transition-colors ${captchaCode.length === 6 ? 'text-emerald-300 font-bold' : 'text-emerald-400/60'}`}>
                        {captchaCode.length}/6
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-300/50 mt-1">Type characters from image</p>
                </div>

                {/* Login CTA Action Button */}
                <button
                  type="submit"
                  disabled={isLoading || captchaCode.length !== 6}
                  className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-agrigreen-700 hover:from-emerald-500 hover:to-emerald-600 text-forest-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/60 hover:shadow-emerald-500/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>{loginMode === 'iam' ? 'Login as Staff Operator' : 'Login as Store Owner'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Prompt & Registration Option */}
              <div className="mt-5 pt-4 border-t border-emerald-900/60 text-center">
                <p className="text-[11px] text-emerald-300/60 mb-2">Don&apos;t have an account?</p>
                <Link
                  to="/register"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-forest-950/70 border border-emerald-500/30 hover:border-emerald-400/60 hover:bg-forest-900/80 text-emerald-200 text-xs font-semibold transition-all duration-200"
                >
                  <span>✨</span>
                  <span>Start Free / Create Store Account →</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ─── SCREEN 3: FORGOT PASSWORD & ACCOUNT RECOVERY PORTAL (RESET PASSWORD) ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="glass-panel max-w-md w-full p-4 sm:p-6 rounded-2xl border border-emerald-500/30 relative text-white shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-emerald-900/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Master Password Recovery</h3>
                  <p className="text-[11px] text-emerald-300/70">Verify identity via Mobile/Email OTP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotStep(1);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Progress Pill Indicator */}
            <div className="flex items-center justify-center gap-2 my-4">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                forgotStep === 1 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' : 'bg-black/30 text-slate-400 border-white/10'
              }`}>
                1. Identify
              </span>
              <span className="text-slate-500 text-xs">→</span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                forgotStep === 2 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' : 'bg-black/30 text-slate-400 border-white/10'
              }`}>
                2. Verify OTP
              </span>
              <span className="text-slate-500 text-xs">→</span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                forgotStep === 3 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' : 'bg-black/30 text-slate-400 border-white/10'
              }`}>
                3. New Password
              </span>
            </div>

            {/* Status Notifications */}
            {forgotError && (
              <div className="mb-4 p-3 bg-red-950/80 border border-red-500/40 text-red-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{forgotError}</span>
              </div>
            )}
            {forgotSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* STEP 1: IDENTIFY USERNAME/MOBILE */}
            {forgotStep === 1 && (
              <form onSubmit={(e) => { void handleRequestOtp(e); }} className="space-y-4">
                <div>
                  <label htmlFor="forgot-identifier" className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Store Email or Mobile Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="forgot-identifier"
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. 9845211092 or owner@agrokendra.in"
                    className="agro-input w-full px-4 py-2.5 text-xs text-white rounded-xl"
                  />
                  <p className="text-[11px] text-emerald-300/60 mt-1.5 leading-relaxed">
                    We will send a 6-digit OTP verification code to your registered mobile number and email.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotIdentifier.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-agrigreen-700 hover:from-emerald-500 hover:to-emerald-600 text-forest-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Send 6-Digit OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      void handleRequestOtp(e);
                    }}
                    disabled={forgotLoading || !forgotIdentifier.trim()}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    style={{ backgroundColor: '#25D366' }}
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>Verify with WhatsApp OTP</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: VERIFY 6-DIGIT OTP */}
            {forgotStep === 2 && (
              <form onSubmit={(e) => { void handleVerifyOtp(e); }} className="space-y-4">
                {emailSentStatus ? (
                  <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5 text-white">
                      <Mail className="w-4 h-4 text-emerald-400" />
                      Verification code sent to {maskedTarget || 'your mobile / email'}
                    </p>
                    <p className="text-[11px] text-emerald-300 leading-relaxed">
                      Please enter the 6-digit code below to proceed.
                    </p>
                  </div>
                ) : (
                  devOtpCode && (
                    <div className="p-3 bg-amber-950/80 border border-amber-500/40 rounded-xl text-xs text-amber-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">Verification Code:</span>
                        <button
                          type="button"
                          onClick={() => setResetOtp(devOtpCode)}
                          className="text-[11px] font-bold text-emerald-300 hover:text-white underline cursor-pointer"
                        >
                          Click to Fill
                        </button>
                      </div>
                      <div className="font-mono text-lg font-black tracking-widest text-center py-1 bg-black/60 rounded-lg border border-amber-500/40 text-amber-300">
                        {devOtpCode}
                      </div>
                    </div>
                  )
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="forgot-otp" className="block text-xs font-bold text-white uppercase tracking-wider">
                      6-Digit Recovery OTP
                    </label>
                    <span className="text-[11px] font-mono text-emerald-300">
                      {resetOtp.length}/6 digits
                    </span>
                  </div>
                  <input
                    id="forgot-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setResetOtp(digitsOnly);
                    }}
                    placeholder="000000"
                    className="agro-input w-full px-4 py-3 text-center tracking-[0.5em] font-mono text-xl text-white font-black rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-between text-xs py-1 px-1">
                  <span className="text-slate-300">Didn&apos;t receive code?</span>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || forgotLoading}
                    onClick={() => {
                      void handleResendOtp();
                    }}
                    className="font-bold text-emerald-300 hover:text-white disabled:text-slate-500 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition cursor-pointer"
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
                    className="text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                  >
                    ← Change Account
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || resetOtp.length !== 6}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-agrigreen-700 hover:from-emerald-500 hover:to-emerald-600 text-forest-950 text-xs sm:text-sm font-bold flex items-center gap-2 disabled:opacity-60 cursor-pointer shadow-lg"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
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

            {/* STEP 3: SET NEW MASTER PASSWORD */}
            {forgotStep === 3 && (
              <form onSubmit={(e) => { void handleResetPassword(e); }} className="space-y-4">
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Code verified for <strong>{maskedTarget || forgotIdentifier}</strong></span>
                </div>

                <div>
                  <label htmlFor="forgot-new-password" className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
                    New Master Password
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="agro-input w-full pl-4 pr-10 py-2.5 text-xs text-white rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-emerald-300 hover:text-white cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="forgot-confirm-password" className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <input
                    id="forgot-confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="agro-input w-full px-4 py-2.5 text-xs text-white rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(2);
                      setForgotError(null);
                    }}
                    className="text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                  >
                    ← Back to OTP
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || newPassword.length < 6}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-agrigreen-700 hover:from-emerald-500 hover:to-emerald-600 text-forest-950 text-xs sm:text-sm font-bold flex items-center gap-2 disabled:opacity-60 cursor-pointer shadow-lg"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Save &amp; Login</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── GOOGLE ONE-TAP & OAUTH GUIDE MODAL ──────────────────────────────── */}
      {showGoogleGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="glass-panel max-w-md w-full p-4 sm:p-6 rounded-2xl border border-emerald-500/30 relative text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-900/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1.5 shadow-sm">
                  <svg className="w-full h-full" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Google Sign-In Help</h3>
                  <p className="text-[11px] text-emerald-300/70">Browser Popup or Script Blocked</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs text-slate-200">
              <p>
                If the Google Sign-In prompt did not appear automatically, please verify:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300 text-[11px] pl-1">
                <li>Your browser allows popups from this domain</li>
                <li>Ad-blockers or privacy extensions are not blocking Google Identity Services</li>
                <li>You can also sign in directly using your <strong>Registered Email/Mobile + Password</strong></li>
              </ul>
            </div>

            <div className="flex justify-end pt-2 border-t border-emerald-900/60">
              <button
                type="button"
                onClick={() => setShowGoogleGuide(false)}
                className="px-4 py-2 rounded-xl bg-forest-850 hover:bg-forest-800 text-white text-xs font-bold border border-emerald-500/30 transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
