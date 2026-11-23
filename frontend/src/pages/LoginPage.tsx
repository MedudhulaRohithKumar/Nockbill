import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  Sprout, Lock, User as UserIcon, AlertCircle, ArrowRight, 
  ShieldCheck, Eye, EyeOff, KeyRound, Mail, CheckCircle2, 
  Sparkles, X, ScanLine, FileText, Users, Award, RefreshCw, MessageCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { authApi, getErrorMessage } from '../api';
import { GoldenSeedsCanvas } from '../components/common/GoldenSeedsCanvas';

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
    void fetchCaptcha();
  }, []);

  // Handle URL deep links for password reset and AWS-style IAM console sign-in (?account=SHOP-00001).
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
      // Every verification attempt burns the single-use server nonce — always issue a fresh CAPTCHA
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#031b0f] text-white flex flex-col justify-between items-center p-2 sm:p-3 lg:py-1.5 lg:px-6 relative select-none w-full max-w-full overflow-x-hidden">
      {/* ─── PASTORAL STAGE BACKDROP & PROCEDURAL GOLDEN SEEDS CANVAS ───────── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img 
          src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/3ca5d10d-ea2f-4907-876f-33bde169469e.jpg"
          alt="Sunlit pastoral agricultural meadow landscape"
          className="w-full h-full object-cover object-center opacity-45 scale-105 filter blur-[1px]"
        />
        {/* Scrim Gradients for Sunlight & Emerald Glare Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#02180c] via-[#032414]/80 to-[#011409]/60" />
        <div className="absolute inset-0 bg-radial-at-tl from-emerald-500/20 via-transparent to-black/60" />

        {/* Procedural Canvas: Floating Golden Seeds & Sun Godrays */}
        <GoldenSeedsCanvas />
      </div>

      {/* ─── MAIN RESPONSIVE CONTAINER (TRIPLE-MODE ENGINE) ─────────────────── */}
      <div className="max-w-7xl w-full mx-auto relative z-10 py-0.5 sm:py-1 flex-1 flex flex-col justify-center">
        {/* Top Floating Bar */}
        <div className="mb-1 sm:mb-2 flex items-center justify-between px-1">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-white/90 hover:text-white text-[11px] font-bold px-3 py-1 rounded-full bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md transition-all active:scale-95 shadow-xs"
          >
            <span>← Back to NockBill Agriculture</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-emerald-300 bg-black/40 px-3 py-0.5 rounded-full border border-emerald-500/30 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Agri ERP Cloud Grid v2.5 Active</span>
          </div>
        </div>

        {/* 2-Column Responsive Layout (Mode A / Mode B / Mode C) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 items-center w-full">
          
          {/* Left Column: Atmospheric Pastoral Warmth & Enterprise Highlights (Desktop Only for Clean Single-Screen View) */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-center space-y-2 text-white order-2 lg:order-1 px-1">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-mono uppercase tracking-wider font-bold w-fit shadow-xs backdrop-blur-md">
              <Sprout className="w-3 h-3 text-emerald-400" />
              <span>NockBill Agriculture • Meadowbell POS</span>
            </div>

            {/* Title & Description */}
            <div className="space-y-0.5">
              <h1 className="font-['Grandstander'] text-xl lg:text-2xl font-black tracking-tight text-white leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                Empower Your Agro-Store <span className="text-emerald-300">Instantly</span>
              </h1>
              <p className="text-[11px] text-slate-200/90 leading-snug max-w-lg font-medium drop-shadow-xs">
                Microsecond keyboard billing, 80mm ESC/POS thermal printing, statutory Form O registers, and automated digital Farmer Khata credit recovery.
              </p>
            </div>

            {/* 3D Pastoral Showcase Visual Cards */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <div className="glass-card-dark rounded-xl p-2 border border-white/20 shadow-lg overflow-hidden group">
                <div className="h-16 lg:h-18 w-full rounded-lg overflow-hidden relative bg-emerald-950/40">
                  <img 
                    src="/images/pos_3d.jpg" 
                    alt="Fast Counter POS with thermal printer in sunny meadow"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
                  <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-mono text-[8px] font-bold">
                    3-SEC POS
                  </span>
                </div>
                <div className="mt-1">
                  <h4 className="text-[10px] font-bold text-white">Rapid Counter Checkout</h4>
                  <p className="text-[8px] text-emerald-200/80">F1 keystroke &amp; split Cash/UPI</p>
                </div>
              </div>

              <div className="glass-card-dark rounded-xl p-2 border border-white/20 shadow-lg overflow-hidden group">
                <div className="h-16 lg:h-18 w-full rounded-lg overflow-hidden relative bg-emerald-950/40">
                  <img 
                    src="/images/compliance_3d.jpg" 
                    alt="Statutory Form O register with rupee coin in meadow"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
                  <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-amber-600 text-white font-mono text-[8px] font-bold">
                    FORM O READY
                  </span>
                </div>
                <div className="mt-1">
                  <h4 className="text-[10px] font-bold text-white">Fertilizer Compliance</h4>
                  <p className="text-[8px] text-amber-200/80">FCO 1985 &amp; statutory registers</p>
                </div>
              </div>
            </div>

            {/* 4 Feature Value Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs pt-0.5">
              <div className="glass-card-dark p-1.5 rounded-lg border border-white/15 flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-300 shrink-0" />
                <span className="text-[9px] font-bold text-white truncate">GST Invoicing</span>
              </div>
              <div className="glass-card-dark p-1.5 rounded-lg border border-white/15 flex items-center gap-1">
                <ScanLine className="w-3 h-3 text-teal-300 shrink-0" />
                <span className="text-[9px] font-bold text-white truncate">Barcode Scanner</span>
              </div>
              <div className="glass-card-dark p-1.5 rounded-lg border border-white/15 flex items-center gap-1">
                <Sprout className="w-3 h-3 text-amber-300 shrink-0" />
                <span className="text-[9px] font-bold text-white truncate">Batch Expiry</span>
              </div>
              <div className="glass-card-dark p-1.5 rounded-lg border border-white/15 flex items-center gap-1">
                <Users className="w-3 h-3 text-sky-300 shrink-0" />
                <span className="text-[9px] font-bold text-white truncate">Farmer Khata</span>
              </div>
            </div>
          </div>

          {/* Right Column: Translucent Action Pane with Luminous Borders */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto order-1 lg:order-2">
            <div className="glass-card-dark rounded-2xl p-3 sm:p-4 lg:p-3.5 border border-white/25 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              
              {/* Card Header with Animated Seedling Emblem */}
              <div className="text-center space-y-0.5 mb-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center mx-auto shadow-sm shadow-emerald-950/60 animate-leaf-pulse border border-white/40">
                  <Sprout className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <h2 className="font-['Grandstander'] text-lg sm:text-xl font-black text-white tracking-tight drop-shadow-xs">
                  Welcome Back!
                </h2>
                <p className="text-[10px] text-emerald-200/90 font-medium">
                  Log in to manage your agro-store &amp; billing
                </p>
              </div>

              {/* AWS Console-Style Sign-In Mode Switcher: Shop Owner (Root) vs IAM Staff User */}
              <div className="mb-2 grid grid-cols-2 gap-1 p-0.5 bg-black/40 border border-white/20 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('owner');
                    setError(null);
                  }}
                  className={`py-1 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    loginMode === 'owner'
                      ? 'bg-emerald-600 text-white shadow-xs border border-emerald-400/40'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Shop Owner (Root)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('iam');
                    setError(null);
                  }}
                  className={`py-1 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    loginMode === 'iam'
                      ? 'bg-slate-800 text-emerald-300 shadow-xs border border-emerald-500/30'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  IAM Staff User
                </button>
              </div>

              {/* Error Notification */}
              {error && (
                <div className="mb-2 p-1.5 bg-red-950/80 border border-red-500/50 text-red-200 rounded-xl text-[11px] flex items-center gap-1.5 shadow-md">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {loginMode === 'owner' ? (
                <>
                  {/* PROMINENT GOOGLE SIGN-IN BUTTON (Owner / Root Mode) */}
                  <div className="mb-1.5">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-70 group relative overflow-hidden cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                      <span className="tracking-tight text-slate-900 font-extrabold text-xs">Sign in with Google</span>
                    </button>
                    {/* Embedded GIS container (if rendered by SDK) */}
                    <div ref={googleBtnRef} className="hidden"></div>
                  </div>

                  {/* Divider */}
                  <div className="relative flex items-center justify-center my-1.5">
                    <div className="border-t border-white/20 w-full"></div>
                    <span className="bg-black/60 backdrop-blur-md px-2 text-[8px] font-bold uppercase tracking-wider text-emerald-200/70 absolute rounded-full border border-white/10">
                      or sign in with credentials
                    </span>
                  </div>
                </>
              ) : (
                <div className="mb-2 p-1.5 rounded-xl bg-black/60 text-slate-100 border border-emerald-500/30 text-[9px] flex items-start gap-1.5">
                  <KeyRound className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">AWS-Style IAM Staff Console Sign-In</p>
                    <p className="text-slate-300 mt-0.5 leading-tight">
                      Enter the <strong>Shop Account ID</strong> along with your IAM username and password.
                    </p>
                  </div>
                </div>
              )}

              {/* Login Form with Luminous Fields */}
              <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-1.5" autoComplete="off">
                {loginMode === 'iam' && (
                  <div>
                    <label htmlFor="login-shop-account-id" className="block text-[10px] font-bold text-white uppercase tracking-wider mb-0.5 drop-shadow-xs">
                      Shop Account ID or Alias <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-300">
                        <ShieldCheck className="w-3 h-3" />
                      </div>
                      <input
                        id="login-shop-account-id"
                        type="text"
                        required
                        value={shopAccountId}
                        onChange={(e) => setShopAccountId(e.target.value.toUpperCase())}
                        className="luminous-input w-full pl-8 pr-2.5 py-1 text-base sm:text-xs font-mono uppercase h-8"
                        placeholder="e.g. SHOP-00001 or Shop GSTIN"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="login-username" className="block text-[10px] font-bold text-white uppercase tracking-wider mb-0.5 drop-shadow-xs">
                    {loginMode === 'iam' ? 'IAM Username' : 'Email / Mobile / Username'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-300">
                      <UserIcon className="w-3 h-3" />
                    </div>
                    <input
                      id="login-username"
                      type="text"
                      required
                      inputMode="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="luminous-input w-full pl-8 pr-2.5 py-1 text-base sm:text-xs h-8"
                      placeholder={loginMode === 'iam' ? 'e.g. cashier_ravi' : 'Registered email or mobile number'}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label htmlFor="login-password" className="block text-[10px] font-bold text-white uppercase tracking-wider drop-shadow-xs">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdentifier(username);
                        setShowForgotModal(true);
                      }}
                      className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer drop-shadow-xs"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-300">
                      <Lock className="w-3 h-3" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="luminous-input w-full pl-8 pr-8 py-1 text-base sm:text-xs h-8"
                      placeholder="Enter master password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1.5 text-emerald-300 hover:text-white p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Server-Side Cryptographic CAPTCHA Verification */}
                <div className="p-1.5 rounded-xl bg-black/40 border border-white/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-captcha" className="text-[9px] font-bold text-white flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Security Verification (CAPTCHA)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        void fetchCaptcha();
                      }}
                      disabled={captchaLoading}
                      title="Generate new security challenge"
                      className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-300 hover:text-emerald-100 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${captchaLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-1.5 items-center">
                    {/* Server-Rendered Distorted Raster Image */}
                    <div className="col-span-7 relative h-8 rounded-lg overflow-hidden border border-white/30 bg-black/60 flex items-center justify-center shadow-inner select-none">
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
                        <span className="text-[9px] text-slate-300 font-medium">
                          {captchaLoading ? 'Generating...' : 'Unavailable'}
                        </span>
                      )}
                    </div>

                    {/* Strictly Sanitized 6-Character Code Input */}
                    <div className="col-span-5 relative">
                      <input
                        id="login-captcha"
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
                        className="luminous-input w-full h-8 px-1.5 text-center font-mono text-sm font-black tracking-[0.12em] text-white uppercase"
                        placeholder="6-CHAR"
                      />
                      {captchaCode.length === 6 && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 absolute right-1 top-2 pointer-events-none" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[8px] text-slate-300">
                    <span>Type characters from image</span>
                    <span className="font-mono font-semibold text-emerald-300">{captchaCode.length}/6</span>
                  </div>
                </div>

                {/* Primary CTA: Pill-Shaped Emerald Button */}
                <button
                  type="submit"
                  disabled={isLoading || captchaCode.length !== 6}
                  className="meadow-cta-btn w-full mt-1 py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 shadow-lg cursor-pointer min-h-[40px] sm:min-h-[36px]"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Login →</span>
                    </>
                  )}
                </button>
              </form>

              {/* Registration CTA Link */}
              <div className="mt-1.5 pt-1.5 border-t border-white/15 text-center space-y-0.5">
                <p className="text-[10px] text-slate-200">
                  Don&apos;t have an account?
                </p>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full border border-white/30 transition-all w-full shadow-xs"
                >
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                  <span>Start Free / Create Store Account →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SCREEN 3: FORGOT PASSWORD & ACCOUNT RECOVERY PORTAL (RESET PASSWORD) ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="glass-card-dark max-w-md w-full p-4 sm:p-6 rounded-2xl border border-white/30 relative text-white shadow-2xl max-h-[92vh] overflow-y-auto">
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
              className="absolute top-3 right-3 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Step Progress Indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${forgotStep === 1 ? 'bg-emerald-600 text-white' : 'bg-emerald-950 text-emerald-300'}`}>
                1. Account
              </span>
              <span className="w-4 h-0.5 bg-white/20"></span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${forgotStep === 2 ? 'bg-emerald-600 text-white' : forgotStep > 2 ? 'bg-emerald-950 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
                2. Verify OTP
              </span>
              <span className="w-4 h-0.5 bg-white/20"></span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${forgotStep === 3 ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-400'}`}>
                3. New Password
              </span>
            </div>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center mx-auto mb-2 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-['Grandstander'] text-xl font-bold text-white">
                {forgotStep === 1
                  ? 'Reset Password'
                  : forgotStep === 2
                  ? 'Verify 6-Digit Code'
                  : 'Create New Password'}
              </h3>
              <p className="text-xs text-emerald-100/90 mt-1 leading-relaxed">
                {forgotStep === 1
                  ? 'Enter your registered mobile or email to receive a secure recovery OTP.'
                  : forgotStep === 2
                  ? `Enter the 6-digit code for ${maskedTarget || forgotIdentifier} to verify your store ownership.`
                  : 'Your store ownership has been verified. Choose a new master password.'}
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 bg-red-950/80 border border-red-500/50 text-red-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* STEP 1: IDENTIFY ACCOUNT */}
            {forgotStep === 1 && (
              <form onSubmit={(e) => { void handleRequestOtp(e); }} className="space-y-4">
                <div>
                  <label htmlFor="forgot-identifier" className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Mobile (+91) or Store Email
                  </label>
                  <input
                    id="forgot-identifier"
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. 9876543210 or dealer@gmail.com"
                    className="luminous-input w-full px-4 py-3 text-sm"
                  />
                  <span className="text-[11px] text-emerald-200/80 mt-1 block">
                    We will send a 6-digit OTP code to verify your store ownership.
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotIdentifier.trim()}
                    className="meadow-cta-btn w-full py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Sending Recovery OTP...</span>
                      </>
                    ) : (
                      'Send Recovery OTP →'
                    )}
                  </button>

                  {/* Dedicated WhatsApp Fallback Option per Section 4.1 Screen 3 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      // Trigger request OTP and provide WhatsApp confirmation guidance
                      void handleRequestOtp(e);
                    }}
                    disabled={forgotLoading || !forgotIdentifier.trim()}
                    className="w-full py-2.5 px-4 rounded-full text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
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
                        <span className="font-bold text-white">Local Dev Verification Code:</span>
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
                    className="luminous-input w-full px-4 py-3.5 text-center tracking-[0.5em] font-mono text-xl text-white font-black"
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
                    className="meadow-cta-btn px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 disabled:opacity-60 cursor-pointer"
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
                      className="luminous-input w-full pl-4 pr-10 py-3 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-3.5 text-emerald-300 hover:text-white cursor-pointer"
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
                    className="luminous-input w-full px-4 py-3 text-sm text-white"
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
                    className="meadow-cta-btn px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
    </div>
  );
};
