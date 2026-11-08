import api from './client';
import { Product, Sale, Purchase, Expense, ShopSettings, OCRCandidate, DashboardSummary, RefillRecommendation, AnalyticsData, InvoiceReturnLookup, SalesReturn, SalesReturnCreatePayload, PriceList } from '../types';

export const authApi = {
  getCaptcha: async () => {
    const res = await api.get<{ captcha_token: string; captcha_image: string }>('/auth/captcha');
    return res.data;
  },
  login: async (credentials: { username: string; password: string; captcha_token: string; captcha_code: string } | FormData) => {
    let payload: any;
    if (credentials instanceof FormData) {
      payload = {
        username: credentials.get('username') as string,
        password: credentials.get('password') as string,
        captcha_token: credentials.get('captcha_token') as string,
        captcha_code: credentials.get('captcha_code') as string,
      };
    } else {
      payload = credentials;
    }
    const res = await api.post<{ access_token: string; token_type: string; role: string; username: string; name?: string; user_id?: number; subscription_status?: string }>('/auth/login', payload);
    return res.data;
  },
  register: async (payload: any) => {
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
      credentials: any;
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
    options?: { shop_name?: string; password?: string; phone?: string; gstin?: string } | string
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
      user_id?: number;
      subscription_status?: string;
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
  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  }
};

export const productsApi = {
  getAll: async (params?: { category?: string; search?: string; low_stock?: boolean }) => {
    const res = await api.get<Product[]>('/products', { params });
    return res.data;
  },
  getById: async (id: number) => {
    const res = await api.get<Product>(`/products/${id}`);
    return res.data;
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
    const token = localStorage.getItem('token');
    const query = new URLSearchParams();
    if (token) query.set('token', token);
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
    const token = localStorage.getItem('token');
    return token ? `/api/invoices/${saleId}/pdf?token=${encodeURIComponent(token)}` : `/api/invoices/${saleId}/pdf`;
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
    const token = localStorage.getItem('token');
    return token ? `/api/returns/${returnId}/pdf?token=${encodeURIComponent(token)}` : `/api/returns/${returnId}/pdf`;
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
    const token = localStorage.getItem('token');
    return token ? `/api/purchases/${purchaseId}/pdf?token=${encodeURIComponent(token)}` : `/api/purchases/${purchaseId}/pdf`;
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
  }
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

