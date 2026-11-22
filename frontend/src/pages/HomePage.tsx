import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sprout, 
  ArrowRight, 
  Play, 
  ShieldCheck, 
  Store, 
  Receipt, 
  Layers, 
  ChevronRight, 
  Printer, 
  QrCode, 
  Scale, 
  Fingerprint, 
  Activity, 
  CheckCircle2, 
  Stethoscope, 
  Bug, 
  Droplets, 
  ExternalLink, 
  Search, 
  X,
  Lock,
  UserCheck,
  TrendingUp,
  BarChart3,
  Calendar,
  Send,
  Sparkles,
  Award,
  Clock,
  RotateCcw,
  Tag,
  Truck,
  FileSpreadsheet,
  Settings,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ─── FEATURE DATA CATALOG (EXACTLY MATCHING USER REQUIREMENTS) ─────────────────
interface PlatformFeature {
  id: string;
  name: string;
  category: 'pos' | 'khata' | 'inventory' | 'marketing' | 'management';
  badge: string;
  badgeColor: string;
  shortDesc: string;
  detail: string;
  gstRate?: string;
}

const PLATFORM_FEATURES: PlatformFeature[] = [
  // Core Sales & POS
  {
    id: 'dashboard',
    name: 'Executive Dashboard',
    category: 'pos',
    badge: 'Real-Time Insights',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    shortDesc: 'Live sales telemetry, gross profit margins, credit outstanding, and quick drawer totals.',
    detail: 'Visual revenue charts, daily customer footfall tracking, fast-moving fertilizer rankings, and cashier till status updated in real time.',
  },
  {
    id: 'billing',
    name: 'New Bill (POS) Quick',
    category: 'pos',
    badge: '3-Sec Checkout',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    shortDesc: 'Rapid counter billing with barcode scanning, split payments (Cash + UPI), and batch auto-allocation.',
    detail: 'Single-keystroke F1 billing designed for high-dust retail counters. Automatically computes HSN taxes and prints 80mm ESC/POS thermal slips or full A4 GST tax invoices.',
  },
  {
    id: 'returns',
    name: 'Sales Returns & Vouchers',
    category: 'pos',
    badge: 'Auto-Restock',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    shortDesc: 'Instant invoice lookup, partial return processing, inventory auto-restock, and refund notes.',
    detail: 'Handles farmer returns of unused bags with batch verification, updating the store inventory and adjusting the farmer credit ledger with credit vouchers.',
  },

  // Khata & Compliance
  {
    id: 'farmer-khata',
    name: 'Farmer Credit Ledger',
    category: 'khata',
    badge: 'Credit Recovery',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    shortDesc: 'Farmer-wise credit tracking, repayment receipts, and 1-click WhatsApp payment reminders with UPI QR.',
    detail: 'Complete digital khata keeping track of seasonal farmer credit, repayment history, outstanding balances, and dynamic UPI payment links sent via WhatsApp.',
  },
  {
    id: 'supplier-khata',
    name: 'Supplier Payables Ledger',
    category: 'khata',
    badge: 'Payables Control',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    shortDesc: 'Inward distributor invoices, pending payables, payout logs, and vendor balance reconciliations.',
    detail: 'Tracks credit days, payment due dates, and settlement vouchers for major fertilizer and pesticide manufacturing companies.',
  },
  {
    id: 'catalog-clearance',
    name: '1-Click Agri Catalog & Clearance',
    category: 'khata',
    badge: 'Expiry Watch',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    shortDesc: '500+ pre-seeded fertilizers, seeds, and agro-chemicals with automated expiry clearance alerts.',
    detail: 'One-click product onboarding with pre-configured HSN codes and GST rates. Automated clearance warnings for batches expiring within 90 days.',
  },
  {
    id: 'shift-handover',
    name: 'Cashier Shift Handover',
    category: 'khata',
    badge: 'Till Security',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    shortDesc: 'Opening/closing till cash reconciliation, denomination counting, and cash handover audit trails.',
    detail: 'Prevents counter leakage between morning and evening shifts. Records physical currency denominations and matches against billed cash sales.',
  },
  {
    id: 'form-o',
    name: 'Agri Inspector Register (Form O)',
    category: 'khata',
    badge: 'Statutory FCO',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    shortDesc: 'Fertilizer Control Order (FCO 1985) digital register for agriculture officers and inspections.',
    detail: 'Mandatory statutory register capturing manufacturer license numbers, batch numbers, expiry dates, chemical active percentages, and farmer landholding/Aadhaar records.',
  },

  // Growth & Marketing
  {
    id: 'campaigns',
    name: 'WhatsApp Broadcast Marketing',
    category: 'marketing',
    badge: 'Seasonal Growth',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    shortDesc: 'Crop-stage seasonal broadcasts, disease alerts, new arrival broadcasts, and payment collections.',
    detail: 'Segment farmers by crop (Cotton, Paddy, Wheat, Chilli), village, or credit status. Dispatch personalized English advisory and payment reminder templates with one click.',
  },

  // Inventory & Stock with GST Slabs
  {
    id: 'inv-fertilizer',
    name: 'Fertilizer Category',
    category: 'inventory',
    badge: '5% GST Rate',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    shortDesc: 'Urea, DAP, MOP, SSP, NPK complexes, and water-soluble fertilizers with batch tracking.',
    detail: 'Statutory 5% GST calculation with HSN 3102/3105. Strict batch-wise tracking of 45kg/50kg bags with manufacturer license validation.',
    gstRate: '5%',
  },
  {
    id: 'inv-pesticide',
    name: 'Pesticide Category',
    category: 'inventory',
    badge: '18% GST Rate',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    shortDesc: 'Insecticides, fungicides, herbicides, and weedicides with technical chemical active tracking.',
    detail: 'Standard 18% GST with HSN 3808. Strict expiry date enforcement under the Insecticides Act 1968, active ingredient dosage registry, and chemical batch tracking.',
    gstRate: '18%',
  },
  {
    id: 'inv-seeds',
    name: 'Seeds Category',
    category: 'inventory',
    badge: '0% GST (Exempt)',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    shortDesc: 'Hybrid seeds, certified field crop varieties with lot numbers, purity, and germination validity.',
    detail: 'Zero tax (0% GST) with HSN 1209. Lot-number tracking, germination validity periods, and seed dealer certification registry.',
    gstRate: '0%',
  },
  {
    id: 'inv-micronutrients',
    name: 'Micronutrients Category',
    category: 'inventory',
    badge: '12% GST Rate',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    shortDesc: 'Chelated zinc, boron, ferrous, magnesium, and multi-micronutrient foliar spray formulations.',
    detail: 'Regulated 12% GST rate with HSN 3824. Plant nutrition tracking for corrective foliar and basal application.',
    gstRate: '12%',
  },
  {
    id: 'inv-bio-fertilizer',
    name: 'Bio-Fertilizer Category',
    category: 'inventory',
    badge: '5% GST Rate',
    badgeColor: 'bg-lime-100 text-lime-800 border-lime-200',
    shortDesc: 'Rhizobium, Azotobacter, PSB, mycorrhiza, and living organic microbial inoculants.',
    detail: 'Eco-friendly bio-fertilizers with 5% GST rate. Shelf-life tracking for live bacterial and fungal crop inoculants.',
    gstRate: '5%',
  },
  {
    id: 'inv-organic',
    name: 'Organic Category',
    category: 'inventory',
    badge: '0% GST (Exempt)',
    badgeColor: 'bg-green-100 text-green-800 border-green-200',
    shortDesc: 'Neem cake, vermicompost, city compost, and organic soil health boosters.',
    detail: 'Zero GST rate on unbranded organic compost and soil enrichers. Promotes natural regenerative agriculture.',
    gstRate: '0%',
  },
  {
    id: 'inv-others',
    name: 'Agri Equipment & Others',
    category: 'inventory',
    badge: '18% GST Rate',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    shortDesc: 'Knapsack sprayers, battery pumps, safety masks, greenhouse tarpaulins, and irrigation fittings.',
    detail: 'Hardware and protective farm accessories with standard 18% GST rate and serial number warranty logs.',
    gstRate: '18%',
  },

  // Management & Procurement
  {
    id: 'price-lists',
    name: 'Tiered Price Lists (Owner)',
    category: 'management',
    badge: 'Owner Locked',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    shortDesc: 'Multi-tier pricing rules: Farmer Retail, Cooperative Wholesale, Volume Discounts, and Special Sub-Dealer rates.',
    detail: 'Restricted to store owners. Prevents cashiers from altering negotiated wholesale or retail pricing margins.',
  },
  {
    id: 'purchases',
    name: 'Inward / Purchases',
    category: 'management',
    badge: 'FIFO Costing',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    shortDesc: 'Supplier purchase invoice entry, batch creation, landed cost computation, and inventory auto-update.',
    detail: 'Automated FIFO cost accounting. Records transport freight charges, distributor invoice numbers, and auto-generates scannable product batches.',
  },
  {
    id: 'reports',
    name: 'GST & Financial Reports',
    category: 'management',
    badge: 'GSTR-1 & 3B',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    shortDesc: 'Official monthly GSTR-1, GSTR-3B tax returns, HSN-wise sales summaries, and P&L balances.',
    detail: 'One-click export of GST-compliant Excel/PDF reports for your chartered accountant. Complete audit trails of all financial entries.',
  },
  {
    id: 'analytics',
    name: 'Live Analytics & Heatmaps',
    category: 'management',
    badge: 'Real-Time Telemetry',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    shortDesc: 'Category market share breakdowns, sales velocity curves, and aging credit recovery analytics.',
    detail: 'Visual representation of store performance, top farmer spending cohorts, seasonal demand forecasting, and inventory turnover ratios.',
  },
  {
    id: 'settings',
    name: 'Shop Management & IAM RBAC',
    category: 'management',
    badge: 'AWS-Style IAM',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    shortDesc: 'Multi-user roles (Owner, Manager, Cashier, Agronomist), invoice template builder, and statutory licenses.',
    detail: 'Granular permissions, custom logo upload, thermal 80mm vs A4 template switcher, and statutory fertilizer, seed, and pesticide license registrations.',
  },
];

