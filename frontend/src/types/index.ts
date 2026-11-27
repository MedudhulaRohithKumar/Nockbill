export type UserRole = 'owner' | 'operator';

export type InvoiceTemplateId = 'CLASSIC_GST' | 'MODERN_CORPORATE' | 'COMPACT_RETAIL' | 'THERMAL_80MM';

export interface IamUser {
  id: number;
  name: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  role: 'OWNER' | 'STAFF';
  shop_id?: number;
  shop_account_id?: string | null;
  subscription_status?: string;
  is_active: boolean;
  created_at: string;
}

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
  shop_account_id?: string;
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
  invoice_counter?: number;
  default_gst_rate?: number;
  currency?: string;
  thermal_print?: boolean;
  logo_path?: string | null;
  subscription_status?: string;
  terms_conditions?: string;
  invoice_template?: InvoiceTemplateId;
  invoice_accent_color?: string;
  invoice_header_tagline?: string;
  invoice_footer_note?: string;
  invoice_signature_label?: string;
  invoice_show_logo?: boolean;
  invoice_show_licenses?: boolean;
  invoice_show_bank_details?: boolean;
  invoice_show_batch_expiry?: boolean;
  invoice_show_hsn?: boolean;
}

export interface ProductBatch {
  id: number;
  product_id: number;
  batch_number: string;
  trade_name?: string;
  company_name?: string;
  manufacture_date?: string;
  expiry_date?: string | null;
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
  net_content?: number | string | null;
  barcode?: string;
  current_stock: number;
  cost_price: number;
  purchase_price?: number;
  base_selling_price?: number;
  selling_price: number;
  price_list_id?: number | null;
  price_list_name?: string | null;
  price_list_type?: 'DISCOUNT' | 'INCREMENT' | string | null;
  price_list_mode?: 'PERCENTAGE' | 'FIXED' | string | null;
  price_list_value?: number | null;
  price_list_active?: boolean;
  mrp: number;
  gst_rate: number;
  batch_number: string;
  manufacture_date?: string;
  expiry_date?: string;
  category_attributes?: Record<string, string | number | boolean | undefined>;
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

export interface PriceList {
  id: number;
  shop_id: number;
  name: string;
  description?: string;
  adjustment_type: 'DISCOUNT' | 'INCREMENT';
  calculation_mode: 'PERCENTAGE' | 'FIXED';
  adjustment_value: number;
  is_active: boolean;
  product_count: number;
  product_ids: number[];
  products: {
    id: number;
    product_name: string;
    trade_name?: string;
    company_name?: string;
    category: string;
    unit: string;
    base_selling_price: number;
    selling_price: number;
    current_stock: number;
  }[];
  created_at?: string;
  updated_at?: string;
}

export interface CategoryAnalyticsItem {
  category: string;
  product_count: number;
  stock_units: number;
  stock_value: number;
  units_sold: number;
  orders: number;
  revenue: number;
  cogs: number;
  profit: number;
  percentage: number;
  products: {
    id: number;
    product_name: string;
    trade_name?: string;
    company_name?: string;
    category: string;
    barcode?: string;
    batch_number?: string;
    unit: string;
    current_stock: number;
    selling_price: number;
    cost_price: number;
    units_sold: number;
    revenue: number;
    profit: number;
    orders: number;
  }[];
}

export interface RefillRecommendation {
  product_id: number;
  product_name: string;
  company_name?: string;
  trade_name?: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  purchase_price?: number;
  selling_price?: number;
  barcode?: string;
  units_sold_30d: number;
  times_sold_30d?: number;
  sales_velocity_per_day: number;
  daily_velocity?: number;
  days_of_stock_left: number;
  days_stock_remaining?: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  urgency_reason: string;
  reason?: string;
  suggested_refill_quantity: number;
  recommended_refill_quantity?: number;
  product?: Partial<Product>;
}

export interface AnalyticsData {
  period: {
    start: string;
    end: string;
    preset: string;
  };
  summary: {
    total_revenue: number;
    total_returns?: number;
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
  category_breakdown?: CategoryAnalyticsItem[];
  top_products: {
    product_name: string;
    category?: string;
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
  vehicle_no?: string;
  eway_bill_no?: string;
  eway_bill_date?: string;
  notes?: string;
  status: 'Completed' | 'Cancelled' | 'Refunded' | string;
  items: SaleItem[];
}

export interface PurchaseItem {
  id?: number;
  product_id?: number | null;
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
  category: 'Rent' | 'Electricity' | 'Transport' | 'Labor' | 'Packaging' | 'Office' | 'Internet' | 'Maintenance' | 'Misc';
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

// ── Agri Doctor & Advisory ─────────────────────────────────────────
export interface AgriDoctorMatchingProduct {
  id: number;
  product_name: string;
  trade_name?: string;
  company_name?: string;
  category?: string;
  unit?: string;
  hsn_code?: string;
  gst_rate?: number;
  selling_price: number;
  mrp?: number;
  current_stock: number;
  batch_number?: string;
  expiry_date?: string;
  in_stock: boolean;
  matched_molecule?: string;
}

export interface AgriDoctorAdvisory {
  crop_name: string;
  hindi_name: string;
  pest_disease: string;
  disease_hindi: string;
  category: string;
  technical_molecule: string;
  dosage_per_pump: string;
  dosage_per_acre: string;
  symptoms: string;
  root_cause?: string;
  crop_safety_warning?: string;
  advisory_notes: string;
  matching_products: AgriDoctorMatchingProduct[];
}

export interface AgriDoctorCrop {
  crop_name: string;
  hindi_name: string;
  pest_count: number;
  pests: string[];
}

export interface PublicAgriQuestionResponse {
  is_agriculture_related: boolean;
  topic: string;
  answer: string;
  key_recommendations: string[];
  safety_note: string;
  provider: string;
}

export interface AgriDoctorApprovedMolecule {
  technical_molecule: string;
  active_keywords: string[];
  verified_brands: string[];
  dosage_per_pump: string;
  dosage_per_acre: string;
  phi_and_application: string;
}

export interface AgriDoctorDiagnosisResponse {
  is_agriculture_related: boolean;
  detected_crop: string;
  likely_condition: string;
  confidence: string;
  treatment_category: string;
  root_cause_explanation: string;
  approved_molecules: AgriDoctorApprovedMolecule[];
  verification_checklist: string[];
  crop_safety_warnings: string[];
  matching_products: AgriDoctorMatchingProduct[];
  out_of_stock_notice?: string | null;
  provider: string;
}

// ── Marketing & Seasonal WhatsApp Broadcast ─────────────────────────
export interface FarmerSegmentItem {
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  village?: string;
  total_bills: number;
  total_spend: number;
  last_visit_date?: string;
  preferred_categories: string[];
  pending_khata_balance: number;
}

export interface SegmentSummaryResponse {
  total_farmers: number;
  total_matching: number;
  villages: string[];
  farmers: FarmerSegmentItem[];
}

export interface CampaignTemplate {
  id: string;
  title: string;
  season: string;
  category: string;
  template: string;
  description: string;
}

export interface MarketingCampaign {
  id: number;
  campaign_name: string;
  season: string;
  target_crop?: string;
  target_village?: string;
  template_text: string;
  total_recipients: number;
  sent_count: number;
  read_count?: number;
  revenue_attributed?: number;
  created_at: string;
}

// ── GST E-Way Bill ──────────────────────────────────────────────────
export interface EWayBillGeneratePayload {
  vehicle_no: string;
  trans_distance_km?: number;
  trans_mode?: string;
  vehicle_type?: string;
  transporter_id?: string;
  transporter_name?: string;
}

export interface EWayBillGenerateResponse {
  success: boolean;
  invoice_number: string;
  filename: string;
  eway_bill_data: Record<string, unknown>;
  portal_upload_url: string;
  instructions: string;
}


