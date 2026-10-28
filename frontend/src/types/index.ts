export type UserRole = 'owner' | 'operator';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  subscription_status?: string;
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

export interface ProductBatch {
  id: number;
  product_id: number;
  batch_number: string;
  trade_name?: string;
  company_name?: string;
  manufacture_date?: string;
  expiry_date: string;
  purchase_price: number;
  selling_price: number;
  mrp?: number;
  current_stock: number;
  is_active?: boolean;
}

export interface ProductVariant {
  id?: number;
  product_id?: number;
  variant_name: string;
  unit_size: number;
  unit: string;
  purchase_price: number;
  selling_price: number;
  mrp: number;
  stock: number;
  barcode?: string;
  is_active?: boolean;
}

export interface Product {
  id: number;
  name: string;
  product_name?: string;
  product_code?: string;
  company_name?: string;
  trade_name?: string;
  category: string;
  hsn_code: string;
  unit: string;
  net_content?: string;
  barcode?: string;
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
  variants?: ProductVariant[];
  batches?: ProductBatch[];
}

export interface RefillRecommendation {
  product_id: number;
  product_name: string;
  company_name?: string;
  trade_name?: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  units_sold_30d: number;
  sales_velocity_per_day: number;
  days_of_stock_left: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  urgency_reason: string;
  suggested_refill_quantity: number;
}

export interface AnalyticsData {
  period: {
    start: string;
    end: string;
    preset: string;
  };
  summary: {
    total_revenue: number;
    total_taxable: number;
    total_gst: number;
    total_bills: number;
    average_bill_value: number;
    total_cogs: number;
    gross_profit: number;
    gross_margin_percent: number;
  };
  day_wise: {
    date: string;
    label: string;
    revenue: number;
    bills: number;
    gst: number;
    profit: number;
    cogs: number;
  }[];
  monthly: {
    month: string;
    label: string;
    revenue: number;
    bills: number;
    gst: number;
    profit: number;
  }[];
  hourly: {
    hour: number;
    label: string;
    orders: number;
    revenue: number;
  }[];
  payment_breakdown: {
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }[];
  top_products: {
    product_name: string;
    quantity: number;
    revenue: number;
    cogs: number;
    profit: number;
    orders: number;
    unit: string;
  }[];
}


export interface SaleItem {
  id?: number;
  product_id: number;
  batch_id?: number;
  product_name: string;
  company_name?: string;
  trade_name?: string;
  batch_number: string;
  expiry_date?: string;
  hsn_code: string;
  unit: string;
  quantity: number;
  unit_price: number;
  price?: number;
  mrp: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  gst_amount?: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  total?: number;
}

export interface Sale {
  id: number;
  invoice_number: string;
  invoice_date: string;
  sale_date?: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_aadhar?: string;
  customer_gstin?: string;
  payment_mode: 'Cash' | 'UPI' | 'Card' | 'Credit' | 'Bank Transfer' | string;
  payment_method?: string;
  is_interstate: boolean;
  subtotal: number;
  gst_amount?: number;
  total_discount: number;
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  round_off: number;
  grand_total: number;
  notes?: string;
  status: 'Completed' | 'Cancelled' | 'Refunded' | string;
  items: SaleItem[];
}

export interface PurchaseItem {
  id?: number;
  product_id: number;
  product_name?: string;
  company_name?: string;
  trade_name?: string;
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

export interface ReturnEligibleItem {
  sale_item_id: number;
  product_id?: number;
  batch_id?: number;
  batch_number?: string;
  product_name: string;
  company_name?: string;
  net_content?: string;
  unit?: string;
  sold_quantity: number;
  previously_returned_quantity: number;
  available_return_quantity: number;
  unit_price: number;
  gst_rate: number;
  total_price: number;
}

export interface InvoiceReturnLookup {
  sale_id: number;
  invoice_number: string;
  sale_date: string;
  customer_name?: string;
  customer_phone?: string;
  original_grand_total: number;
  original_payment_method: string;
  items: ReturnEligibleItem[];
  existing_returns_count: number;
}

export interface SalesReturnItem {
  id?: number;
  sales_return_id?: number;
  sale_item_id?: number;
  product_id?: number;
  batch_id?: number;
  batch_number?: string;
  product_name: string;
  company_name?: string;
  net_content?: string;
  returned_quantity: number;
  unit_price: number;
  gst_rate: number;
  refund_taxable: number;
  refund_gst: number;
  refund_total: number;
}

export interface SalesReturn {
  id: number;
  return_number: string;
  sale_id: number;
  invoice_number: string;
  customer_name?: string;
  customer_phone?: string;
  refund_subtotal: number;
  refund_gst_amount: number;
  refund_grand_total: number;
  refund_payment_method: string;
  reason?: string;
  notes?: string;
  return_date: string;
  created_at: string;
  items: SalesReturnItem[];
}

export interface SalesReturnCreatePayload {
  sale_id: number;
  invoice_number: string;
  refund_payment_method?: string;
  reason?: string;
  notes?: string;
  items: {
    sale_item_id: number;
    returned_quantity: number;
  }[];
}

