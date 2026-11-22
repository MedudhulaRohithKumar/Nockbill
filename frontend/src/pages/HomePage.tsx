import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sprout, 
  ArrowRight, 
  Play, 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown,
  Layers, 
  CheckCircle2, 
  Stethoscope, 
  Bug, 
  Search, 
  X,
  Award, 
  Send, 
  Sparkles, 
  Camera, 
  ScanLine, 
  Check, 
  ExternalLink,
  Zap,
  Cpu,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OrbitalLoader } from '../components/common/OrbitalLoader';

// ─── PLATFORM FEATURE ITEM CONTRACT ──────────────────────────────────────────
export interface PlatformFeatureItem {
  id: string;
  code: string;
  name: string;
  path: string;
  badge: string;
  badgeColor: string;
  summary: string;
  detail: string;
  gstRate?: string;
  shortcut?: string;
}

// ─── STACKED CARD CONTRACT ───────────────────────────────────────────────────
export interface StackedCard {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  iconName: string;
  themeColor: string;
  accentBorder: string;
  features: PlatformFeatureItem[];
}

export const STACKED_CARDS: StackedCard[] = [
  {
    id: 'card-pos',
    index: '01',
    title: 'Fast Counter POS, Rapid Billing & Sales Returns',
    subtitle: 'High-speed counter checkout built for agricultural and retail input dealers.',
    iconName: 'pos',
    themeColor: 'from-emerald-950 via-emerald-900 to-emerald-950',
    accentBorder: 'border-emerald-500/40',
    features: [
      {
        id: 'dashboard',
        code: 'MOD-01',
        name: 'Executive Live Dashboard',
        path: '/dashboard',
        badge: 'Real-Time Telemetry',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        summary: 'Live daily revenue, gross profit margins, outstanding credit totals, and cashier drawer balances.',
        detail: 'Instant graphical overview of counter footfall, fast-moving fertilizer rankings, and cashier till status updated with zero page refresh.',
      },
      {
        id: 'billing',
        code: 'MOD-02',
        name: 'New Bill (POS) Quick Checkout',
        path: '/billing',
        badge: '3-Sec Billing',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        summary: 'High-speed keyboard billing with barcode gun scanning, split Cash + UPI payments, and batch auto-allocation.',
        detail: 'Single-keystroke F1 counter checkout. Automatically computes statutory HSN taxes and prints 80mm ESC/POS thermal slips or full A4 GST invoices.',
        shortcut: 'F1 Key',
      },
      {
        id: 'returns',
        code: 'MOD-03',
        name: 'Sales Returns & Credit Vouchers',
        path: '/returns',
        badge: 'Auto-Restock',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        summary: 'Instant original invoice lookup, partial bag returns, inventory auto-restock, and farmer refund notes.',
        detail: 'Enables smooth customer returns of unused seed or fertilizer bags with batch verification, automatically restoring godown stock and adjusting the farmer credit ledger.',
      },
    ],
  },
  {
    id: 'card-khata',
    index: '02',
    title: 'Digital Khata Ledgers, Shift Handover & Statutory Form O',
    subtitle: 'Farmer credit recovery, distributor payables, till balancing, and FCO 1985 compliance.',
    iconName: 'khata',
    themeColor: 'from-slate-950 via-emerald-950 to-slate-900',
    accentBorder: 'border-amber-500/40',
    features: [
      {
        id: 'farmer-khata',
        code: 'MOD-04',
        name: 'Farmer Credit Ledger (Khata)',
        path: '/khata?tab=farmers',
        badge: 'Credit Recovery',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        summary: 'Farmer-wise credit tracking, repayment receipts, and 1-click WhatsApp payment reminders with dynamic UPI QR.',
        detail: 'Eliminates paper udhar diaries. Tracks season-long agricultural credit, partial repayments, and dispatches automated payment reminders with direct UPI payment links.',
      },
      {
        id: 'supplier-khata',
        code: 'MOD-05',
        name: 'Supplier Payables Ledger (Khata)',
        path: '/khata?tab=suppliers',
        badge: 'Payables Control',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        summary: 'Inward distributor invoices, pending supplier payables, payout logs, and vendor balance reconciliations.',
        detail: 'Records credit days and payment due dates for major fertilizer and agrochemical manufacturing companies, avoiding overdue interest charges.',
      },
      {
        id: 'catalog-clearance',
        code: 'MOD-06',
        name: '1-Click Agri Catalog & Clearance',
        path: '/khata?tab=catalog',
        badge: 'Expiry Watch',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
        summary: '500+ pre-seeded fertilizers, seeds, and agrochemicals with automated 90-day expiry clearance alerts.',
        detail: 'Instantly imports verified products with pre-configured HSN codes and GST rates. Automated clearance warnings alert store owners to discount near-expiry batches.',
      },
      {
        id: 'shift-handover',
        code: 'MOD-07',
        name: 'Cashier Shift Handover',
        path: '/khata?tab=handover',
        badge: 'Till Security',
        badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
        summary: 'Morning/evening cash drawer reconciliation, denomination counting, and cash handover audit trails.',
        detail: 'Prevents register leakage between shifts. Cashiers log exact physical currency denominations and reconcile with billed cash sales before closing the till.',
      },
      {
        id: 'form-o',
        code: 'MOD-08',
        name: 'Agri Inspector Register (Form O)',
        path: '/khata?tab=compliance',
        badge: 'Statutory FCO',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        summary: 'Fertilizer Control Order (FCO 1985) digital statutory register for Agriculture Officers and inspections.',
        detail: 'Mandatory statutory register capturing manufacturer license numbers, batch numbers, expiry dates, chemical active percentages, and farmer landholding records.',
      },
    ],
  },
  {
    id: 'card-inventory',
    index: '03',
    title: 'Complete 7-Tier Inventory with Regulated GST Slabs',
    subtitle: 'Automated tax calculations, batch expiry enforcement, and multi-category stock control.',
    iconName: 'inventory',
    themeColor: 'from-emerald-950 via-slate-900 to-emerald-950',
    accentBorder: 'border-teal-500/40',
    features: [
      {
        id: 'inv-fertilizer',
        code: 'MOD-09',
        name: 'Fertilizer Category',
        path: '/inventory?category=Fertilizer',
        badge: '5% GST Rate',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        summary: 'Urea, DAP, MOP, SSP, NPK complexes, and water-soluble fertilizers with strict batch tracking.',
        detail: 'Automated 5% GST calculation with HSN 3102/3105. Strict batch-wise tracking of 45kg/50kg bags with manufacturer license validation.',
        gstRate: '5%',
      },
      {
        id: 'inv-pesticide',
        code: 'MOD-10',
        name: 'Pesticide Category',
        path: '/inventory?category=Pesticide',
        badge: '18% GST Rate',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        summary: 'Insecticides, fungicides, herbicides, and weedicides with technical chemical active tracking.',
        detail: 'Standard 18% GST with HSN 3808. Strict expiry date enforcement under the Insecticides Act 1968, active ingredient dosage registry, and chemical batch tracking.',
        gstRate: '18%',
      },
      {
        id: 'inv-seeds',
        code: 'MOD-11',
        name: 'Seeds Category',
        path: '/inventory?category=Seeds',
        badge: '0% GST (Exempt)',
        badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
        summary: 'Hybrid seeds, certified field crop varieties with lot numbers, purity, and germination validity.',
        detail: 'Zero tax (0% GST) with HSN 1209. Lot-number tracking, germination validity periods, and seed dealer certification registry.',
        gstRate: '0%',
      },
      {
        id: 'inv-micronutrients',
        code: 'MOD-12',
        name: 'Micronutrients Category',
        path: '/inventory?category=Micronutrients',
        badge: '12% GST Rate',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        summary: 'Chelated zinc, boron, ferrous, magnesium, and multi-micronutrient foliar spray formulations.',
        detail: 'Regulated 12% GST rate with HSN 3824. Plant nutrition tracking for corrective foliar and basal application.',
        gstRate: '12%',
      },
      {
        id: 'inv-bio-fertilizer',
        code: 'MOD-13',
        name: 'Bio-Fertilizer Category',
        path: '/inventory?category=Bio-Fertilizer',
        badge: '5% GST Rate',
        badgeColor: 'bg-lime-100 text-lime-800 border-lime-200',
        summary: 'Rhizobium, Azotobacter, PSB, mycorrhiza, and living organic microbial inoculants.',
        detail: 'Eco-friendly bio-fertilizers with 5% GST rate. Shelf-life tracking for live bacterial and fungal crop inoculants.',
        gstRate: '5%',
      },
      {
        id: 'inv-organic',
        code: 'MOD-14',
        name: 'Organic Category',
        path: '/inventory?category=Organic',
        badge: '0% GST (Exempt)',
        badgeColor: 'bg-green-100 text-green-800 border-green-200',
        summary: 'Neem cake, vermicompost, city compost, and organic soil health boosters.',
        detail: 'Zero GST rate on unbranded organic compost and soil enrichers. Promotes natural regenerative agriculture.',
        gstRate: '0%',
      },
      {
        id: 'inv-others',
        code: 'MOD-15',
        name: 'Agri Equipment & Others',
        path: '/inventory?category=Others',
        badge: '18% GST Rate',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        summary: 'Knapsack sprayers, battery pumps, safety masks, greenhouse tarpaulins, and irrigation fittings.',
        detail: 'Hardware and protective farm accessories with standard 18% GST rate and serial number warranty logs.',
        gstRate: '18%',
      },
    ],
  },
  {
    id: 'card-marketing',
    index: '04',
    title: 'WhatsApp Broadcast Marketing & Customer Growth',
    subtitle: 'Seasonal crop-stage broadcasts, disease alerts, new arrival broadcasts, and payment collections.',
    iconName: 'marketing',
    themeColor: 'from-emerald-950 via-slate-900 to-emerald-950',
    accentBorder: 'border-emerald-400/40',
    features: [
      {
        id: 'campaigns',
        code: 'MOD-16',
        name: 'WhatsApp Broadcast Marketing',
        path: '/campaigns',
        badge: 'Seasonal Growth',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        summary: 'Crop-stage seasonal broadcasts, disease alerts, new arrival broadcasts, and payment collections.',
        detail: 'Segment farmers by crop (Cotton, Paddy, Wheat, Chilli), village, or credit status. Dispatch personalized English advisory and payment reminder templates with one click.',
      },
    ],
  },
  {
    id: 'card-management',
    index: '05',
    title: 'Tiered Price Lists, FIFO Purchases & Executive Analytics',
    subtitle: 'Owner-locked margins, landed purchase costing, GSTR tax exports, and role-based access.',
    iconName: 'management',
    themeColor: 'from-slate-950 via-purple-950 to-slate-900',
    accentBorder: 'border-purple-500/40',
    features: [
      {
        id: 'price-lists',
        code: 'MOD-17',
        name: 'Tiered Price Lists (Owner Locked)',
        path: '/price-lists',
        badge: 'Owner Locked',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
        summary: 'Multi-tier pricing rules: Farmer Retail, Cooperative Wholesale, Volume Discounts, and Special Sub-Dealer rates.',
        detail: 'Restricted to store owners. Prevents cashiers from altering negotiated wholesale or retail pricing margins at the counter.',
      },
      {
        id: 'purchases',
        code: 'MOD-18',
        name: 'Inward / Purchases & Landed Costing',
        path: '/purchases',
        badge: 'FIFO Costing',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        summary: 'Supplier purchase invoice entry, batch creation, landed cost computation, and inventory auto-update.',
        detail: 'Automated FIFO cost accounting. Records transport freight charges, distributor invoice numbers, and auto-generates scannable product batches.',
      },
      {
        id: 'reports',
        code: 'MOD-19',
        name: 'GST & Financial Reports',
        path: '/reports',
        badge: 'GSTR-1 & 3B',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        summary: 'Official monthly GSTR-1, GSTR-3B tax returns, HSN-wise sales summaries, and P&L balances.',
        detail: 'One-click export of GST-compliant Excel and PDF reports for your chartered accountant. Complete audit trails of all financial entries.',
      },
      {
        id: 'analytics',
        code: 'MOD-20',
        name: 'Live Analytics & Heatmaps',
        path: '/analytics',
        badge: 'Real-Time Telemetry',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        summary: 'Category market share breakdowns, sales velocity curves, and aging credit recovery analytics.',
        detail: 'Visual representation of store performance, top farmer spending cohorts, seasonal demand forecasting, and inventory turnover ratios.',
      },
      {
        id: 'settings',
        code: 'MOD-21',
        name: 'Shop Management & IAM RBAC',
        path: '/settings',
        badge: 'AWS-Style IAM',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
        summary: 'Multi-user roles (Owner, Manager, Cashier, Agronomist), invoice template builder, and statutory licenses.',
        detail: 'Granular permissions, custom logo upload, thermal 80mm vs A4 template switcher, and statutory fertilizer, seed, and pesticide license registrations.',
      },
    ],
  },
];