// ─── PUBLIC AGRI DOCTOR ADVISORY KNOWLEDGE BASE ───────────────────────────────
interface PublicAdvisory {
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

const PUBLIC_ADVISORIES: PublicAdvisory[] = [
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
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Active filter tab for complete feature catalog
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'pos' | 'khata' | 'inventory' | 'marketing' | 'management'>('all');

  // Public Agri Doctor recommendation state
  const [selectedCrop, setSelectedCrop] = useState<string>('Cotton');
  const [searchSymptom, setSearchSymptom] = useState<string>('');
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState<boolean>(false);
  const [activeModalAdvisory, setActiveModalAdvisory] = useState<PublicAdvisory | null>(null);

  // Portal login state
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [storeSlug, setStoreSlug] = useState<string>('green-valley-agro');
  const [username, setUsername] = useState<string>('owner@green-valley');
  const [password, setPassword] = useState<string>('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<string>('owner');

  const filteredFeatures = PLATFORM_FEATURES.filter((feat) => {
    if (selectedCategory === 'all') return true;
    return feat.category === selectedCategory;
  });

  const availableCrops = Array.from(new Set(PUBLIC_ADVISORIES.map((a) => a.crop)));

  const currentCropAdvisories = PUBLIC_ADVISORIES.filter((adv) => {
    const matchesCrop = adv.crop === selectedCrop;
    const matchesSearch = !searchSymptom || 
      adv.pest.toLowerCase().includes(searchSymptom.toLowerCase()) ||
      adv.symptoms.toLowerCase().includes(searchSymptom.toLowerCase()) ||
      adv.molecule.toLowerCase().includes(searchSymptom.toLowerCase());
    return matchesCrop && matchesSearch;
  });

  const handleFillDemo = () => {
    setStoreSlug('green-valley-agro');
    setUsername('devendra@green-valley');
    setPassword('RuralPass#2026');
    setSelectedRole('owner');
  };

  const handlePortalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authTab === 'login') {
      navigate('/login');
    } else {
      navigate('/register');
    }
  };

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

