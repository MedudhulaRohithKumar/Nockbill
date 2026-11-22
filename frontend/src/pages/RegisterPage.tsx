import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Sprout, User, Lock, Phone, Mail, Building, MapPin, 
  FileText, CreditCard, ShieldCheck, Download, CheckCircle2, 
  ArrowRight, ArrowLeft, AlertCircle, Copy, Check, Eye, EyeOff, RefreshCw, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { authApi, getErrorMessage } from '../api';
import { GoldenSeedsCanvas } from '../components/common/GoldenSeedsCanvas';
import {
  sanitizeTextInput,
  sanitizeCodeInput,
  sanitizePhoneInput,
  sanitizePincodeInput,
  isValidPhone,
  isValidPincode,
  isValidGstin,
  isValidIfsc,
} from '../utils/formatters';
import {
  CAPTCHA_LENGTH,
  GeneratedCredentials,
  buildGoogleRegisterOptions,
  buildRegisterPayload,
  mergeGeneratedCredentials,
  sanitizeCaptchaCode,
  suggestUsernameFromEmail,
} from '../utils/registerPayload';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, loginWithGoogle } = useAuth();
  const { refreshSettings } = useShop();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '995123724994-6ejbal37p88sp32fmedph6k296uf8n7k.apps.googleusercontent.com';
  const [googleAuth, setGoogleAuth] = useState<{
    token: string;
    email: string;
    name: string;
  } | null>(null);
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Owner Info
    owner_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',

    // Step 2: Shop Details
    shop_name: '',
    proprietor_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    gstin: '',
    invoice_prefix: 'KSK',

    // Step 3: Licenses & Banking
    fertilizer_license_no: '',
    pesticide_license_no: '',
    seed_license_no: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    bank_branch: '',
    upi_id: '',
  });

  const applyGoogleIdentityToForm = (token: string, email: string, name: string) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = sanitizeTextInput(name || cleanEmail.split('@')[0] || '', 100);
    const suggestedUsername = suggestUsernameFromEmail(cleanEmail);
    setGoogleAuth({ token, email: cleanEmail, name: cleanName });
    setFormData((prev) => ({
      ...prev,
      owner_name: prev.owner_name.trim() || cleanName,
      username: prev.username.trim() || suggestedUsername,
      email: cleanEmail || prev.email,
    }));
  };

  // Handle redirects from LoginPage when no existing account was found (via Google or Password)
  useEffect(() => {
    const navState = location.state as any;
    const googlePrefill = navState?.googlePrefill;
    const loginPrefill = navState?.loginPrefill;

    if (googlePrefill?.token) {
      applyGoogleIdentityToForm(
        googlePrefill.token,
        googlePrefill.email || '',
        googlePrefill.name || '',
      );
      if (googlePrefill.fromLogin) {
        setRedirectNotice(
          `No shop account was found for ${googlePrefill.email || 'this Google account'}. Your Google account is connected — enter your mobile number, password, and shop details below to register.`,
        );
      }
      navigate('/register', { replace: true, state: null });
    } else if (loginPrefill?.identifier) {
      const rawId = String(loginPrefill.identifier).trim();
      setFormData((prev) => {
        if (rawId.includes('@')) {
          return {
            ...prev,
            email: rawId.toLowerCase(),
            username: prev.username || suggestUsernameFromEmail(rawId),
          };
        }
        const cleanedPhone = sanitizePhoneInput(rawId);
        if (isValidPhone(cleanedPhone)) {
          return { ...prev, phone: cleanedPhone };
        }
        return {
          ...prev,
          username: sanitizeCodeInput(rawId, 40, false).replace(/\s+/g, ''),
        };
      });
      if (loginPrefill.fromLogin) {
        setRedirectNotice(
          `No shop account was found for "${rawId}". Complete your shop registration below — or click "Continue with Google" to link your Google account.`,
        );
      }
      navigate('/register', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  // Post-registration credentials state
  const [generatedCreds, setGeneratedCreds] = useState<GeneratedCredentials | null>(null);

  // Server-side CAPTCHA state (final submit step when not Google-verified), mirrors LoginPage
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);

  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const data = await authApi.getCaptcha();
      setCaptchaToken(data.captcha_token);
      setCaptchaImage(data.captcha_image);
      setCaptchaCode('');
    } catch (err) {
      console.error('Failed to load security CAPTCHA:', err);
      setCaptchaToken('');
      setCaptchaImage('');
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    if (step === 3 && !googleAuth) {
      void fetchCaptcha();
    }
  }, [step, googleAuth]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'email' && googleAuth) {
      return;
    }
    let cleaned = value;
    if (name === 'phone') {
      cleaned = sanitizePhoneInput(value);
    } else if (name === 'pincode') {
      cleaned = sanitizePincodeInput(value);
    } else if (name === 'gstin' || name === 'bank_ifsc' || name === 'invoice_prefix') {
      cleaned = sanitizeCodeInput(value, 25, true);
    } else if (name === 'username') {
      cleaned = sanitizeCodeInput(value, 40, false).replace(/\s+/g, '');
    } else {
      cleaned = sanitizeTextInput(value, 200);
    }
    setFormData(prev => ({
      ...prev,
      [name]: cleaned
    }));
  };

  const ensureGoogleIdentityScript = (): Promise<any> => {
    return new Promise((resolve) => {
      const existingGoogle = (window as any).google;
      if (existingGoogle?.accounts?.oauth2) {
        resolve(existingGoogle);
        return;
      }

      let script = document.querySelector('script[src*="accounts.google.com/gsi/client"]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      let attempts = 0;
      const poll = setInterval(() => {
        attempts += 1;
        const g = (window as any).google;
        if (g?.accounts?.oauth2) {
          clearInterval(poll);
          resolve(g);
        } else if (attempts >= 20) {
          clearInterval(poll);
          resolve(null);
        }
      }, 200);
    });
  };

  const handleGoogleRegister = async () => {
    setError(null);
    const google = await ensureGoogleIdentityScript();
    if (google?.accounts?.oauth2) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setError('Google registration was cancelled.');
              }
              return;
            }
            if (tokenResponse.access_token) {
              setIsLoading(true);
              try {
                let userEmail = '';
                let userName = '';
                try {
                  await authApi.loginWithGoogle(tokenResponse.access_token, { mode: 'preflight' });
                } catch (preflightErr: any) {
                  const status = preflightErr?.response?.status;
                  const detail = preflightErr?.response?.data?.detail;
                  if (status === 404 && detail?.code === 'ACCOUNT_NOT_FOUND') {
                    userEmail = detail.email || '';
                    userName = detail.name || '';
                  } else if (status === 409) {
                    setError(getErrorMessage(preflightErr, 'An account with this Google email already exists. Please sign in on the Login page.'));
                    return;
                  } else {
                    throw preflightErr;
                  }
                }

                if (!userEmail) {
                  try {
                    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                    });
                    if (res.ok) {
                      const info = await res.json();
                      userEmail = info.email || '';
                      userName = info.name || '';
                    }
                  } catch (e) {
                    console.warn('Could not fetch userinfo', e);
                  }
                }

                applyGoogleIdentityToForm(tokenResponse.access_token, userEmail, userName);
              } catch (err: any) {
                setError(getErrorMessage(err, 'Failed to connect to Google.'));
              } finally {
                setIsLoading(false);
              }
            }
          },
        });
        client.requestAccessToken();
        return;
      } catch (err) {
        console.warn('OAuth2 error:', err);
      }
    }
    setError('Google Identity service is blocked by browser or CSP. Please deploy the updated CSP or fill out the registration form below.');
  };

  const handleDisconnectGoogle = () => {
    setGoogleAuth(null);
    setRedirectNotice(null);
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.owner_name.trim() || formData.owner_name.trim().length < 2) {
      setError('Please enter a valid shop owner or manager name (min 2 characters)');
      return;
    }
    if (!formData.username.trim() || formData.username.length < 3) {
      setError('Username must be at least 3 alphanumeric characters');
      return;
    }
    if (!formData.phone.trim() || !isValidPhone(formData.phone)) {
      setError('Please provide a valid 10-digit Indian mobile number starting with 6-9');
      return;
    }
    if (!formData.email.trim() || !/^[^\s@]{1,64}@[^\s@.]{1,63}(?:\.[^\s@.]{2,63}){1,8}$/.test(formData.email.trim())) {
      setError('Please enter a valid email address for reports and alerts');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.shop_name.trim() || formData.shop_name.trim().length < 2) {
      setError('Please enter your Shop or Business Name (min 2 characters)');
      return;
    }
    if (formData.gstin.trim() && !isValidGstin(formData.gstin)) {
      setError('Please enter a valid alphanumeric GSTIN');
      return;
    }
    if (!formData.address_line1.trim()) {
      setError('Please provide the primary shop address');
      return;
    }
    if (!formData.city.trim()) {
      setError('City / Town is required');
      return;
    }
    if (!formData.pincode.trim() || !isValidPincode(formData.pincode)) {
      setError('Valid 6-digit Indian Pincode is required');
      return;
    }
    setStep(3);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (formData.bank_ifsc.trim() && !isValidIfsc(formData.bank_ifsc)) {
      setError('IFSC code must be 11 characters (e.g., SBIN0001234)');
      return;
    }

    if (googleAuth) {
      setIsLoading(true);
      try {
        const res = await loginWithGoogle(
          googleAuth.token,
          buildGoogleRegisterOptions(formData),
        );
        await refreshSettings();
        setGeneratedCreds(
          mergeGeneratedCredentials(
            res?.credentials,
            {
              ...formData,
              username: res?.username || formData.username,
            },
            res?.user_id,
            window.location.origin,
          ),
        );
        setStep(4);
      } catch (err: any) {
        setError(getErrorMessage(err, 'Failed to register shop with Google. Please verify all details.'));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const cleanCaptcha = sanitizeCaptchaCode(captchaCode);
    if (cleanCaptcha.length !== CAPTCHA_LENGTH) {
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
      const payload = buildRegisterPayload(formData, captchaToken, cleanCaptcha);

      const res = await register(payload);
      await refreshSettings();
      // The server never echoes the password; merge the typed one client-side (memory only, never persisted)
      setGeneratedCreds(
        mergeGeneratedCredentials(res.credentials, formData, res.user_id, window.location.origin)
      );
      setStep(4);
    } catch (err: any) {
      // Each attempt burns the single-use CAPTCHA nonce — always issue a fresh one
      void fetchCaptcha();
      setError(getErrorMessage(err, 'Failed to register shop account. Please verify all details.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Download credentials in AWS IAM CSV Format
  const downloadCredentialsCsv = () => {
    if (!generatedCreds) return;
    const headers = ['User name', 'Password', 'Access URL', 'Account ID', 'Shop Name', 'Owner Name', 'Email', 'Phone', 'GSTIN', 'Fertilizer License', 'Created At'];
    const row = [
      `"${generatedCreds.username}"`,
      `"${generatedCreds.initial_password}"`,
      `"${generatedCreds.console_login_url}"`,
      `"${generatedCreds.account_id}"`,
      `"${generatedCreds.shop_name}"`,
      `"${generatedCreds.owner_name}"`,
      `"${generatedCreds.email}"`,
      `"${generatedCreds.phone}"`,
      `"${generatedCreds.gstin}"`,
      `"${generatedCreds.fertilizer_license}"`,
      `"${generatedCreds.created_at}"`
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), row.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${generatedCreds.username}_credentials.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download credentials in formatted Text Receipt
  const downloadCredentialsTxt = () => {
    if (!generatedCreds) return;
    const txtContent = `==================================================================
           NOCKBILL AGRICULTURE - SHOP ACCESS CREDENTIALS
==================================================================
Shop Name:          ${generatedCreds.shop_name}
Shop Account ID:    ${generatedCreds.account_id}
Console Login URL:  ${generatedCreds.console_login_url}

[OWNER ACCESS KEYS]
Username:           ${generatedCreds.username}
Initial Password:   ${generatedCreds.initial_password}
Registered Mobile:  ${generatedCreds.phone}
Registered Email:   ${generatedCreds.email}
Role:               OWNER (Full Master Administrative Privileges)

[SHOP REGISTRATION & LICENSES]
Proprietor:         ${generatedCreds.owner_name}
GSTIN:              ${generatedCreds.gstin}
Fertilizer Lic:     ${generatedCreds.fertilizer_license}
Generated At:       ${generatedCreds.created_at}

SECURITY WARNING:
Treat this file as your official shop master access key.
Store it in a secure business vault. Never transmit master
passwords across unencrypted emails or chat messages.
==================================================================
`;
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedCreds.username}_shop_credentials.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyCredentialsText = () => {
    if (!generatedCreds) return;
    const text = `Shop: ${generatedCreds.shop_name}\nUsername: ${generatedCreds.username}\nPassword: ${generatedCreds.initial_password}\nLogin URL: ${generatedCreds.console_login_url}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#031b0f] text-white flex flex-col justify-center items-center py-2 px-3 sm:px-6 lg:py-2.5 lg:px-6 relative select-none w-full max-w-full overflow-x-hidden">
      {/* ─── PASTORAL MEADOW STAGE BACKDROP & GOLDEN SEEDS CANVAS ──────────── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img 
          src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/3ca5d10d-ea2f-4907-876f-33bde169469e.jpg"
          alt="Sunlit pastoral agricultural meadow landscape"
          className="w-full h-full object-cover object-center opacity-40 scale-105 filter blur-[1px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#02180c] via-[#032414]/85 to-[#011409]/65" />
        <div className="absolute inset-0 bg-radial-at-tl from-emerald-500/20 via-transparent to-black/65" />
        <GoldenSeedsCanvas />
      </div>

      {/* Top Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl mb-2 sm:mb-2.5 text-center relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 mb-1 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white border border-white/30 flex items-center justify-center shadow-md animate-leaf-pulse">
            <Sprout className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-['Grandstander'] text-2xl font-black text-white tracking-tight drop-shadow-md">
              Nock<span className="text-emerald-300">Bill</span>
            </span>
            <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-emerald-300 drop-shadow">
              Agriculture
            </span>
          </div>
        </Link>
        <h2 className="font-['Grandstander'] text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
          {step === 4 ? 'Shop Registration Complete' : 'Create Store Account'}
        </h2>
        <p className="mt-0.5 text-[11px] sm:text-xs text-emerald-100/90 font-medium">
          {step === 4 
            ? 'Download your secure master credentials and start billing.' 
            : 'Register your agro-retail shop for fast GST billing & inventory.'}
        </p>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 mt-2">
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all ${
              step === 1 ? 'bg-emerald-600 text-white shadow-md border border-emerald-400/40' : 'bg-black/40 text-slate-400 border border-white/10'
            }`}>
              <span className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-[9px]">1</span>
              <span>Owner Profile</span>
            </div>
            <div className="w-3 sm:w-6 h-0.5 bg-white/20"></div>
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all ${
              step === 2 ? 'bg-emerald-600 text-white shadow-md border border-emerald-400/40' : 'bg-black/40 text-slate-400 border border-white/10'
            }`}>
              <span className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-[9px]">2</span>
              <span>Shop Info</span>
            </div>
            <div className="w-3 sm:w-6 h-0.5 bg-white/20"></div>
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all ${
              step === 3 ? 'bg-emerald-600 text-white shadow-md border border-emerald-400/40' : 'bg-black/40 text-slate-400 border border-white/10'
            }`}>
              <span className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-[9px]">3</span>
              <span>Licenses &amp; Banking</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Glass Card Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 w-full">
        <div className="glass-card-dark rounded-2xl p-3.5 sm:p-5 lg:p-4.5 border border-white/25 shadow-2xl backdrop-blur-xl">
          {redirectNotice && step < 4 && (
            <div className="mb-3 p-2.5 bg-amber-950/80 border border-amber-500/50 text-amber-200 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>{redirectNotice}</span>
            </div>
          )}

          {error && (
            <div className="mb-3 p-2.5 bg-red-950/80 border border-red-500/50 text-red-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: OWNER ACCOUNT */}
          {step === 1 && (
            <div className="space-y-2.5">
              {/* Google Hybrid Registration Option */}
              {googleAuth ? (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-400/40 rounded-xl space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Google Account Connected: {googleAuth.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnectGoogle}
                      className="text-[10px] font-bold text-emerald-300 hover:text-red-300 underline shrink-0 cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-200/90 leading-tight">
                    Complete your mobile number, hybrid login password, and shop details below.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-2.5 bg-black/40 border border-white/20 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>Hybrid Shop Registration with Google</span>
                      </div>
                      <span className="text-[9px] bg-emerald-600 text-white font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-100/80 leading-tight">
                      Connect your Google account to prefill your verified email &amp; name, then enter your shop details.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void handleGoogleRegister();
                      }}
                      disabled={isLoading}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-70 group cursor-pointer"
                    >
                      <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span className="font-extrabold">Sign up with Google</span>
                    </button>
                  </div>

                  <div className="relative flex items-center justify-center my-2">
                    <div className="border-t border-white/20 w-full"></div>
                    <span className="bg-black/60 px-2.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200/70 absolute rounded-full border border-white/10">
                      or enter details manually
                    </span>
                  </div>
                </>
              )}

              <form onSubmit={handleNextStep1} className="space-y-2 sm:space-y-2.5">
                <div className="border-b border-white/15 pb-1 mb-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-400" />
                    Owner &amp; Security Credentials
                  </h3>
                  <p className="text-[10px] text-emerald-200/80">
                    These details generate your primary master administrator access keys.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <div>
                    <label htmlFor="reg-owner-name" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Full Name of Owner <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="reg-owner-name"
                      type="text"
                      name="owner_name"
                      required
                      placeholder="e.g. Ramesh Patel"
                      value={formData.owner_name}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-username" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Master Username <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-emerald-300 pointer-events-none" />
                      <input
                        id="reg-username"
                        type="text"
                        name="username"
                        required
                        placeholder="e.g. ramesh_store"
                        value={formData.username}
                        onChange={handleChange}
                        className="luminous-input w-full pl-8 pr-3 py-1.5 text-base sm:text-xs text-white h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-phone" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Mobile Number <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-emerald-300 pointer-events-none" />
                      <input
                        id="reg-phone"
                        type="tel"
                        name="phone"
                        required
                        maxLength={10}
                        placeholder="e.g. 9876543210"
                        value={formData.phone}
                        onChange={handleChange}
                        className="luminous-input w-full pl-8 pr-3 py-1.5 text-base sm:text-xs text-white h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Email Address <span className="text-red-400">*</span>
                      {googleAuth && (
                        <span className="ml-1 text-[9px] font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded-full border border-emerald-500/40">
                          Google
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-emerald-300 pointer-events-none" />
                      <input
                        id="reg-email"
                        type="email"
                        name="email"
                        required
                        readOnly={Boolean(googleAuth)}
                        placeholder="e.g. ramesh@gmail.com"
                        value={formData.email}
                        onChange={handleChange}
                        className={`luminous-input w-full pl-8 pr-3 py-1.5 text-base sm:text-xs h-9 ${
                          googleAuth ? 'bg-black/60 text-slate-300 cursor-not-allowed' : 'text-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Master Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-emerald-300 pointer-events-none" />
                      <input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        required
                        placeholder="Min 6 chars"
                        value={formData.password}
                        onChange={handleChange}
                        className="luminous-input w-full pl-8 pr-8 py-1.5 text-base sm:text-xs text-white h-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-emerald-300 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-confirm-password" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-emerald-300 pointer-events-none" />
                      <input
                        id="reg-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        name="confirm_password"
                        required
                        placeholder="Re-type password"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        className="luminous-input w-full pl-8 pr-3 py-1.5 text-base sm:text-xs text-white h-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <Link to="/login" className="text-[11px] font-bold text-emerald-300 hover:text-white">
                    Already registered? Log In
                  </Link>
                  <button
                    type="submit"
                    className="meadow-cta-btn px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg min-h-[44px]"
                  >
                    <span>Continue to Shop Setup →</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: SHOP & BUSINESS INFO */}
          {step === 2 && (
            <form onSubmit={handleNextStep2} className="space-y-2 sm:space-y-2.5">
              <div className="border-b border-white/15 pb-1 mb-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-emerald-400" />
                  Shop &amp; Business Information
                </h3>
                <p className="text-[10px] text-emerald-200/80">
                  This appears on customer GST invoices, thermal bills, and tax reports.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                <div>
                  <label htmlFor="reg-shop-name" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                    Shop / Agency Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="reg-shop-name"
                    type="text"
                    name="shop_name"
                    required
                    placeholder="e.g. Sri Lakshmi Enterprises"
                    value={formData.shop_name}
                    onChange={handleChange}
                    className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                  />
                </div>

                <div>
                  <label htmlFor="reg-gstin" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                    GSTIN Number (Optional)
                  </label>
                  <input
                    id="reg-gstin"
                    type="text"
                    name="gstin"
                    maxLength={15}
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    value={formData.gstin}
                    onChange={handleChange}
                    className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs uppercase text-white h-9"
                  />
                </div>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                  <div className="sm:col-span-2">
                    <label htmlFor="reg-address-line1" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Address Line 1 <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-emerald-300 pointer-events-none" />
                      <input
                        id="reg-address-line1"
                        type="text"
                        name="address_line1"
                        required
                        placeholder="Shop No., Market Yard / APMC Road"
                        value={formData.address_line1}
                        onChange={handleChange}
                        className="luminous-input w-full pl-8 pr-3 py-1.5 text-base sm:text-xs text-white h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-invoice-prefix" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Invoice Prefix
                    </label>
                    <input
                      id="reg-invoice-prefix"
                      type="text"
                      name="invoice_prefix"
                      maxLength={6}
                      placeholder="e.g. KSK or INV"
                      value={formData.invoice_prefix}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs uppercase text-white h-9"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                  <div>
                    <label htmlFor="reg-city" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      City / Town <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="reg-city"
                      type="text"
                      name="city"
                      required
                      placeholder="e.g. Nashik"
                      value={formData.city}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-state" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      State <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="reg-state"
                      type="text"
                      name="state"
                      required
                      placeholder="e.g. Maharashtra"
                      value={formData.state}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-pincode" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Pincode <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="reg-pincode"
                      type="text"
                      name="pincode"
                      required
                      maxLength={6}
                      placeholder="e.g. 422001"
                      value={formData.pincode}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 cursor-pointer border border-white/20 min-h-[44px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="meadow-cta-btn px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg min-h-[44px]"
                >
                  <span>Continue to Licenses</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: LICENSES & BANKING */}
          {step === 3 && (
            <form onSubmit={(e) => { void handleFinalSubmit(e); }} className="space-y-2 sm:space-y-2.5">
              <div className="border-b border-white/15 pb-1 mb-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Agricultural Licenses &amp; Banking
                </h3>
                <p className="text-[10px] text-emerald-200/80">
                  Department of Agriculture compliance numbers &amp; UPI details for customer QR billing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                <div>
                  <label htmlFor="reg-fertilizer-license" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                    Fertilizer Lic.
                  </label>
                  <input
                    id="reg-fertilizer-license"
                    type="text"
                    name="fertilizer_license_no"
                    placeholder="e.g. FL/2026/8941"
                    value={formData.fertilizer_license_no}
                    onChange={handleChange}
                    className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                  />
                </div>

                <div>
                  <label htmlFor="reg-pesticide-license" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                    Pesticide Lic.
                  </label>
                  <input
                    id="reg-pesticide-license"
                    type="text"
                    name="pesticide_license_no"
                    placeholder="e.g. PL/2026/3312"
                    value={formData.pesticide_license_no}
                    onChange={handleChange}
                    className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                  />
                </div>

                <div>
                  <label htmlFor="reg-seed-license" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                    Seed Lic.
                  </label>
                  <input
                    id="reg-seed-license"
                    type="text"
                    name="seed_license_no"
                    placeholder="e.g. SL/2026/1029"
                    value={formData.seed_license_no}
                    onChange={handleChange}
                    className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                  />
                </div>
              </div>

              <div className="border-t border-white/15 pt-2 mt-1">
                <h4 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  Banking &amp; QR Payments (Optional)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-2.5">
                  <div className="sm:col-span-2">
                    <label htmlFor="reg-upi-id" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Shop UPI ID (for QR Billing)
                    </label>
                    <input
                      id="reg-upi-id"
                      type="text"
                      name="upi_id"
                      placeholder="e.g. store@okhdfc"
                      value={formData.upi_id}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="reg-bank-name" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Bank Name
                    </label>
                    <input
                      id="reg-bank-name"
                      type="text"
                      name="bank_name"
                      placeholder="e.g. State Bank of India"
                      value={formData.bank_name}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="reg-bank-account" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      Account Number
                    </label>
                    <input
                      id="reg-bank-account"
                      type="text"
                      name="bank_account_no"
                      placeholder="e.g. 30981290312"
                      value={formData.bank_account_no}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs text-white h-9"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="reg-bank-ifsc" className="block text-[11px] font-bold text-white uppercase tracking-wider mb-0.5">
                      IFSC Code
                    </label>
                    <input
                      id="reg-bank-ifsc"
                      type="text"
                      name="bank_ifsc"
                      placeholder="e.g. SBIN0001234"
                      value={formData.bank_ifsc}
                      onChange={handleChange}
                      className="luminous-input w-full px-3 py-1.5 text-base sm:text-xs uppercase text-white h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Server-Side Cryptographic CAPTCHA Verification */}
              {googleAuth ? (
                <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-400/40 flex items-center gap-2 text-xs text-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Identity verified via Google (<strong>{googleAuth.email}</strong>). Hybrid sign-in enabled.
                  </span>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-black/40 border border-white/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="reg-captcha" className="text-[10px] font-bold text-white flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Security Verification (CAPTCHA)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { void fetchCaptcha(); }}
                      disabled={captchaLoading}
                      className="text-[10px] font-bold text-emerald-300 hover:text-white flex items-center gap-1 disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${captchaLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-7 relative h-9 rounded-lg overflow-hidden border border-white/30 bg-black/60 flex items-center justify-center shadow-inner select-none">
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
                        <span className="text-[10px] text-slate-400 font-medium">
                          {captchaLoading ? 'Generating...' : 'Unavailable'}
                        </span>
                      )}
                    </div>
                    <div className="col-span-5 relative">
                      <input
                        id="reg-captcha"
                        type="text"
                        required
                        maxLength={CAPTCHA_LENGTH}
                        autoComplete="off"
                        spellCheck={false}
                        value={captchaCode}
                        onChange={(e) => setCaptchaCode(sanitizeCaptchaCode(e.target.value))}
                        className="luminous-input w-full h-9 px-2 text-center font-mono text-base font-black tracking-[0.15em] text-white uppercase"
                        placeholder="6-CHAR"
                      />
                      {captchaCode.length === CAPTCHA_LENGTH && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 absolute right-1.5 top-1 pointer-events-none" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-300">
                    <span>Type 6 characters shown in image</span>
                    <span className="font-mono font-semibold text-emerald-300">{captchaCode.length}/{CAPTCHA_LENGTH}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 cursor-pointer border border-white/20 min-h-[44px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading || (!googleAuth && captchaCode.length !== CAPTCHA_LENGTH)}
                  className="meadow-cta-btn px-6 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-70 cursor-pointer shadow-lg min-h-[44px]"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: AWS STYLE CREDENTIALS DOWNLOAD */}
          {step === 4 && generatedCreds && (
            <div className="space-y-3 sm:space-y-4 animate-in fade-in zoom-in-95 duration-300">
              {/* Top Banner */}
              <div className="p-3 bg-emerald-950/80 border border-emerald-400/40 rounded-xl flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Your Shop Account is Created Successfully!
                  </h4>
                  <p className="text-[11px] text-emerald-200/90 mt-0.5 leading-snug">
                    Your official master access keys have been generated. From your next sign-in, you can log in using either <strong>Continue with Google</strong> or your <strong>Username / Mobile + Password</strong>.
                  </p>
                </div>
              </div>

              {/* Master Credential Card */}
              <div className="bg-black/60 p-4 rounded-2xl relative overflow-hidden border border-white/20 shadow-inner">
                <div className="flex items-center justify-between pb-2.5 border-b border-white/15">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-[11px] font-mono tracking-wider uppercase text-emerald-400 font-bold">
                      Business Master Key
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-200">
                    ID: {generatedCreds.account_id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-2.5 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Shop Name</span>
                    <span className="text-white font-bold text-xs truncate block">{generatedCreds.shop_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Owner Username</span>
                    <span className="text-emerald-300 font-bold text-xs truncate block">{generatedCreds.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Registered Mobile</span>
                    <span className="text-slate-200 text-xs">{generatedCreds.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Registered Email</span>
                    <span className="text-slate-200 text-xs truncate block">{generatedCreds.email}</span>
                  </div>
                  <div className="sm:col-span-2 p-2 bg-black/60 rounded-xl border border-white/20 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Master Password</span>
                      <span className="text-amber-300 font-bold text-sm tracking-wider font-mono">
                        {generatedCreds.initial_password}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyCredentialsText}
                      className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-sans flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-300 bg-white/5 p-2 rounded-lg border border-white/10">
                  <span className="font-bold text-white">Login URL: </span>
                  <span className="text-emerald-300 font-mono">{generatedCreds.console_login_url}</span>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={downloadCredentialsCsv}
                  className="meadow-cta-btn py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md min-h-[44px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Credentials (.CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={downloadCredentialsTxt}
                  className="py-2.5 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Download Receipt (.TXT)</span>
                </button>
              </div>

              {/* Proceed to Dashboard CTA */}
              <div className="pt-2 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="text-[11px] text-slate-300 text-center sm:text-left">
                  Authenticated as <strong>{generatedCreds.username}</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/subscription')}
                  className="meadow-cta-btn w-full sm:w-auto px-5 py-2 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xl cursor-pointer min-h-[44px]"
                >
                  <span>Proceed to Payment &amp; License</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
