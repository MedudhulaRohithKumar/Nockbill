import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Sprout, User, Lock, Phone, Mail, Building, MapPin, 
  FileText, CreditCard, ShieldCheck, Download, CheckCircle2, 
  ArrowRight, ArrowLeft, AlertCircle, Copy, Check, Eye, EyeOff, X, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { authApi, getErrorMessage } from '../api';
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
          `No shop account was found for ${googlePrefill.email || 'this Google account'}. Your Google account is connected — enter your mobile number, password (for hybrid login), and shop details below to register.`,
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
          `No shop account was found for "${rawId}". Complete your shop registration below — or click "Continue with Google" to link your Google account with hybrid password sign-in.`,
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
           NOCKBILL SOLUTIONS - SHOP ACCESS CREDENTIALS
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-green-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl mb-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-3 group">
          <div className="w-11 h-11 rounded-xl bg-slate-950 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg">
            <Sprout className="w-6 h-6" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              Nock<span className="text-emerald-700">Bill</span>
            </span>
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
              Solutions
            </span>
          </div>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {step === 4 ? 'Shop Registration Complete' : 'Register Your Shop'}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          {step === 4 
            ? 'Download your secure master credentials and start billing.' 
            : 'Set up your shop name, GST billing, batch tracking, and scannable barcodes in minutes.'}
        </p>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === 1 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/30' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              <span>Owner Account</span>
            </div>
            <div className="w-6 h-0.5 bg-slate-300"></div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === 2 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/30' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              <span>Shop Info</span>
            </div>
            <div className="w-6 h-0.5 bg-slate-300"></div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === 3 ? 'bg-brand-700 text-white shadow-md shadow-brand-700/30' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
              <span>Licenses & Banking</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="clay-card-pillowy p-6 sm:p-9 border border-white/80">
          {redirectNotice && step < 4 && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <span>{redirectNotice}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: OWNER ACCOUNT */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Google Hybrid Registration Option */}
              {googleAuth ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-950">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Google Account Connected: {googleAuth.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnectGoogle}
                      className="text-[11px] font-bold text-slate-600 hover:text-red-600 underline shrink-0"
                    >
                      Disconnect
                    </button>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Complete your mobile number, hybrid login password, and shop details (Steps 1–3) below. Once registered, you can sign in next time using <strong>Continue with Google</strong> or your <strong>Username / Email / Mobile + Password</strong>.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Hybrid Shop Registration with Google</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Connect your Google account to prefill your verified email &amp; name, then enter your shop details and password so you can sign in with either Google or Password anytime.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void handleGoogleRegister();
                      }}
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm hover:shadow transition-all active:scale-[0.99] disabled:opacity-70 group"
                    >
                      <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  </div>

                  <div className="relative flex items-center justify-center my-4">
                    <div className="border-t border-slate-200 w-full"></div>
                    <span className="bg-slate-50 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 absolute">
                      or enter details manually
                    </span>
                  </div>
                </>
              )}

              <form onSubmit={handleNextStep1} className="space-y-4">
                <div className="border-b border-slate-200/80 pb-3 mb-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-brand-700" />
                    Owner & Security Credentials
                  </h3>
                  <p className="text-xs text-slate-500">
                    These details will be used to generate your primary administrative access keys.
                  </p>
                </div>

              <div>
                <label htmlFor="reg-owner-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name of Owner / Proprietor <span className="text-red-500">*</span>
                </label>
                <input
                  id="reg-owner-name"
                  type="text"
                  name="owner_name"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={formData.owner_name}
                  onChange={handleChange}
                  className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-username" className="block text-xs font-bold text-slate-700 mb-1">
                    Master Username <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      id="reg-username"
                      type="text"
                      name="username"
                      required
                      placeholder="e.g. ramesh_store"
                      value={formData.username}
                      onChange={handleChange}
                      className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Unique shop administrator login ID</span>
                </div>

                <div>
                  <label htmlFor="reg-phone" className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      id="reg-phone"
                      type="tel"
                      name="phone"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={handleChange}
                      className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Required for OTP & password resets</span>
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                  {googleAuth && (
                    <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Verified by Google
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    id="reg-email"
                    type="email"
                    name="email"
                    required
                    readOnly={Boolean(googleAuth)}
                    placeholder="e.g. ramesh@gmail.com"
                    value={formData.email}
                    onChange={handleChange}
                    className={`clay-input w-full pl-10 pr-4 py-3 text-sm ${
                      googleAuth ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'text-slate-900'
                    }`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {googleAuth
                    ? 'Linked to your Google account — enables both Google Sign-In and Email + Password login'
                    : 'Used for daily sales summaries and security alerts'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-bold text-slate-700 mb-1">
                    Master Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={handleChange}
                      className="clay-input w-full pl-10 pr-10 py-3 text-sm text-slate-900"
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

                <div>
                  <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      id="reg-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      name="confirm_password"
                      required
                      placeholder="Re-type password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <Link to="/login" className="text-xs font-semibold text-slate-600 hover:text-brand-700">
                  Already have an account? Sign In
                </Link>
                <button
                  type="submit"
                  className="clay-btn-primary px-6 py-3 text-sm flex items-center gap-2"
                >
                  <span>Continue to Shop Info</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

          {/* STEP 2: SHOP & BUSINESS INFO */}
          {step === 2 && (
            <form onSubmit={handleNextStep2} className="space-y-4">
              <div className="border-b border-slate-200/80 pb-3 mb-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-brand-700" />
                  Shop & Business Information
                </h3>
                <p className="text-xs text-slate-500">
                  This appears on customer GST invoices, thermal bills, and tax reports.
                </p>
              </div>

              <div>
                <label htmlFor="reg-shop-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Shop / Agency Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="reg-shop-name"
                  type="text"
                  name="shop_name"
                  required
                  placeholder="e.g. Sri Lakshmi Enterprises"
                  value={formData.shop_name}
                  onChange={handleChange}
                  className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-gstin" className="block text-xs font-bold text-slate-700 mb-1">
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
                    className="clay-input w-full px-4 py-3 text-sm uppercase text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">15-digit GST identification number</span>
                </div>

                <div>
                  <label htmlFor="reg-invoice-prefix" className="block text-xs font-bold text-slate-700 mb-1">
                    Invoice Number Prefix
                  </label>
                  <input
                    id="reg-invoice-prefix"
                    type="text"
                    name="invoice_prefix"
                    maxLength={6}
                    placeholder="e.g. KSK or INV"
                    value={formData.invoice_prefix}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm uppercase text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">e.g. KSK-202609-00001</span>
                </div>
              </div>

              <div>
                <label htmlFor="reg-address-line1" className="block text-xs font-bold text-slate-700 mb-1">
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    id="reg-address-line1"
                    type="text"
                    name="address_line1"
                    required
                    placeholder="Shop No., Market Yard / APMC Road"
                    value={formData.address_line1}
                    onChange={handleChange}
                    className="clay-input w-full pl-10 pr-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="reg-city" className="block text-xs font-bold text-slate-700 mb-1">
                    City / Town <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-city"
                    type="text"
                    name="city"
                    required
                    placeholder="e.g. Nashik"
                    value={formData.city}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="reg-state" className="block text-xs font-bold text-slate-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-state"
                    type="text"
                    name="state"
                    required
                    placeholder="e.g. Maharashtra"
                    value={formData.state}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="reg-pincode" className="block text-xs font-bold text-slate-700 mb-1">
                    Pincode <span className="text-red-500">*</span>
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
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="clay-btn-secondary px-5 py-3 text-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="clay-btn-primary px-6 py-3 text-sm flex items-center gap-2"
                >
                  <span>Continue to Licenses</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: LICENSES & BANKING */}
          {step === 3 && (
            <form onSubmit={(e) => { void handleFinalSubmit(e); }} className="space-y-4">
              <div className="border-b border-slate-200/80 pb-3 mb-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-700" />
                  Agricultural Licenses & Banking
                </h3>
                <p className="text-xs text-slate-500">
                  Department of Agriculture compliance numbers & UPI details for customer QR codes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="reg-fertilizer-license" className="block text-xs font-bold text-slate-700 mb-1">
                    Fertilizer License No.
                  </label>
                  <input
                    id="reg-fertilizer-license"
                    type="text"
                    name="fertilizer_license_no"
                    placeholder="e.g. FL/2026/8941"
                    value={formData.fertilizer_license_no}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="reg-pesticide-license" className="block text-xs font-bold text-slate-700 mb-1">
                    Pesticide License No.
                  </label>
                  <input
                    id="reg-pesticide-license"
                    type="text"
                    name="pesticide_license_no"
                    placeholder="e.g. PL/2026/3312"
                    value={formData.pesticide_license_no}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="reg-seed-license" className="block text-xs font-bold text-slate-700 mb-1">
                    Seed License No.
                  </label>
                  <input
                    id="reg-seed-license"
                    type="text"
                    name="seed_license_no"
                    placeholder="e.g. SL/2026/1029"
                    value={formData.seed_license_no}
                    onChange={handleChange}
                    className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200/60 pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Banking & QR Code Payments (Optional)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-upi-id" className="block text-xs font-bold text-slate-700 mb-1">
                      Shop UPI ID (for QR Billing)
                    </label>
                    <input
                      id="reg-upi-id"
                      type="text"
                      name="upi_id"
                      placeholder="e.g. yourstore@okhdfcbank"
                      value={formData.upi_id}
                      onChange={handleChange}
                      className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-bank-name" className="block text-xs font-bold text-slate-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      id="reg-bank-name"
                      type="text"
                      name="bank_name"
                      placeholder="e.g. State Bank of India"
                      value={formData.bank_name}
                      onChange={handleChange}
                      className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-bank-account" className="block text-xs font-bold text-slate-700 mb-1">
                      Account Number
                    </label>
                    <input
                      id="reg-bank-account"
                      type="text"
                      name="bank_account_no"
                      placeholder="e.g. 30981290312"
                      value={formData.bank_account_no}
                      onChange={handleChange}
                      className="clay-input w-full px-4 py-3 text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-bank-ifsc" className="block text-xs font-bold text-slate-700 mb-1">
                      IFSC Code
                    </label>
                    <input
                      id="reg-bank-ifsc"
                      type="text"
                      name="bank_ifsc"
                      placeholder="e.g. SBIN0001234"
                      value={formData.bank_ifsc}
                      onChange={handleChange}
                      className="clay-input w-full px-4 py-3 text-sm uppercase text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Server-Side Cryptographic CAPTCHA Verification (skipped when Google OAuth token is verified) */}
              {googleAuth ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Identity verified via Google (<strong>{googleAuth.email}</strong>). Hybrid sign-in with both Google and Password will be enabled automatically.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="reg-captcha" className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Security Verification (CAPTCHA)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { void fetchCaptcha(); }}
                      disabled={captchaLoading}
                      className="text-[10px] font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3 h-3 ${captchaLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-12 gap-2.5 items-center">
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
                        className="clay-input w-full h-12 px-2.5 text-center font-mono text-base font-black tracking-[0.2em] text-slate-900 uppercase"
                        placeholder="6-CHAR"
                      />
                      {captchaCode.length === CAPTCHA_LENGTH && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 absolute right-2 top-1.5 pointer-events-none" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Type the 6 characters shown in the image</span>
                    <span className="font-mono font-semibold text-slate-600">{captchaCode.length}/{CAPTCHA_LENGTH}</span>
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="clay-btn-secondary px-5 py-3 text-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading || (!googleAuth && captchaCode.length !== CAPTCHA_LENGTH)}
                  className="clay-btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: AWS STYLE CREDENTIALS DOWNLOAD */}
          {step === 4 && generatedCreds && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              {/* Top Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    Your Shop Account is Created Successfully!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Your official master access keys and shop credentials have been generated. From your next sign-in, you can log in using either <strong>Continue with Google</strong> or your <strong>Username / Email / Mobile + Password</strong>.
                  </p>
                </div>
              </div>

              {/* Master Credential Card */}
              <div className="clay-card-dark p-6 rounded-3xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-mono tracking-widest uppercase text-emerald-400 font-bold">
                      Business Master Key
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {generatedCreds.account_id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Shop Name</span>
                    <span className="text-white font-bold text-sm">{generatedCreds.shop_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Owner Username</span>
                    <span className="text-emerald-300 font-bold text-sm">{generatedCreds.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Registered Mobile</span>
                    <span className="text-slate-200">{generatedCreds.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Registered Email</span>
                    <span className="text-slate-200">{generatedCreds.email}</span>
                  </div>
                  <div className="sm:col-span-2 p-3 bg-black/40 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Master Password</span>
                      <span className="text-amber-300 font-bold text-base tracking-wider">
                        {generatedCreds.initial_password}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyCredentialsText}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-sans flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="font-bold text-slate-300">Login URL: </span>
                  <span className="text-emerald-400">{generatedCreds.console_login_url}</span>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={downloadCredentialsCsv}
                  className="clay-btn-primary py-3.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Credentials (.CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={downloadCredentialsTxt}
                  className="clay-btn-secondary py-3.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Download Receipt (.TXT)</span>
                </button>
              </div>

              {/* Proceed to Dashboard CTA */}
              <div className="pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-slate-500 text-center sm:text-left">
                  You are automatically authenticated as <strong>{generatedCreds.username}</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/subscription')}
                  className="w-full sm:w-auto px-7 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all"
                >
                  <span>Proceed to Payment & Activate License</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