// ─── PUBLIC AGRI DOCTOR ADVISORY KNOWLEDGE BASE ───────────────────────────────
export interface PublicAdvisory {
  crop: string;
  pest: string;
  scientificName: string;
  category: string;
  symptoms: string;
  molecule: string;
  dosagePump: string;
  dosageAcre: string;
  applicationNotes: string;
}

export const PUBLIC_ADVISORIES: PublicAdvisory[] = [
  {
    crop: 'Cotton',
    pest: 'Pink Bollworm',
    scientificName: 'Pectinophora gossypiella',
    category: 'Insect Pest',
    symptoms: 'Rosetted flowers, small bore holes on green bolls with brown frass, premature boll drop and stained lint.',
    molecule: 'Emamectin Benzoate 5% SG',
    dosagePump: '8 - 10 g / 15L pump',
    dosageAcre: '88 - 100 g / acre',
    applicationNotes: 'Spray in late afternoon when moth activity begins. Ensure complete coverage of developing squares and bolls.',
  },
  {
    crop: 'Cotton',
    pest: 'Whitefly & Leaf Hopper',
    scientificName: 'Bemisia tabaci / Amrasca biguttula',
    category: 'Sucking Pest',
    symptoms: 'Downward curling and yellowing of leaves, sticky honeydew secretion with sooty mold growth.',
    molecule: 'Diafenthiuron 50% WP / Acetamiprid 20% SP',
    dosagePump: '20 g / 15L pump',
    dosageAcre: '200 - 250 g / acre',
    applicationNotes: 'Target the undersides of leaves where nymphs cluster. Rotate with insect growth regulators to prevent resistance.',
  },
  {
    crop: 'Paddy',
    pest: 'Rice Blast',
    scientificName: 'Magnaporthe oryzae',
    category: 'Fungal Disease',
    symptoms: 'Spindle-shaped elliptical lesions with reddish-brown margins and ash-grey centres on leaves and neck choking.',
    molecule: 'Tricyclazole 75% WP',
    dosagePump: '15 - 18 g / 15L pump',
    dosageAcre: '120 - 150 g / acre',
    applicationNotes: 'Apply preventatively at boot leaf stage or upon first appearance of leaf spots. Avoid excessive nitrogen fertilizer.',
  },
  {
    crop: 'Paddy',
    pest: 'Brown Planthopper (BPH)',
    scientificName: 'Nilaparvata lugens',
    category: 'Insect Pest',
    symptoms: 'Circular patches of drying plants turning yellow-brown (hopper burn) at the base of the paddy tillers.',
    molecule: 'Pymetrozine 50% WDG / Dinotefuran 20% SG',
    dosagePump: '12 - 15 g / 15L pump',
    dosageAcre: '100 - 120 g / acre',
    applicationNotes: 'Drain excess standing field water before spraying. Direct the nozzle towards the base of the paddy tillers.',
  },
  {
    crop: 'Wheat',
    pest: 'Yellow Stripe Rust',
    scientificName: 'Puccinia striiformis',
    category: 'Fungal Disease',
    symptoms: 'Linear yellow chlorotic pustules arranged parallel along leaf veins that shed bright yellow powder.',
    molecule: 'Propiconazole 25% EC',
    dosagePump: '15 - 20 ml / 15L pump',
    dosageAcre: '200 ml / acre',
    applicationNotes: 'Spray immediately upon detection of the first pustule stripe in the field during cool, humid winter mornings.',
  },
  {
    crop: 'Chilli',
    pest: 'Chilli Leaf Curl & Thrips',
    scientificName: 'Scirtothrips dorsalis',
    category: 'Sucking Pest / Virus',
    symptoms: 'Upward curling (boat-shaped) of tender leaves, stunted apical growth, crinkling and blossom drop.',
    molecule: 'Fipronil 5% SC / Spinetoram 11.7% SC',
    dosagePump: '25 ml / 15L pump',
    dosageAcre: '300 ml / acre',
    applicationNotes: 'Spray during early vegetative and flowering stages. Combine with neem oil for synergistic vector control.',
  },
  {
    crop: 'Tomato',
    pest: 'Early Blight & Fruit Rot',
    scientificName: 'Alternaria solani',
    category: 'Fungal Disease',
    symptoms: 'Dark brown concentric target-board rings on lower leaves, yellow chlorotic halo, stem cankers and sunken fruit rot.',
    molecule: 'Mancozeb 75% WP / Azoxystrobin 23% SC',
    dosagePump: '30 g / 15L pump',
    dosageAcre: '400 - 500 g / acre',
    applicationNotes: 'Ensure good air circulation between plants and avoid overhead sprinkler irrigation during spore formation.',
  },
  {
    crop: 'Maize',
    pest: 'Fall Armyworm (FAW)',
    scientificName: 'Spodoptera frugiperda',
    category: 'Insect Pest',
    symptoms: 'Pinholes and window-paning on whorl leaves with ragged feeding holes and abundant moist sawdust frass.',
    molecule: 'Chlorantraniliprole 18.5% SC',
    dosagePump: '6 - 7 ml / 15L pump',
    dosageAcre: '60 - 80 ml / acre',
    applicationNotes: 'Direct spray into the central plant whorl where the caterpillar feeds. Apply early in the morning.',
  },
];

