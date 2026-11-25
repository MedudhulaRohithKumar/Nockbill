import api from './client';
import { buildRegisterPayload, GeneratedCredentials } from '../utils/registerPayload';
import { INVENTORY_PAGE_SIZE, MAX_PRODUCTS_LIMIT, parseTotalCount } from '../utils/pagination';
import { Product, Sale, Purchase, Expense, ShopSettings, OCRCandidate, DashboardSummary, RefillRecommendation, AnalyticsData, InvoiceReturnLookup, SalesReturn, SalesReturnCreatePayload, PriceList, IamUser, AgriDoctorCrop, AgriDoctorAdvisory, SegmentSummaryResponse, CampaignTemplate, MarketingCampaign, EWayBillGeneratePayload, EWayBillGenerateResponse } from '../types';

export type RegisterPayload = ReturnType<typeof buildRegisterPayload>;

export interface GoogleAuthOptions {
  mode?: 'login' | 'register' | 'preflight' | 'auto';
  owner_name?: string;
  username?: string;
  shop_name?: string;
  proprietor_name?: string;
  password?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  invoice_prefix?: string;
  fertilizer_license_no?: string;
  pesticide_license_no?: string;
  seed_license_no?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  upi_id?: string;
}

export const authApi = {
  getCaptcha: async () => {
    const res = await api.get<{ captcha_token: string; captcha_image: string }>('/auth/captcha');
    return res.data;
  },
  login: async (
    credentials:
      | { username: string; password: string; captcha_token: string; captcha_code: string; shop_account_id?: string }
      | FormData,
  ) => {
    let payload: any;
    if (credentials instanceof FormData) {
      payload = {
        username: credentials.get('username') as string,
        password: credentials.get('password') as string,
        captcha_token: credentials.get('captcha_token') as string,
        captcha_code: credentials.get('captcha_code') as string,
        shop_account_id: (credentials.get('shop_account_id') as string) || undefined,
      };
    } else {
      payload = credentials;
    }
    const res = await api.post<{ access_token: string; token_type: string; role: string; username: string; name?: string; user_id?: number; subscription_status?: string }>('/auth/login', payload);
    return res.data;
  },
  register: async (payload: RegisterPayload) => {
    const res = await api.post<{
      access_token: string;
      token_type: string;
      user_id: number;
      username: string;
      name: string;
      email?: string;
      phone?: string;
      role: string;
      shop_name: string;
      subscription_status?: string;
      credentials?: Partial<GeneratedCredentials> | null;
    }>('/auth/register', payload);
    return res.data;
  },
  requestPasswordReset: async (identifier: string) => {
    const res = await api.post<{
      success: boolean;
      message: string;
      masked_target?: string;
      email_sent?: boolean;
      dev_otp?: string;
    }>('/auth/forgot-password/request', { identifier });
    return res.data;
  },
  verifyResetOtp: async (payload: { identifier: string; otp_code: string }) => {
    const res = await api.post<{
      success: boolean;
      verified: boolean;
      reset_token: string;
      message: string;
    }>('/auth/forgot-password/verify', payload);
    return res.data;
  },
  resetPassword: async (payload: { identifier: string; reset_token: string; new_password: string }) => {
    const res = await api.post<{ success: boolean; message: string }>('/auth/forgot-password/reset', payload);
    return res.data;
  },
  loginWithGoogle: async (
    credential: string, 
    options?: GoogleAuthOptions | string
  ) => {
    let finalCredential = credential;
    if (credential && !credential.startsWith('nockbill_gauth.')) {
      try {
        const bridgeResp = await fetch('/oauth/google-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        });
        const contentType = bridgeResp.headers.get('content-type') || '';
        if (bridgeResp.ok && contentType.includes('application/json')) {
          const bridgeData = await bridgeResp.json();
          if (bridgeData?.verified_credential) {
            finalCredential = bridgeData.verified_credential;
          }
        } else if (bridgeResp.status !== 404 && contentType.includes('application/json')) {
          const errData = await bridgeResp.json().catch(() => null);
          if (errData?.detail) {
            throw new Error(errData.detail);
          }
        }
      } catch (err: any) {
        if (err?.message && !err.message.includes('fetch')) {
          throw err;
        }
        // Local dev or direct backend mode: fall back to raw Google credential
      }
    }

    let payload: any = { credential: finalCredential };
    if (typeof options === 'string') {
      payload.shop_name = options;
    } else if (options) {
      payload = { ...payload, ...options };
    }
    const res = await api.post<{
      access_token: string;
      token_type: string;
      role: string;
      username: string;
      name?: string;
      email?: string;
      phone?: string;
      shop_name?: string;
      user_id?: number;
      subscription_status?: string;
      credentials?: Partial<GeneratedCredentials> | null;
    }>('/auth/google', payload);
    return res.data;
  },
  activateSubscription: async (payload: {
    plan_id: string;
    plan_name: string;
    amount: number;
    payment_method: string;
    payment_ref: string;
  }) => {
    const res = await api.post<{
      success: boolean;
      message: string;
      subscription_status: string;
      payment_ref: string;
      activated_at: string;
    }>('/auth/activate-subscription', payload);
    return res.data;
  },
  session: async () => {
    const res = await api.get<{
      authenticated: boolean;
      user: any | null;
    }>('/auth/session');
    return res.data;
  },
  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  logout: async () => {
    try {
      const res = await api.post<{ success: boolean; message: string }>('/auth/logout');
      return res.data;
    } catch {
      return { success: false, message: 'Logout request completed' };
    }
  },
  listUsers: async (): Promise<IamUser[]> => {
    const res = await api.get<IamUser[]>('/auth/users');
    return res.data;
  },
  createUser: async (payload: {
    name: string;
    username: string;
    password: string;
    email?: string;
    phone?: string;
    role: 'OWNER' | 'STAFF';
  }): Promise<IamUser> => {
    const res = await api.post<IamUser>('/auth/users', payload);
    return res.data;
  },
  updateUser: async (
    userId: number,
    payload: {
      name?: string;
      username?: string;
      password?: string;
      email?: string;
      phone?: string;
      role?: 'OWNER' | 'STAFF';
      is_active?: boolean;
    },
  ): Promise<IamUser> => {
    const res = await api.put<IamUser>(`/auth/users/${userId}`, payload);
    return res.data;
  },
  deleteUser: async (userId: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete<{ success: boolean; message: string }>(`/auth/users/${userId}`);
    return res.data;
  },
};

export const productsApi = {
  getAll: async (params?: { category?: string; search?: string; low_stock?: boolean; skip?: number; limit?: number }) => {
    // Backend default is 200 rows; always request the maximum page (500) unless the caller overrides it.
    const res = await api.get<Product[]>('/products', { params: { limit: MAX_PRODUCTS_LIMIT, ...params } });
    return res.data;
  },
  getPage: async (params: { skip?: number; limit?: number; search?: string; category?: string; active_only?: boolean }): Promise<{ items: Product[]; total: number }> => {
    const query: Record<string, string | number | boolean> = {
      skip: Math.max(0, params.skip ?? 0),
      limit: Math.min(MAX_PRODUCTS_LIMIT, Math.max(1, params.limit ?? INVENTORY_PAGE_SIZE)),
    };
    if (params.search) query.search = params.search;
    if (params.category) query.category = params.category;
    if (params.active_only !== undefined) query.active_only = params.active_only;
    const res = await api.get<Product[]>('/products', { params: query });
    const items = Array.isArray(res.data) ? res.data : [];
    return { items, total: parseTotalCount(res.headers, items.length) };
  },
  /** Walk every server page (500 rows each) for views that must filter client-side. */
  getAllPages: async (params: { search?: string; category?: string; active_only?: boolean } = {}): Promise<Product[]> => {
    const all: Product[] = [];
    for (let guard = 0; guard < 40; guard += 1) {
      const { items, total } = await productsApi.getPage({ ...params, skip: all.length, limit: MAX_PRODUCTS_LIMIT });
      all.push(...items);
      if (items.length === 0 || all.length >= total) break;
    }
    return all;
  },
  getById: async (id: number) => {
    const res = await api.get<Product>(`/products/${id}`);
    return res.data;
  },
  search: async (q: string): Promise<Product[]> => {
    const clean = q.trim();
    if (!clean) return [];
    const res = await api.get<Product[]>('/products/search', { params: { q: clean } });
    return Array.isArray(res.data) ? res.data : [];
  },
  getByBarcode: async (barcode: string): Promise<Product> => {
    const res = await api.get<{ found: boolean; product: Product; matched_variant?: any }>(`/products/by-barcode/${encodeURIComponent(barcode)}`);
    return (res.data as any).product || res.data;
  },

  checkDuplicate: async (name: string, company?: string, barcode?: string, trade_name?: string) => {
    const res = await api.get<{ exists: boolean; message: string; product?: Product }>('/products/check-duplicate', {
      params: { name, company, barcode, trade_name }
    });
    return res.data;
  },
  resolveTradeName: async (product_name: string, company_name: string) => {
    const res = await api.get<{
      product_name: string;
      company_name: string;
      suggested_trade_name: string;
      related_company_trade_names: { product_name: string; company_name: string; trade_name: string; source: string }[];
    }>('/products/resolve-trade-name', {
      params: { product_name, company_name }
    });
    return res.data;
  },
  getRefillRecommendations: async () => {
    const res = await api.get<RefillRecommendation[]>('/products/recommend-refill');
    return res.data;
  },
  refillStock: async (data: {
    product_id: number;
    quantity: number;
    unit?: string;
    company_name?: string;
    trade_name?: string;
    batch_number?: string;
    manufacture_date?: string;
    expiry_date?: string;
    purchase_price?: number;
    selling_price?: number;
    mrp?: number;
    supplier_name?: string;
    invoice_number?: string;
    notes?: string;
  }) => {
    const res = await api.post<{ success: boolean; message: string; product: Product; purchase_id: number }>('/products/refill', {
      ...data,
      additional_quantity: data.quantity,
      new_batch_number: data.batch_number,
      new_expiry_date: data.expiry_date,
    });
    return res.data;
  },
  create: async (data: Partial<Product>) => {
    const res = await api.post<Product>('/products', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Product>) => {
    const res = await api.put<Product>(`/products/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete(`/products/${id}`);
    return res.data;
  },
  getBarcodePdfUrl: (productId: number, params?: { label_size?: string; copies?: number; include_batch?: boolean; batch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.label_size) query.set('label_size', params.label_size);
    if (params?.copies) query.set('copies', String(params.copies));
    if (params?.include_batch !== undefined) query.set('include_batch', String(params.include_batch));
    if (params?.batch_id) query.set('batch_id', String(params.batch_id));
    const qs = query.toString();
    return `/api/products/${productId}/barcode-label.pdf${qs ? `?${qs}` : ''}`;
  },
};

export const priceListsApi = {
  getAll: async () => {
    const res = await api.get<PriceList[]>('/price-lists');
    return res.data;
  },
  create: async (payload: {
    name: string;
    description?: string;
    adjustment_type: 'DISCOUNT' | 'INCREMENT';
    calculation_mode: 'PERCENTAGE' | 'FIXED';
    adjustment_value: number;
    is_active?: boolean;
    apply_to_all?: boolean;
    product_ids?: number[];
  }) => {
    const res = await api.post<PriceList>('/price-lists', payload);
    return res.data;
  },
  update: async (id: number, payload: Partial<{
    name: string;
    description: string;
    adjustment_type: 'DISCOUNT' | 'INCREMENT';
    calculation_mode: 'PERCENTAGE' | 'FIXED';
    adjustment_value: number;
    is_active: boolean;
  }>) => {
    const res = await api.put<PriceList>(`/price-lists/${id}`, payload);
    return res.data;
  },
  assignProducts: async (id: number, payload: { apply_to_all?: boolean; product_ids?: number[] }) => {
    const res = await api.post<{ success: boolean; message: string; price_list: PriceList }>(`/price-lists/${id}/assign`, payload);
    return res.data;
  },
  unassignProducts: async (id: number, payload: { unassign_all?: boolean; product_ids?: number[] }) => {
    const res = await api.post<{ success: boolean; message: string; price_list: PriceList }>(`/price-lists/${id}/unassign`, payload);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/price-lists/${id}`);
    return res.data;
  },
};

export const salesApi = {
  getAll: async (params?: { start_date?: string; end_date?: string; customer_phone?: string; limit?: number }) => {
    const res = await api.get<Sale[]>('/sales', { params });
    return res.data;
  },
  getById: async (id: number) => {
    const res = await api.get<Sale>(`/sales/${id}`);
    return res.data;
  },
  getFrequentlySold: async (limit: number = 8) => {
    const res = await api.get<{
      id: number;
      product_name: string;
      company_name?: string;
      selling_price: number;
      current_stock: number;
      unit: string;
      variants?: any[];
      times_billed: number;
    }[]>('/sales/frequently-sold', { params: { limit } });
    return res.data;
  },
  create: async (data: any) => {
    const res = await api.post<Sale>('/sales', data);
    return res.data;
  },
  cancel: async (id: number, reason: string) => {
    const res = await api.post<Sale>(`/sales/${id}/cancel`, { reason });
    return res.data;
  },
  getPdfUrl: (saleId: number) => {
    return `/api/invoices/${saleId}/pdf`;
  },
};

export const returnsApi = {
  lookupInvoice: async (invoiceNumber: string): Promise<InvoiceReturnLookup> => {
    const res = await api.get<InvoiceReturnLookup>('/returns/lookup', {
      params: { invoice_number: invoiceNumber }
    });
    return res.data;
  },
  processReturn: async (payload: SalesReturnCreatePayload): Promise<SalesReturn> => {
    const res = await api.post<SalesReturn>('/returns', payload);
    return res.data;
  },
  getAll: async (params?: { search?: string; limit?: number }): Promise<SalesReturn[]> => {
    const res = await api.get<SalesReturn[]>('/returns', { params });
    return res.data;
  },
  getById: async (returnId: number): Promise<SalesReturn> => {
    const res = await api.get<SalesReturn>(`/returns/${returnId}`);
    return res.data;
  },
  getPdfUrl: (returnId: number): string => {
    return `/api/returns/${returnId}/pdf`;
  },
};

export const purchasesApi = {
  getAll: async () => {
    const res = await api.get<Purchase[]>('/purchases');
    return res.data;
  },
  create: async (data: any) => {
    const res = await api.post<Purchase>('/purchases', data);
    return res.data;
  },
  getPdfUrl: (purchaseId: number) => {
    return `/api/purchases/${purchaseId}/pdf`;
  },
};

export const inventoryApi = {
  getSummary: async () => {
    const res = await api.get('/inventory/summary');
    return res.data;
  },
  getLowStock: async () => {
    const res = await api.get<Product[]>('/inventory/low-stock');
    return res.data;
  },
  getNearExpiry: async (days: number = 60) => {
    const res = await api.get<Product[]>('/inventory/near-expiry', { params: { days } });
    return res.data;
  },
  adjustStock: async (data: { product_id: number; adjustment_type: string; quantity: number; reason: string }) => {
    const res = await api.post('/inventory/adjust', data);
    return res.data;
  },
  getMovements: async (productId?: number) => {
    const res = await api.get('/inventory/movements', { params: { product_id: productId } });
    return res.data;
  }
};

export const expensesApi = {
  getAll: async (params?: { month?: number; year?: number }) => {
    const res = await api.get<Expense[]>('/expenses', { params });
    return res.data;
  },
  create: async (data: Partial<Expense>) => {
    const res = await api.post<Expense>('/expenses', data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete(`/expenses/${id}`);
    return res.data;
  },
  getSummary: async () => {
    const res = await api.get('/expenses/summary');
    return res.data;
  }
};

export const reportsApi = {
  getDailySales: async (date?: string) => {
    const res = await api.get('/reports/daily-sales', { params: { report_date: date } });
    return res.data;
  },
  getMonthlySales: async (year?: number, month?: number) => {
    const res = await api.get('/reports/monthly-sales', { params: { year, month } });
    return res.data;
  },
  getGstReport: async (from_date: string, to_date: string) => {
    const res = await api.get('/reports/gst', { params: { from_date, to_date } });
    return res.data;
  },
  getProfitLoss: async (from_date: string, to_date: string) => {
    const res = await api.get('/reports/profit-loss', { params: { from_date, to_date } });
    return res.data;
  },
  getStockValuation: async () => {
    const res = await api.get('/reports/stock');
    return res.data;
  },
  getDashboard: async (): Promise<DashboardSummary> => {
    const res = await api.get('/reports/dashboard');
    return res.data;
  },
  getAnalytics: async (params?: { start_date?: string; end_date?: string; preset?: string }): Promise<AnalyticsData> => {
    const res = await api.get<AnalyticsData>('/reports/analytics', { params });
    return res.data;
  }
};


export const ocrApi = {
  scanImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<OCRCandidate>('/ocr/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }
};

export const settingsApi = {
  get: async () => {
    const res = await api.get<ShopSettings>('/settings');
    return res.data;
  },
  update: async (data: Partial<ShopSettings>) => {
    const res = await api.put<ShopSettings>('/settings', data);
    return res.data;
  },
  uploadLogo: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<ShopSettings>('/settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  deleteLogo: async () => {
    const res = await api.delete<ShopSettings>('/settings/logo');
    return res.data;
  },
  getUpiQr: async (params?: { amount?: number; invoice_number?: string; upi_id?: string }) => {
    const res = await api.get<{
      upi_id: string;
      shop_name: string;
      upi_uri: string;
      qr_svg_data_uri: string;
    }>('/settings/upi-qr', { params });
    return res.data;
  },
};

export const khataApi = {
  listCustomers: async (params?: { search?: string; only_due?: boolean }) => {
    const res = await api.get<{
      total_customers: number;
      total_outstanding_udhar: number;
      customers: Array<{
        customer_key: string;
        customer_name: string;
        customer_phone?: string | null;
        customer_address?: string | null;
        customer_aadhar?: string | null;
        customer_gstin?: string | null;
        bill_count: number;
        total_billed: number;
        total_credit_billed: number;
        total_repaid: number;
        outstanding_balance: number;
        last_purchase_date?: string | null;
      }>;
    }>('/khata/customers', { params });
    return res.data;
  },
  lookupCustomer: async (phone: string) => {
    const res = await api.get<{
      found: boolean;
      customer_name?: string;
      customer_phone: string;
      customer_address?: string | null;
      customer_aadhar?: string | null;
      customer_gstin?: string | null;
      bill_count: number;
      total_billed?: number;
      total_credit_billed?: number;
      total_repaid?: number;
      outstanding_balance: number;
      recent_sales: Array<{
        id: number;
        invoice_number: string;
        sale_date?: string | null;
        grand_total: number;
        payment_method: string;
        items: Array<{
          product_id?: number;
          product_name: string;
          batch_number?: string | null;
          quantity: number;
          unit: string;
          unit_price: number;
          gst_rate: number;
          hsn_code?: string | null;
        }>;
      }>;
    }>('/khata/customers/lookup', { params: { phone } });
    return res.data;
  },
  listSuppliers: async () => {
    const res = await api.get<{
      total_suppliers: number;
      total_outstanding_payable: number;
      suppliers: Array<{
        supplier_name: string;
        supplier_phone?: string | null;
        supplier_gstin?: string | null;
        bill_count: number;
        total_purchased: number;
        total_paid: number;
        outstanding_payable: number;
        last_purchase_date?: string | null;
      }>;
    }>('/khata/suppliers');
    return res.data;
  },
  listPayments: async (params?: { ledger_type?: 'CUSTOMER' | 'SUPPLIER'; party_phone?: string }) => {
    const res = await api.get<
      Array<{
        id: number;
        ledger_type: string;
        party_name: string;
        party_phone?: string | null;
        amount: number;
        payment_mode: string;
        notes?: string | null;
        created_at?: string | null;
      }>
    >('/khata/payments', { params });
    return res.data;
  },
  recordPayment: async (payload: {
    ledger_type: 'CUSTOMER' | 'SUPPLIER';
    party_name: string;
    party_phone?: string;
    party_gstin?: string;
    amount: number;
    payment_mode: string;
    notes?: string;
  }) => {
    const res = await api.post('/khata/payments', payload);
    return res.data;
  },
  getCatalogTemplates: async () => {
    const res = await api.get<{
      templates: Array<{
        code: string;
        product_name: string;
        trade_name: string;
        company_name: string;
        category: string;
        unit: string;
        net_content: string;
        hsn_code: string;
        gst_rate: string;
        purchase_price: string;
        selling_price: string;
        mrp: string;
        initial_stock: number;
      }>;
    }>('/khata/catalog-templates');
    return res.data;
  },
  importCatalog: async (codes?: string[]) => {
    const res = await api.post<{
      imported_count: number;
      skipped_count: number;
      imported_products: Array<{ id: number; product_code: string; product_name: string }>;
    }>('/khata/import-catalog', { codes });
    return res.data;
  },
  applyExpiryClearance: async (product_id: number, discount_percent: number) => {
    const res = await api.post<{
      product_id: number;
      product_name: string;
      base_selling_price: number;
      discount_percent: number;
      new_selling_price: number;
    }>('/khata/expiry-clearance', { product_id, discount_percent });
    return res.data;
  },
  getShiftHandover: async (target_date?: string) => {
    const res = await api.get<{
      date: string;
      total_net_cash_in_drawer: number;
      cashiers: Array<{
        user_id: number;
        username: string;
        name: string;
        role: string;
        bills_count: number;
        cash_sales: number;
        upi_sales: number;
        card_sales: number;
        credit_sales_issued: number;
        khata_cash_collected: number;
        khata_upi_collected: number;
        net_cash_in_drawer: number;
      }>;
    }>('/khata/shift-handover', { params: target_date ? { target_date } : undefined });
    return res.data;
  },
  getComplianceRegister: async () => {
    const res = await api.get<{
      generated_at: string;
      shop_name: string;
      gstin?: string | null;
      fertilizer_license_no?: string | null;
      pesticide_license_no?: string | null;
      seed_license_no?: string | null;
      stock_cum_price_board: Array<{
        product_id: number;
        product_code?: string | null;
        product_name: string;
        company_name?: string | null;
        category: string;
        batch_number: string;
        expiry_date?: string | null;
        current_stock: number;
        unit: string;
        selling_price: number;
        mrp: number;
      }>;
      batch_sale_register: Array<{
        invoice_number: string;
        sale_date?: string | null;
        farmer_name: string;
        farmer_phone: string;
        farmer_village: string;
        farmer_aadhar: string;
        product_name: string;
        company_name: string;
        batch_number: string;
        quantity: number;
        unit: string;
        total_amount: number;
      }>;
    }>('/khata/compliance-register');
    return res.data;
  },
};

export const agriDoctorApi = {
  getCrops: async () => {
    const res = await api.get<AgriDoctorCrop[]>('/agri-doctor/crops');
    return res.data;
  },
  getAdvisories: async (params?: { crop?: string; pest?: string; search?: string }) => {
    const res = await api.get<AgriDoctorAdvisory[]>('/agri-doctor/advisories', { params });
    return res.data;
  },
  getRecommendation: async (crop: string, pest_disease: string) => {
    const res = await api.get<AgriDoctorAdvisory>('/agri-doctor/recommend', {
      params: { crop, pest_disease },
    });
    return res.data;
  },
};

export const campaignsApi = {
  getTemplates: async () => {
    const res = await api.get<CampaignTemplate[]>('/campaigns/templates');
    return res.data;
  },
  getSegments: async (params?: { season?: string; category?: string; village?: string; khata_filter?: string }) => {
    const res = await api.get<SegmentSummaryResponse>('/campaigns/segments', { params });
    return res.data;
  },
  create: async (data: {
    campaign_name: string;
    season: string;
    target_crop?: string;
    target_village?: string;
    template_text: string;
    recipients_count: number;
  }) => {
    const res = await api.post<MarketingCampaign>('/campaigns', data);
    return res.data;
  },
  list: async () => {
    const res = await api.get<MarketingCampaign[]>('/campaigns');
    return res.data;
  },
  incrementSent: async (campaignId: number) => {
    const res = await api.put<MarketingCampaign>(`/campaigns/${campaignId}/increment`);
    return res.data;
  },
};

export const ewayBillApi = {
  generateJson: async (saleId: number, payload: EWayBillGeneratePayload) => {
    const res = await api.post<EWayBillGenerateResponse>(`/eway-bill/sales/${saleId}/generate-json`, payload);
    return res.data;
  },
  saveNumber: async (saleId: number, eway_bill_no: string) => {
    const res = await api.put<{
      success: boolean;
      sale_id: number;
      invoice_number: string;
      eway_bill_no: string;
      eway_bill_date: string;
      message: string;
    }>(`/eway-bill/sales/${saleId}/number`, { eway_bill_no });
    return res.data;
  },
};

export function getErrorMessage(err: any, fallback: string = 'An unexpected error occurred'): string {
  if (!err) return fallback;
  const status = err.response?.status;
  const rawDetail = err.response?.data?.detail;
  // Gateway-level failures (API Gateway / Lambda timeout) return generic bodies like
  // {"message":"Service Unavailable"} — translate them into something actionable.
  if (!rawDetail && (status === 502 || status === 503 || status === 504)) {
    return 'Server is taking too long to respond. Please try again in a moment.';
  }
  if (!err.response && err.code === 'ERR_NETWORK') {
    return 'Unable to reach the server. Please check your internet connection.';
  }
  const detail = rawDetail ?? err.response?.data?.message ?? err.message;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => {
      if (typeof d === 'string') return d;
      const field = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
      return field ? `${field}: ${d.msg || 'invalid'}` : (d.msg || JSON.stringify(d));
    }).join('\n');
  }
  if (typeof detail === 'object') {
    if (detail.message) return detail.message;
    return JSON.stringify(detail);
  }
  return String(detail);
}

