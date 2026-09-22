import api from './client';
import { Product, Sale, Purchase, Expense, ShopSettings, OCRCandidate, DashboardSummary } from '../types';

export const authApi = {
  login: async (credentials: { username: string; password: string } | FormData) => {
    let payload: any;
    if (credentials instanceof FormData) {
      payload = {
        username: credentials.get('username') as string,
        password: credentials.get('password') as string,
      };
    } else {
      payload = credentials;
    }
    const res = await api.post<{ access_token: string; token_type: string; role: string; username: string; name?: string; user_id?: number }>('/auth/login', payload);
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
  }
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
  create: async (data: any) => {
    const res = await api.post<Sale>('/sales', data);
    return res.data;
  },
  cancel: async (id: number, reason: string) => {
    const res = await api.post<Sale>(`/sales/${id}/cancel`, { reason });
    return res.data;
  },
  getPdfUrl: (saleId: number) => `/api/invoices/${saleId}/pdf`,
};

export const purchasesApi = {
  getAll: async () => {
    const res = await api.get<Purchase[]>('/purchases');
    return res.data;
  },
  create: async (data: any) => {
    const res = await api.post<Purchase>('/purchases', data);
    return res.data;
  }
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