export const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  // Stacking Card state
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>('billing');

  // Public Agri Doctor recommendation state
  const [selectedCrop, setSelectedCrop] = useState<string>('Cotton');
  const [searchSymptom, setSearchSymptom] = useState<string>('');

  // AI Diagnostic Simulation State
  const [isScanningLeaf, setIsScanningLeaf] = useState<boolean>(false);
  const [aiScanResult, setAiScanResult] = useState<{
    disease: string;
    confidence: string;
    molecule: string;
    dosage: string;
  } | null>(null);

  const availableCrops = Array.from(new Set(PUBLIC_ADVISORIES.map((a) => a.crop)));

  const currentCropAdvisories = PUBLIC_ADVISORIES.filter((adv) => {
    const matchesCrop = adv.crop === selectedCrop;
    const matchesSearch = !searchSymptom || 
      adv.pest.toLowerCase().includes(searchSymptom.toLowerCase()) ||
      adv.symptoms.toLowerCase().includes(searchSymptom.toLowerCase()) ||
      adv.molecule.toLowerCase().includes(searchSymptom.toLowerCase());
    return matchesCrop && matchesSearch;
  });

  const buildWhatsAppShareUrl = (adv: PublicAdvisory) => {
    const text = `*NockBill Agri Doctor Advisory*\n` +
      `🌾 *Crop:* ${adv.crop}\n` +
      `🐛 *Target Pest / Disease:* ${adv.pest} (${adv.scientificName})\n` +
      `📋 *Symptoms:* ${adv.symptoms}\n` +
      `🧪 *Approved Molecule:* ${adv.molecule}\n` +
      `💧 *Dosage (15L Pump):* ${adv.dosagePump}\n` +
      `🚜 *Dosage (Per Acre):* ${adv.dosageAcre}\n` +
      `📌 *Application Note:* ${adv.applicationNotes}\n\n` +
      `_Generated by NockBill Agricultural Advisory System._`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const handleSimulateAiScan = () => {
    setIsScanningLeaf(true);
    setAiScanResult(null);
    setTimeout(() => {
      setIsScanningLeaf(false);
      setAiScanResult({
        disease: 'Rice Blast (Magnaporthe oryzae)',
        confidence: '98.6% Neural Match',
        molecule: 'Tricyclazole 75% WP',
        dosage: '15 - 18 g / 15L spray pump',
      });
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-slate-900 font-sans selection:bg-emerald-600 selection:text-white">
      {/* ─── FLOATING TOP NAVIGATION BAR ─────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Mark: Strictly NockBill */}
          <Link
            to="/"
            className="flex items-center gap-2.5 bg-white/85 hover:bg-white backdrop-blur-md px-4 py-2 rounded-full border border-white/90 shadow-sm transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center text-emerald-200 shadow-inner">
              <Sprout className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="font-['Grandstander'] font-black text-xl text-emerald-950 leading-none tracking-tight">
                  Nock<span className="text-emerald-700">Bill</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 font-black">
                  Agri ERP
                </span>
              </div>
            </div>
          </Link>

          {/* Frosted Glass Pill Menu (Store Login link removed per user request) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 px-6 py-2 rounded-full border shadow-sm backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(173, 196, 174, 0.45)',
              borderColor: 'rgba(255, 255, 255, 0.55)',
            }}
          >
            <a
              href="#mission-vision"
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              Mission &amp; Vision
            </a>
            <span className="text-white/40 text-xs">·</span>
            <a
              href="#platform-features"
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              All Features
            </a>
            <span className="text-white/40 text-xs">·</span>
            <a
              href="#agri-doctor-section"
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" />
              Free Agri Doctor
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs bg-emerald-800 text-white shadow-md hover:bg-emerald-900 transition-all"
              >
                <span>Store Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-full text-xs font-bold text-white bg-black/25 hover:bg-black/40 backdrop-blur-md border border-white/30 transition-all shadow-sm"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs bg-white text-[#5b875c] shadow-md hover:bg-emerald-50 transition-all transform hover:-translate-y-0.5"
                >
                  <span>Open Store</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#5b875c]" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO CANVAS (PASTORAL SUNNY SKY + ANIMATED VIDEO OVERLAY) ────────── */}
      <section className="relative w-full overflow-hidden min-h-[960px] lg:min-h-[1060px] flex flex-col justify-between pt-24 pb-12">
        {/* Layer 1: Hand-painted Ghibli pastoral plate + Looping Video Overlay */}
        <div className="absolute inset-0 z-0 select-none pointer-events-none overflow-hidden">
          <img
            src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/3ca5d10d-ea2f-4907-876f-33bde169469e.jpg"
            alt="Sunny pastoral meadow hillside with soft cumulus clouds and gentle breeze"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />

          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute left-0 w-full object-cover pointer-events-none opacity-90 transition-opacity duration-1000"
            style={{
              height: '112.5%',
              top: '-6.25%',
              mixBlendMode: 'screen',
            }}
          >
            <source
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/d2cb5bef-f92b-4e91-ae93-8dc6555e56ac.mp4"
              type="video/mp4"
            />
          </video>

          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/20 to-black/25" />
          <div className="absolute inset-0 bg-radial-at-c from-transparent via-transparent to-emerald-950/35" />
        </div>

        {/* Layer 2: Real NockBill Value Proposition Copy (Left-Aligned to leave visual unobstructed) */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-14">
          <div className="max-w-xl text-left flex flex-col items-start">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/35 shadow-sm mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-mono text-white uppercase tracking-widest font-black drop-shadow">
                INDIA&apos;S LEADING AGRI-FINTECH &amp; POS PLATFORM
              </span>
            </div>

            <div className="flex flex-col select-none">
              <h1 className="font-['Grandstander'] text-5xl sm:text-6xl md:text-7xl lg:text-[84px] text-white font-black drop-shadow-[0_6px_22px_rgba(20,83,45,0.7)] leading-[0.94] tracking-tight">
                EMPOWERING
              </h1>
              <h1 className="font-['Grandstander'] text-5xl sm:text-6xl md:text-7xl lg:text-[84px] text-emerald-200 font-black drop-shadow-[0_6px_26px_rgba(20,83,45,0.75)] leading-[0.94] tracking-tight mt-1">
                AGRI COMMERCE &amp; RETAIL
              </h1>
            </div>

            <p className="text-sm sm:text-base md:text-lg text-white/95 mt-5 font-medium leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              Built for fertilizer, seeds, and pesticide retailers. Rapid 3-second counter billing, 80mm thermal receipts, digital Farmer Khata credit recovery, automated Form O statutory registers, and field-grade agronomic AI.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 mt-7">
              <Link
                to="/register"
                className="flex items-center justify-center px-7 py-3 rounded-full bg-white text-[#5b875c] font-black text-xs sm:text-sm shadow-2xl hover:bg-emerald-50 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
              >
                Open Your Store
              </Link>

              <a
                href="#platform-features"
                className="group flex items-center justify-center gap-2 px-5 py-3 rounded-full shadow-lg backdrop-blur-md transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(204, 218, 173, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.45)',
                }}
              >
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Play className="w-3 h-3 fill-emerald-900 text-emerald-900 ml-0.5" />
                </div>
                <span className="font-bold text-emerald-950 text-xs sm:text-sm">
                  Explore All Features
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Layer 3: CORE PILLARS OF NOCKBILL (Positioned further down and smaller per user instruction) */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24 md:mt-32 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h2 className="font-mono text-xs sm:text-sm font-black text-white uppercase tracking-wider drop-shadow-md">
                CORE PILLARS OF NOCKBILL
              </h2>
            </div>
            <a
              href="#platform-features"
              className="font-mono text-[11px] sm:text-xs text-white/90 hover:text-white flex items-center gap-1 drop-shadow transition-colors group"
            >
              <span>browse all 21 modules</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* 3 Compact 3D Pastoral Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: 3D POS Counter */}
            <div
              onClick={() => {
                const el = document.getElementById('platform-features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                setActiveCardIndex(0);
              }}
              className="group relative rounded-xl overflow-hidden shadow-xl bg-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-emerald-950/40 cursor-pointer border border-white/25"
            >
              <div className="h-28 sm:h-32 w-full overflow-hidden relative bg-emerald-950/30">
                <img
                  src="/images/pos_3d.jpg"
                  alt="3D POS billing counter with 80mm thermal printer, barcode gun, and fertilizer sack in sunny pastoral meadow"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[9px] font-black uppercase shadow-xs">
                  RETAIL CHECKOUT
                </div>
              </div>
              <div className="p-3.5 bg-white/95 backdrop-blur-md">
                <span className="font-mono text-[10px] text-[#5b875c] uppercase tracking-wider font-bold block">
                  Fast Counter POS [F1]
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-emerald-950 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                  3-Second Rapid Billing &amp; 80mm ESC/POS
                </h3>
                <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                  Barcode gun scanning, split Cash + UPI payments in one receipt.
                </p>
              </div>
            </div>

            {/* Card 2: 3D Agri Doctor */}
            <div
              onClick={() => {
                const el = document.getElementById('agri-doctor-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative rounded-xl overflow-hidden shadow-xl bg-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-emerald-950/40 cursor-pointer border border-white/25"
            >
              <div className="h-28 sm:h-32 w-full overflow-hidden relative bg-emerald-950/30">
                <img
                  src="/images/agri_doctor_3d.jpg"
                  alt="3D Agri Doctor laboratory setup with modern microscope and leaf telemetry rings in sunny oak meadow"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-sky-600 text-white font-mono text-[9px] font-black uppercase shadow-xs">
                  AI TELEMETRY
                </div>
              </div>
              <div className="p-3.5 bg-white/95 backdrop-blur-md">
                <span className="font-mono text-[10px] text-sky-700 uppercase tracking-wider font-bold block">
                  Crop Diagnostic Engine
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-emerald-950 line-clamp-1 group-hover:text-sky-700 transition-colors">
                  Agri Doctor &amp; Chemical Formulations
                </h3>
                <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                  Instant pest/disease diagnosis and approved spray dosage guidelines.
                </p>
              </div>
            </div>

            {/* Card 3: 3D Khata & Compliance */}
            <div
              onClick={() => {
                const el = document.getElementById('platform-features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                setActiveCardIndex(1);
              }}
              className="group relative rounded-xl overflow-hidden shadow-xl bg-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-emerald-950/40 cursor-pointer border border-white/25"
            >
              <div className="h-28 sm:h-32 w-full overflow-hidden relative bg-emerald-950/30">
                <img
                  src="/images/compliance_3d.jpg"
                  alt="3D agricultural compliance emblem with Form O certificate, ledger book, rupee coin, and UPI smartphone in sunny meadow"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-600 text-white font-mono text-[9px] font-black uppercase shadow-xs">
                  STATUTORY RECOVERY
                </div>
              </div>
              <div className="p-3.5 bg-white/95 backdrop-blur-md">
                <span className="font-mono text-[10px] text-amber-700 uppercase tracking-wider font-bold block">
                  Statutory &amp; Credit Ledger
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-emerald-950 line-clamp-1 group-hover:text-amber-700 transition-colors">
                  Farmer Khata &amp; Form O Register
                </h3>
                <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                  WhatsApp payment reminders, shift handovers, and FCO Form O ledgers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPANY MISSION & VISION SECTION (Stats removed per user request) ─── */}
      <section id="mission-vision" className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 font-mono text-xs uppercase tracking-widest font-black mb-3 border border-emerald-200">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>Our Purpose &amp; Horizon</span>
            </div>
            <h2 className="font-['Grandstander'] text-3xl sm:text-4xl text-emerald-950 font-black tracking-tight">
              Company Mission &amp; Vision
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm md:text-base mt-2 leading-relaxed">
              NockBill is built on the ground with agro-dealers, input centers, and agricultural communities across India. Here is what drives every line of code we ship.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Mission Card */}
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-3xl p-7 sm:p-9 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Sprout className="w-48 h-48 text-emerald-300" />
              </div>
              <div className="relative z-10">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mb-5">
                  <Sprout className="w-5 h-5 text-emerald-300" />
                </div>
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-300 font-bold block mb-2">
                  OUR MISSION
                </span>
                <h3 className="font-['Grandstander'] text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  Modernize &amp; Protect India&apos;s Agri-Retailers &amp; Dealers
                </h3>
                <p className="text-emerald-100/90 text-xs sm:text-sm mt-3 leading-relaxed font-normal">
                  To empower, protect, and digitize fertilizer, seed, and pesticide dealers across India with lightning-fast point-of-sale hardware integration, airtight statutory compliance (FCO 1985 &amp; Form O), and automated credit recovery that bridges mutual trust between growers and merchants.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-emerald-800/80 relative z-10 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-300 shrink-0" />
                <div>
                  <span className="text-sm font-black font-mono text-white block">100% Statutory Compliance</span>
                  <span className="text-xs text-emerald-300">Fertilizer Control Order 1985 &amp; Insecticides Act</span>
                </div>
              </div>
            </div>

            {/* Vision Card */}
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950 rounded-3xl p-7 sm:p-9 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <ShieldCheck className="w-48 h-48 text-emerald-300" />
              </div>
              <div className="relative z-10">
                <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mb-5">
                  <ShieldCheck className="w-5 h-5 text-sky-300" />
                </div>
                <span className="font-mono text-xs uppercase tracking-widest text-sky-300 font-bold block mb-2">
                  OUR VISION
                </span>
                <h3 className="font-['Grandstander'] text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  The Sovereign Digital Backbone of Modern Agri-Commerce
                </h3>
                <p className="text-slate-200 text-xs sm:text-sm mt-3 leading-relaxed font-normal">
                  To build the sovereign digital infrastructure for modern agri-commerce—unifying agricultural input retailers, cooperative banks, distributors, and farming communities on an intelligent, transparent platform that safeguards food security from soil to store.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-800 relative z-10 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-sky-300 shrink-0" />
                <div>
                  <span className="text-sm font-black font-mono text-white block">Zero-Conflict Transparency</span>
                  <span className="text-xs text-sky-300">Real-time ledger parity for merchants &amp; growers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ALL PLATFORM FEATURES: STACKING CARDS & LINE-BY-LINE REVEAL ───────── */}
      <section id="platform-features" className="w-full py-20 px-4 sm:px-6 lg:px-8 bg-[#faf8ff] border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-mono text-xs uppercase tracking-widest font-black mb-2.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Stacking Feature Deck</span>
              </div>
              <h2 className="font-['Grandstander'] text-3xl sm:text-4xl text-emerald-950 font-black tracking-tight">
                All Platform Features
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm md:text-base mt-1.5 max-w-2xl">
                Interactive stacking cards showcasing every module line-by-line. Click on any line to expand detailed specifications.
              </p>
            </div>

            {/* Quick Card Stepper */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 font-bold uppercase tracking-wider hidden lg:inline">
                Jump to Deck:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {STACKED_CARDS.map((card, idx) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setActiveCardIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                      activeCardIndex === idx
                        ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-500/30'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {card.index}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── INTERACTIVE STACKING CARDS CONTAINER ────────────────────────── */}
          <div className="relative space-y-6">
            {STACKED_CARDS.map((card, cardIdx) => {
              const isSelected = activeCardIndex === cardIdx;
              return (
                <div
                  key={card.id}
                  className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
                    isSelected
                      ? `bg-white shadow-xl ${card.accentBorder} ring-2 ring-emerald-500/20`
                      : 'bg-white/80 border-slate-200 hover:border-slate-300 shadow-sm opacity-90'
                  }`}
                >
                  {/* Card Header Banner */}
                  <div
                    onClick={() => setActiveCardIndex(cardIdx)}
                    className={`p-5 sm:p-6 flex items-center justify-between cursor-pointer border-b transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white border-emerald-800/60'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-sm shrink-0 shadow-sm ${
                          isSelected
                            ? 'bg-emerald-500 text-emerald-950'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {card.index}
                      </div>
                      <div>
                        <h3 className={`text-base sm:text-lg font-bold tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {card.title}
                        </h3>
                        <p className={`text-xs mt-0.5 line-clamp-1 ${isSelected ? 'text-emerald-200/80' : 'text-slate-500'}`}>
                          {card.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full hidden sm:inline ${
                        isSelected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {card.features.length} Features
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200 ${
                          isSelected ? 'rotate-180 text-emerald-300' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Line-by-Line Reveal Items (Visible when Card is Selected) */}
                  {isSelected && (
                    <div className="divide-y divide-slate-100 p-4 sm:p-6 bg-white space-y-2">
                      {card.features.map((feat, featIdx) => {
                        const isExpanded = expandedFeatureId === feat.id;
                        return (
                          <div
                            key={feat.id}
                            className={`rounded-2xl transition-all duration-200 border ${
                              isExpanded
                                ? 'bg-emerald-50/40 border-emerald-200 shadow-xs'
                                : 'bg-slate-50/50 hover:bg-slate-50 border-transparent hover:border-slate-200'
                            }`}
                          >
                            {/* Line Header Row */}
                            <div
                              onClick={() => setExpandedFeatureId(isExpanded ? null : feat.id)}
                              className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer"
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <span className="font-mono text-xs font-bold text-slate-400 shrink-0 mt-0.5 sm:mt-0">
                                  {feat.code}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900 hover:text-emerald-800 transition-colors">
                                      {feat.name}
                                    </h4>
                                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${feat.badgeColor}`}>
                                      {feat.badge}
                                    </span>
                                    {feat.gstRate && (
                                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        GST: {feat.gstRate}
                                      </span>
                                    )}
                                    {feat.shortcut && (
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                                        {feat.shortcut}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                                    {feat.summary}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 font-bold bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Active Module</span>
                                </div>
                                <span className="text-xs text-slate-400 font-mono">
                                  {isExpanded ? 'Hide Specs ▲' : 'Details ▼'}
                                </span>
                              </div>
                            </div>

                            {/* Line-by-Line Expanded Details */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5 text-xs text-slate-700 border-t border-emerald-100/60 mt-1">
                                <div className="p-3.5 bg-white rounded-xl border border-emerald-200/80 shadow-inner space-y-2">
                                  <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-900 font-bold">
                                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Detailed Operational Capability:</span>
                                  </div>
                                  <p className="leading-relaxed text-slate-600">
                                    {feat.detail}
                                  </p>
                                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                                    <span className="text-[10px] font-mono text-slate-400">
                                      System Endpoint: <code className="text-slate-600 font-bold">{feat.path}</code>
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-800">
                                      Ready on Retail POS
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PUBLIC AGRI DOCTOR ADVISORY & UPCOMING AI INTEGRATION ───────────── */}
      <section id="agri-doctor-section" className="w-full py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          {/* Section Heading */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 text-sky-800 font-mono text-xs uppercase tracking-widest font-black mb-3 border border-sky-200">
              <Stethoscope className="w-4 h-4 text-sky-700" />
              <span>Public Agronomic Intelligence</span>
            </div>
            <h2 className="font-['Grandstander'] text-3xl sm:text-4xl md:text-5xl text-emerald-950 font-black tracking-tight">
              Free Agri Doctor Advisory Engine
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm md:text-base mt-2">
              Any farmer, dealer, or guest can freely look up disease diagnoses, observed field symptoms, and government-approved chemical molecules with exact spray dosages. (No store login or stock required).
            </p>
          </div>

          {/* ─── UPCOMING AI FEATURE SHOWCASE: MULTIMODAL LEAF SCANNER ─────────── */}
          <div className="mb-12 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 rounded-3xl p-6 sm:p-9 text-white border border-emerald-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Camera className="w-64 h-64 text-emerald-400" />
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-xs font-black uppercase tracking-wider mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  <span>Upcoming AI Feature · Neural Computer Vision</span>
                </div>
                <h3 className="font-['Grandstander'] text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  Multimodal Leaf Photo Diagnostic Engine
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/90 mt-2.5 leading-relaxed">
                  We are integrating on-device and cloud neural vision models directly into NockBill. Store clerks or farmers can snap a photo of an infected crop leaf with any smartphone or webcam. The AI detects the pathogen, measures infection severity, and formulates the approved CIB&amp;RC chemical spray recipe in under 2 seconds.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
                  <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                    <span className="font-mono text-[10px] text-emerald-300 font-bold uppercase block">Step 01</span>
                    <span className="text-xs font-bold text-white block mt-0.5">Snap Leaf Photo</span>
                    <span className="text-[11px] text-white/70 block mt-0.5">Mobile camera or USB counter webcam</span>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                    <span className="font-mono text-[10px] text-teal-300 font-bold uppercase block">Step 02</span>
                    <span className="text-xs font-bold text-white block mt-0.5">Neural Pathology Scan</span>
                    <span className="text-[11px] text-white/70 block mt-0.5">Identifies blast, rust, bollworm &amp; thrips</span>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                    <span className="font-mono text-[10px] text-amber-300 font-bold uppercase block">Step 03</span>
                    <span className="text-xs font-bold text-white block mt-0.5">Prescription Dispatch</span>
                    <span className="text-[11px] text-white/70 block mt-0.5">Exact chemical dilution sent to WhatsApp</span>
                  </div>
                </div>
              </div>

              {/* Interactive AI Scanner Simulation Box */}
              <div className="lg:w-80 w-full bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 shrink-0 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 mb-3 relative">
                  <Camera className="w-7 h-7" />
                  {isScanningLeaf && (
                    <ScanLine className="w-8 h-8 text-emerald-400 absolute animate-bounce" />
                  )}
                </div>

                <h4 className="text-sm font-bold text-white">
                  Test AI Diagnostic Engine
                </h4>
                <p className="text-[11px] text-white/70 mt-1 mb-4">
                  Run a live simulation of the upcoming computer vision pathology scanner.
                </p>

                <button
                  type="button"
                  onClick={handleSimulateAiScan}
                  disabled={isScanningLeaf}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isScanningLeaf ? (
                    <>
                      <Cpu className="w-4 h-4 animate-spin" />
                      <span>Scanning Leaf Features...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Run Simulated Leaf Scan</span>
                    </>
                  )}
                </button>

                {aiScanResult && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-left w-full animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300">
                      <span>{aiScanResult.confidence}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-xs font-bold text-white mt-1">
                      {aiScanResult.disease}
                    </div>
                    <div className="text-[11px] text-emerald-200 mt-1">
                      Rx: {aiScanResult.molecule}
                    </div>
                    <div className="text-[10px] text-white/70">
                      {aiScanResult.dosage}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── PUBLIC ADVISORIES DIRECTORY (SEARCH & FILTERS) ───────────────── */}
          <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 mb-8 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Crop Selector Pills */}
              <div>
                <label htmlFor="crop-select-label" id="crop-select-label" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Select Target Crop:
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCrops.map((crop) => (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => setSelectedCrop(crop)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedCrop === crop
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {crop}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symptom Search Bar */}
              <div className="w-full lg:w-80">
                <label htmlFor="search-symptom-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Search Pest / Symptom:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="search-symptom-input"
                    type="text"
                    value={searchSymptom}
                    onChange={(e) => setSearchSymptom(e.target.value)}
                    placeholder="e.g. Bollworm, Blast, Rust, Curl..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  {searchSymptom && (
                    <button
                      type="button"
                      onClick={() => setSearchSymptom('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Public Advisories List */}
          <div className="space-y-4">
            {currentCropAdvisories.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <Bug className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No matching advisory found for this query.</p>
                <p className="text-xs text-slate-500 mt-1">Try clearing your search query or selecting a different crop.</p>
              </div>
            ) : (
              currentCropAdvisories.map((adv, idx) => (
                <div
                  key={`${adv.crop}-${adv.pest}-${idx}`}
                  className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm hover:border-emerald-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                >
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-200">
                        {adv.category}
                      </span>
                      <span className="text-xs font-mono text-slate-500 italic">
                        {adv.scientificName}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-emerald-950">
                      {adv.pest} on {adv.crop}
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      <strong className="text-slate-900">Symptoms:</strong> {adv.symptoms}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 italic">
                      <strong className="text-slate-700 not-italic">Application Guidance:</strong> {adv.applicationNotes}
                    </p>
                  </div>

                  {/* Recommendation Dosage Box */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 shrink-0 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-left lg:text-right">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                        Approved Technical Molecule
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-900 block mt-0.5">
                        {adv.molecule}
                      </span>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-700">
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          Pump: {adv.dosagePump}
                        </span>
                        <span className="bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded">
                          Acre: {adv.dosageAcre}
                        </span>
                      </div>
                    </div>

                    <a
                      href={buildWhatsAppShareUrl(adv)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Share via WhatsApp</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ─── PUBLIC FOOTER (STRICTLY NOCKBILL) ─────────────────────────────────── */}
      <footer className="w-full bg-emerald-950 text-white/90 pt-16 pb-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-white/10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-emerald-400 flex items-center justify-center text-emerald-950 font-bold">
                  <Sprout className="w-4 h-4 text-emerald-950" />
                </div>
                <span className="font-['Grandstander'] font-bold text-xl text-white">NockBill</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                The next-generation agri retail operating system and agricultural billing standard designed for resilient cooperatives and input dealers across India.
              </p>
              <div className="flex items-center gap-2 mt-4 text-xs text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                <span>CIB&amp;RC &amp; FCO 1985 Certified</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3">Core Modules</h4>
              <ul className="space-y-2 text-xs text-white/80">
                <li><Link to="/billing" className="hover:text-white transition-colors">Fast Counter POS [F1]</Link></li>
                <li><Link to="/khata?tab=compliance" className="hover:text-white transition-colors">Fertilizer Form O Records</Link></li>
                <li><Link to="/khata" className="hover:text-white transition-colors">Farmer Credit Khata</Link></li>
                <li><a href="#agri-doctor-section" className="hover:text-white transition-colors">Agri Doctor Disease AI</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3">Statutory Standards</h4>
              <ul className="space-y-2 text-xs text-white/80">
                <li><span>Fertilizer Control Order (FCO 1985)</span></li>
                <li><span>Insecticides Act 1968 Compliance</span></li>
                <li><span>Seeds Act 1966 Certification</span></li>
                <li><span>State NIC Ag-Stack Direct API</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-3">Dealership Support</h4>
              <p className="text-xs text-white/70 mb-3">Need on-site terminal setup, ESC/POS printer driver packs, or barcode rolls?</p>
              <Link
                to="/register"
                className="inline-block w-full text-center py-2.5 px-4 rounded-full bg-emerald-400 text-emerald-950 font-bold text-xs hover:bg-white transition-all"
              >
                Contact Support Desk
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-white/60 gap-4">
            <span>&copy; 2026 NockBill Technologies Pvt Ltd. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <a href="#platform-features" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#platform-features" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#platform-features" className="hover:text-white transition-colors">Security Architecture</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── FLOATING AGRI DOCTOR ICON IN RIGHT BOTTOM CORNER ─────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 group">
        <div className="bg-emerald-950/95 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg border border-emerald-500/30 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-200 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Agri Doctor AI · Free Crop Diagnosis</span>
        </div>

        <button
          type="button"
          id="floating-agri-doctor-btn"
          aria-label="Open Agri Doctor AI Crop Advisory"
          onClick={() => {
            const el = document.getElementById('agri-doctor-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-white/80 cursor-pointer"
        >
          <span className="absolute -inset-1 rounded-full bg-emerald-400/40 animate-ping pointer-events-none" />
          <div className="relative z-10 flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-white stroke-[2.2]" />
            <Sprout className="w-3.5 h-3.5 text-emerald-200 absolute -top-1 -right-1" />
          </div>
          <span className="absolute top-1 right-1 w-3 h-3 bg-amber-400 border-2 border-white rounded-full" />
        </button>
      </div>
    </div>
  );
};