  return (
    <div className="min-h-screen bg-[#faf8ff] text-slate-900 font-sans selection:bg-emerald-600 selection:text-white">
      {/* ─── FLOATING TOP NAVIGATION BAR ─────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Mark: Strictly NockBill */}
          <Link
            to="/"
            className="flex items-center gap-2.5 bg-white/80 hover:bg-white backdrop-blur-md px-4 py-2 rounded-full border border-white/90 shadow-sm transition-all group"
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

          {/* Frosted Glass Pill Menu */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-5 px-6 py-2 rounded-full border shadow-sm backdrop-blur-md"
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
            <span className="text-white/40 text-xs">·</span>
            <a
              href="#portal-auth"
              className="text-xs font-semibold text-white drop-shadow hover:text-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
              Store Login
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
      <section className="relative w-full overflow-hidden min-h-[920px] lg:min-h-[1020px] flex flex-col justify-between pt-24 pb-16">
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

          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-950/20 to-black/30" />
          <div className="absolute inset-0 bg-radial-at-c from-transparent via-transparent to-emerald-950/40" />
        </div>

        {/* Layer 2: Real NockBill Value Proposition Copy & Grandstander Title */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 flex flex-col items-start">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/35 shadow-sm mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-mono text-white uppercase tracking-widest font-black drop-shadow">
              INDIA&apos;S LEADING AGRI-FINTECH &amp; POS PLATFORM
            </span>
          </div>

          <div className="flex flex-col select-none">
            <h1 className="font-['Grandstander'] text-5xl sm:text-7xl md:text-8xl lg:text-[96px] text-white font-black drop-shadow-[0_6px_22px_rgba(20,83,45,0.7)] leading-[0.92] tracking-tight">
              EMPOWERING
            </h1>
            <h1 className="font-['Grandstander'] text-5xl sm:text-7xl md:text-8xl lg:text-[96px] text-emerald-200 font-black drop-shadow-[0_6px_26px_rgba(20,83,45,0.75)] leading-[0.92] tracking-tight mt-1">
              RURAL AGRI COMMERCE
            </h1>
          </div>

          <p className="text-base sm:text-xl md:text-2xl text-white/95 max-w-2xl mt-6 font-medium leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
            Built for fertilizer, seeds, and pesticide retailers. Rapid 3-second counter billing, 80mm thermal receipts, digital Farmer Khata credit recovery, automated Form O statutory registers, and field-grade agronomic AI.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-8">
            <Link
              to="/register"
              className="flex items-center justify-center px-8 py-3.5 rounded-full bg-white text-[#5b875c] font-black text-sm sm:text-base shadow-2xl hover:bg-emerald-50 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
            >
              Open Your Store
            </Link>

            <a
              href="#platform-features"
              className="group flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full shadow-lg backdrop-blur-md transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
              style={{
                backgroundColor: 'rgba(204, 218, 173, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.45)',
              }}
            >
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Play className="w-3.5 h-3.5 fill-emerald-900 text-emerald-900 ml-0.5" />
              </div>
              <span className="font-bold text-emerald-950 text-xs sm:text-sm">
                Explore All Features
              </span>
            </a>
          </div>
        </div>

        {/* Layer 3: Relevant 3D Pastoral Feature Cards (Replaced Generic Cartoons) */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 md:mt-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="font-['Grandstander'] text-base sm:text-lg font-black text-white uppercase tracking-wider drop-shadow-md">
                CORE PILLARS OF NOCKBILL
              </h2>
            </div>
            <a
              href="#platform-features"
              className="font-mono text-xs sm:text-sm text-white/90 hover:text-white flex items-center gap-1 drop-shadow transition-colors group"
            >
              <span>browse all 20+ modules</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* 3 Bespoke 3D Claymorphic Pastoral Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: 3D POS Counter */}
            <div
              onClick={() => {
                const el = document.getElementById('platform-features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                setSelectedCategory('pos');
              }}
              className="group relative rounded-2xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:shadow-emerald-950/40 cursor-pointer border border-white/25"
            >
              <div className="h-48 md:h-52 w-full overflow-hidden relative bg-emerald-950/30">
                <img
                  src="/images/pos_3d.jpg"
                  alt="3D POS billing counter with 80mm thermal printer, barcode gun, and fertilizer sack in sunny pastoral meadow"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-black uppercase shadow-sm">
                  RETAIL CHECKOUT
                </div>
              </div>
              <div className="p-5 bg-white/95 backdrop-blur-md">
                <span className="font-mono text-[11px] text-[#5b875c] uppercase tracking-wider font-bold block mb-1">
                  Fast Counter POS [F1]
                </span>
                <h3 className="text-base font-bold text-emerald-950 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                  3-Second Rapid Billing &amp; 80mm ESC/POS
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                  Barcode gun integration, split Cash + UPI payments in one receipt, and direct thermal roll printer dispatch.
                </p>
              </div>
            </div>

            {/* Card 2: 3D Agri Doctor */}
            <div
              onClick={() => {
                const el = document.getElementById('agri-doctor-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative rounded-2xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:shadow-emerald-950/40 cursor-pointer border border-white/25"
            >
              <div className="h-48 md:h-52 w-full overflow-hidden relative bg-emerald-950/30">
                <img
                  src="/images/agri_doctor_3d.jpg"
                  alt="3D Agri Doctor laboratory setup with modern microscope and leaf telemetry rings in sunny oak meadow"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-sky-600 text-white font-mono text-[10px] font-black uppercase shadow-sm">
                  AI TELEMETRY
                </div>
              </div>
              <div className="p-5 bg-white/95 backdrop-blur-md">
                <span className="font-mono text-[11px] text-sky-700 uppercase tracking-wider font-bold block mb-1">
                  Crop Diagnostic Engine
                </span>
                <h3 className="text-base font-bold text-emerald-950 line-clamp-1 group-hover:text-sky-700 transition-colors">
                  Agri Doctor &amp; Chemical Formulations
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                  Instant pest/disease diagnosis, approved CIB&amp;RC chemical active molecules, and pump/acre spray dosage guidelines.
                </p>
              </div>
            </div>

            {/* Card 3: 3D Khata & Compliance */}
            <div
              onClick={() => {
                const el = document.getElementById('platform-features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                setSelectedCategory('khata');
              }}
              className="group relative rounded-2xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:shadow-emerald-950/40 cursor-pointer border border-white/25"
            >
              <div className="h-48 md:h-52 w-full overflow-hidden relative bg-emerald-950/30">
                <img
                  src="/images/compliance_3d.jpg"
                  alt="3D agricultural compliance emblem with Form O certificate, ledger book, rupee coin, and UPI smartphone in sunny meadow"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-amber-600 text-white font-mono text-[10px] font-black uppercase shadow-sm">
                  STATUTORY RECOVERY
                </div>
              </div>
              <div className="p-5 bg-white/95 backdrop-blur-md">
                <span className="font-mono text-[11px] text-amber-700 uppercase tracking-wider font-bold block mb-1">
                  Statutory &amp; Credit Ledger
                </span>
                <h3 className="text-base font-bold text-emerald-950 line-clamp-1 group-hover:text-amber-700 transition-colors">
                  Farmer Khata &amp; Form O Register
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                  Automated WhatsApp payment reminders with UPI QR codes, cashier shift handovers, and certified FCO Form O compliance registers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPANY MISSION & VISION SECTION ─────────────────────────────────── */}
      <section id="mission-vision" className="w-full py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 font-mono text-xs uppercase tracking-widest font-black mb-3 border border-emerald-200">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>Our Purpose &amp; Horizon</span>
            </div>
            <h2 className="font-['Grandstander'] text-3xl sm:text-4xl md:text-5xl text-emerald-950 font-black tracking-tight">
              Company Mission &amp; Vision
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
              NockBill is built on the ground with rural agro-dealers, cooperatives, and farming communities. Here is what drives every line of code we ship.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Mission Card */}
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Sprout className="w-48 h-48 text-emerald-300" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mb-6">
                  <Sprout className="w-6 h-6 text-emerald-300" />
                </div>
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-300 font-bold block mb-2">
                  OUR MISSION
                </span>
                <h3 className="font-['Grandstander'] text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  Modernize &amp; Protect India&apos;s Rural Agri-Retailers
                </h3>
                <p className="text-emerald-100/90 text-sm sm:text-base mt-4 leading-relaxed font-normal">
                  To empower, protect, and digitize India&apos;s 2.5+ lakh rural fertilizer, seed, and pesticide dealers with lightning-fast point-of-sale hardware integration, airtight statutory compliance (FCO 1985 &amp; Form O), and automated credit recovery that bridges mutual trust between farmers and merchants.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-emerald-800/80 grid grid-cols-2 gap-4 relative z-10">
                <div>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white block">2,50,000+</span>
                  <span className="text-xs text-emerald-300">Rural Retailers Targeted</span>
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white block">100% Compliant</span>
                  <span className="text-xs text-emerald-300">FCO 1985 &amp; Insecticides Act</span>
                </div>
              </div>
            </div>

            {/* Vision Card */}
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <ShieldCheck className="w-48 h-48 text-emerald-300" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6 text-sky-300" />
                </div>
                <span className="font-mono text-xs uppercase tracking-widest text-sky-300 font-bold block mb-2">
                  OUR VISION
                </span>
                <h3 className="font-['Grandstander'] text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  The Sovereign Digital Backbone of Rural Commerce
                </h3>
                <p className="text-slate-200 text-sm sm:text-base mt-4 leading-relaxed font-normal">
                  To build the sovereign digital infrastructure for rural agri-commerce—unifying agricultural input retailers, cooperative banks, distributors, and farming communities on an intelligent, transparent platform that safeguards food security from soil to store.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-2 gap-4 relative z-10">
                <div>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white block">₹1,000+ Cr</span>
                  <span className="text-xs text-sky-300">Annual Agri-Credit Tracked</span>
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white block">Zero-Conflict</span>
                  <span className="text-xs text-sky-300">Transparent Digital Ledger</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPLETE PLATFORM FEATURE SUITE SHOWCASE ─────────────────────────── */}
      <section id="platform-features" className="w-full py-20 px-4 sm:px-6 lg:px-8 bg-[#faf8ff] border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-mono text-xs uppercase tracking-widest font-black mb-3">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>End-To-End Agri ERP System</span>
              </div>
              <h2 className="font-['Grandstander'] text-3xl sm:text-4xl text-emerald-950 font-black tracking-tight">
                All Platform Features
              </h2>
              <p className="text-slate-600 text-sm md:text-base mt-2 max-w-2xl">
                Every tool needed to operate a modern agri-center: from counter billing and GST tax slabs to farmer credit recovery and cashier handovers.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Features ({PLATFORM_FEATURES.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('pos')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'pos'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                POS &amp; Sales
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('khata')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'khata'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Khata &amp; Compliance
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('inventory')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'inventory'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Inventory &amp; GST Slabs
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('marketing')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'marketing'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Marketing
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('management')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'management'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Shop Management
              </button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFeatures.map((feat) => (
              <div
                key={feat.id}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group hover:border-emerald-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${feat.badgeColor}`}>
                      {feat.badge}
                    </span>
                    {feat.gstRate && (
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        GST: {feat.gstRate}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-emerald-950 group-hover:text-emerald-700 transition-colors">
                    {feat.name}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {feat.shortDesc}
                  </p>
                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                    {feat.detail}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-emerald-800 font-bold">
                    Included in NockBill
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PUBLIC AGRI DOCTOR ADVISORY RECOMMENDATION ENGINE ───────────────── */}
      <section id="agri-doctor-section" className="w-full py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 text-sky-800 font-mono text-xs uppercase tracking-widest font-black mb-3 border border-sky-200">
              <Stethoscope className="w-4 h-4 text-sky-700" />
              <span>Public Agronomic Intelligence</span>
            </div>
            <h2 className="font-['Grandstander'] text-3xl sm:text-4xl md:text-5xl text-emerald-950 font-black tracking-tight">
              Free Agri Doctor Advisory Engine
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Any farmer, dealer, or guest can freely look up disease diagnoses, observed field symptoms, and government-approved chemical molecules with exact spray dosages. (No store login or stock required).
            </p>
          </div>

          {/* Interactive Diagnostic Filter Toolbar */}
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
                    placeholder="e.g. Bollworm, Blast, Curl..."
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

      {/* ─── TABBED PORTAL AUTHENTICATION HUB ─────────────────────────────────── */}
      <section id="portal-auth" className="w-full py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#faf8ff] via-[#f0f4ff] to-[#faf8ff] border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 font-mono text-xs uppercase tracking-widest font-bold mb-3 border border-emerald-200">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero-Friction Access Gateway</span>
            </div>
            <h2 className="font-['Grandstander'] text-3xl md:text-4xl text-emerald-950 font-black tracking-tight">
              NockBill Multi-Tenant Store Portal
            </h2>
            <p className="text-slate-600 max-w-2xl mt-2 text-sm md:text-base">
              Sign into your agro-center counter or register your dealership in under 2 minutes with complete FCO compliance verification.
            </p>
          </div>

          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-2 p-2 bg-slate-50 border-b border-slate-200 gap-2">
              <button
                type="button"
                id="portal-tab-login"
                onClick={() => setAuthTab('login')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Store className="w-4 h-4 text-emerald-700" />
                <span>Store &amp; Cashier Login</span>
              </button>
              <button
                type="button"
                id="portal-tab-register"
                onClick={() => setAuthTab('register')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <span>New Agri-Dealer Registration</span>
              </button>
            </div>

            <div className="p-6 md:p-10">
              {authTab === 'login' ? (
                <form onSubmit={handlePortalSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="portal-store-slug" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Store Identifier / Slug
                      </label>
                      <input
                        id="portal-store-slug"
                        type="text"
                        value={storeSlug}
                        onChange={(e) => setStoreSlug(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono text-slate-900 bg-slate-50"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">Your assigned cloud node subdomain.</span>
                    </div>

                    <div>
                      <label htmlFor="portal-role-select" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        IAM Role Selector
                      </label>
                      <select
                        id="portal-role-select"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm text-slate-900 bg-slate-50"
                      >
                        <option value="owner">Owner / Root Administrator</option>
                        <option value="manager">Store Manager (Pricing &amp; Batches)</option>
                        <option value="cashier">Counter Cashier (POS Locked)</option>
                        <option value="agronomist">Agri Doctor Specialist</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="portal-username" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Username or Cashier PIN
                      </label>
                      <input
                        id="portal-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono text-slate-900 bg-slate-50"
                      />
                    </div>

                    <div>
                      <label htmlFor="portal-password" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Security Password
                      </label>
                      <input
                        id="portal-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono text-slate-900 bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                      <span className="text-xs font-semibold text-emerald-950">Demo Node Credentials Ready:</span>
                      <span className="font-mono text-xs text-emerald-800 font-bold">green-valley-agro</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleFillDemo}
                      className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      1-Click Auto-Fill
                    </button>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
                      <input type="checkbox" defaultChecked className="rounded text-emerald-700 focus:ring-emerald-500" />
                      <span>Remember till on this terminal</span>
                    </label>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-8 py-3 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Launch Counter POS</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handlePortalSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-legal-name" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Agro Center Legal Name
                      </label>
                      <input
                        id="reg-legal-name"
                        type="text"
                        placeholder="e.g. Kaveri Agro Seeds &amp; Fertilisers"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm bg-slate-50"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-license-no" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Fertilizer / Pesticide Lic No.
                      </label>
                      <input
                        id="reg-license-no"
                        type="text"
                        placeholder="e.g. KA-MND-2026-F84"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm font-mono bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="reg-gstin" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        GSTIN Number
                      </label>
                      <input
                        id="reg-gstin"
                        type="text"
                        placeholder="29AABCU9603R1ZM"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm font-mono bg-slate-50"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-state" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        State &amp; District
                      </label>
                      <select
                        id="reg-state"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm bg-slate-50"
                      >
                        <option>Karnataka (Mandya)</option>
                        <option>Karnataka (Mysuru)</option>
                        <option>Maharashtra (Nashik)</option>
                        <option>Andhra Pradesh (Guntur)</option>
                        <option>Punjab (Ludhiana)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="reg-phone" className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1">
                        Owner Mobile (OTP)
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        placeholder="+91 98450 XXXXX"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-600 text-sm font-mono bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 leading-relaxed">
                      <strong>Statutory Guarantee:</strong> Automated registration triggers automatic Form O and Seed Certificate ledgers synced with local Directorate of Agriculture guidelines.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Register Agro Center (14-Day Free Pilot)</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
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
                The next-generation rural retail operating system and agricultural billing standard designed for resilient cooperatives and agri-input dealers across India.
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
