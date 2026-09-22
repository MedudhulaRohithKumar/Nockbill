export type UserRole = 'owner' | 'operator';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface ShopSettings {
  id: number;
  shop_name: string;
  proprietor_name: string;
  gstin: string;
  fertilizer_license_no?: string;
  pesticide_license_no?: string;
  seed_license_no?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  upi_id?: string;
  invoice_prefix: string;
  terms_conditions?: string;
}

export interface Product {
  id: number;
  name: string;
  product_name?: string;
  product_code?: string;
  company_name?: string;
  category: string;
  hsn_code: string;
  unit: string;
  current_stock: number;
  cost_price: number;
  purchase_price?: number;
  selling_price: number;
  mrp: number;
  gst_rate: number;
  batch_number: string;
  expiry_date?: string;
  manufacturer?: string;
  min_stock_level: number;
  minimum_stock?: number;
  is_active: boolean;
  days_until_expiry?: number | null;
  is_low_stock?: boolean;
  is_near_expiry?: boolean;
}

export interface SaleItem {
  id?: number;
  product_id: number;
  product_name: string;
  batch_number: string;
  expiry_date?: string;
  hsn_code: string;
  unit: string;
  quantity: number;
  unit_price: number;
  mrp: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export interface Sale {
  id: number;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_aadhar?: string;
  customer_gstin?: string;
  payment_mode: 'Cash' | 'UPI' | 'Card' | 'Credit' | 'Bank Transfer';
  is_interstate: boolean;
  subtotal: number;
  total_discount: number;
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  round_off: number;
  grand_total: number;
  notes?: string;
  status: 'Completed' | 'Cancelled' | 'Refunded';
  items: SaleItem[];
}

export interface PurchaseItem {
  id?: number;
  product_id: number;
  product_name?: string;
  batch_number: string;
  expiry_date?: string;
  hsn_code?: string;
  quantity: number;
  purchase_price: number;
  mrp: number;
  selling_price: number;
  gst_rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export interface Purchase {
  id: number;
  supplier_name: string;
  supplier_gstin?: string;
  supplier_phone?: string;
  bill_number: string;
  bill_date: string;
  total_amount: number;
  total_tax: number;
  status: string;
  items: PurchaseItem[];
}

export interface Expense {
  id: number;
  category: 'Rent' | 'Electricity' | 'Transport' | 'Labor' | 'Packaging' | 'Office' | 'Misc';
  amount: number;
  expense_date: string;
  description: string;
  payment_mode: string;
}

export interface OCRCandidate {
  product_id?: number;
  product_name: string;
  category?: string;
  hsn_code: string;
  batch_number: string;
  expiry_date?: string;
  mrp: number;
  selling_price: number;
  cost_price: number;
  unit: string;
  gst_rate: number;
  current_stock?: number;
  confidence: number;
  raw_text: string;
}

export interface DashboardSummary {
  today_sales: number;
  today_bills: number;
  month_sales: number;
  month_purchases: number;
  total_inventory_value: number;
  low_stock_count: number;
  near_expiry_count: number;
  month_expenses: number;
  month_net_profit: number;
  recent_sales: Sale[];
  low_stock_products: Product[];
  near_expiry_products: Product[];
}
