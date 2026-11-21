export interface RegisterFormData {
  owner_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  shop_name: string;
  proprietor_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  invoice_prefix: string;
  fertilizer_license_no: string;
  pesticide_license_no: string;
  seed_license_no: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  bank_branch: string;
  upi_id: string;
}

export interface GeneratedCredentials {
  account_id: string;
  shop_name: string;
  owner_name: string;
  username: string;
  email: string;
  phone: string;
  /** Client-memory only: merged from the typed password, never returned by the server or persisted. */
  initial_password: string;
  console_login_url: string;
  gstin: string;
  fertilizer_license: string;
  created_at: string;
}

export const CAPTCHA_LENGTH = 6;

export function sanitizeCaptchaCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CAPTCHA_LENGTH);
}

export function suggestUsernameFromEmail(email: string): string {
  const localPart = (email || '').split('@')[0] || '';
  const cleaned = localPart
    .toLowerCase()
    .replace(/[.-]/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40);
  if (cleaned.length >= 3) return cleaned;
  return cleaned ? `${cleaned}_shop` : '';
}

export function buildGoogleRegisterOptions(form: RegisterFormData) {
  return {
    mode: 'register' as const,
    owner_name: form.owner_name.trim(),
    username: form.username.toLowerCase().trim(),
    phone: form.phone.trim(),
    password: form.password,
    shop_name: form.shop_name.trim(),
    proprietor_name: (form.proprietor_name || form.owner_name).trim(),
    address_line1: form.address_line1.trim(),
    address_line2: form.address_line2.trim() || undefined,
    city: form.city.trim(),
    state: form.state.trim(),
    pincode: form.pincode.trim(),
    gstin: form.gstin.trim().toUpperCase() || undefined,
    invoice_prefix: (form.invoice_prefix || 'KSK').trim().toUpperCase(),
    fertilizer_license_no: form.fertilizer_license_no.trim() || undefined,
    pesticide_license_no: form.pesticide_license_no.trim() || undefined,
    seed_license_no: form.seed_license_no.trim() || undefined,
    bank_name: form.bank_name.trim() || undefined,
    bank_account_no: form.bank_account_no.trim() || undefined,
    bank_ifsc: form.bank_ifsc.trim().toUpperCase() || undefined,
    bank_branch: form.bank_branch.trim() || undefined,
    upi_id: form.upi_id.trim() || undefined,
  };
}

export function buildRegisterPayload(form: RegisterFormData, captchaToken: string, captchaCode: string) {
  return {
    owner_name: form.owner_name,
    username: form.username.toLowerCase().trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    password: form.password,
    shop_name: form.shop_name.trim(),
    proprietor_name: form.proprietor_name || form.owner_name,
    address_line1: form.address_line1.trim(),
    address_line2: form.address_line2.trim() || undefined,
    city: form.city.trim(),
    state: form.state.trim(),
    pincode: form.pincode.trim(),
    gstin: form.gstin.trim().toUpperCase() || undefined,
    invoice_prefix: (form.invoice_prefix || 'KSK').trim().toUpperCase(),
    fertilizer_license_no: form.fertilizer_license_no.trim() || undefined,
    pesticide_license_no: form.pesticide_license_no.trim() || undefined,
    seed_license_no: form.seed_license_no.trim() || undefined,
    bank_name: form.bank_name.trim() || undefined,
    bank_account_no: form.bank_account_no.trim() || undefined,
    bank_ifsc: form.bank_ifsc.trim().toUpperCase() || undefined,
    bank_branch: form.bank_branch.trim() || undefined,
    upi_id: form.upi_id.trim() || undefined,
    captcha_token: captchaToken,
    captcha_code: sanitizeCaptchaCode(captchaCode),
  };
}

/**
 * Build the credentials card data. The server no longer echoes `initial_password`,
 * so the password the user just typed is merged in client-side (memory only).
 */
export function mergeGeneratedCredentials(
  serverCredentials: Partial<GeneratedCredentials> | null | undefined,
  form: Pick<RegisterFormData, 'shop_name' | 'owner_name' | 'username' | 'email' | 'phone' | 'password' | 'gstin' | 'fertilizer_license_no'>,
  userId: number | undefined,
  origin: string,
  nowIso: string = new Date().toISOString(),
): GeneratedCredentials {
  const base: GeneratedCredentials = serverCredentials
    ? ({ ...serverCredentials } as GeneratedCredentials)
    : {
        account_id: `SHOP-${userId || '001'}`,
        shop_name: form.shop_name,
        owner_name: form.owner_name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        initial_password: '',
        console_login_url: `${origin}/login`,
        gstin: form.gstin || 'UNREGISTERED',
        fertilizer_license: form.fertilizer_license_no || 'N/A',
        created_at: nowIso,
      };
  return { ...base, initial_password: form.password };
}
