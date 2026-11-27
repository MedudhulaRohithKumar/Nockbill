import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Sprout,
  Bug,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Send,
  Droplets,
  Sparkles,
  Stethoscope,
  BookOpen,
  Microscope,
} from 'lucide-react';
import { agriDoctorApi, getErrorMessage } from '../../api';
import {
  AgriDoctorCrop,
  AgriDoctorAdvisory,
  AgriDoctorMatchingProduct,
  AgriDoctorDiagnosisResponse,
  Product,
} from '../../types';
import { getCategoryConfig } from '../../config/inventoryCategories';

interface AgriDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: Product, dosageNote?: string) => void;
  customerPhone?: string;
  initialProblem?: string;
  initialCrop?: string;
}

const QUICK_SYMPTOM_EXAMPLES: Array<{ label: string; crop: string; symptom: string }> = [
  {
    label: 'Cotton Boll Holes',
    crop: 'Cotton',
    symptom: 'Cotton bolls have circular bore holes, flared squares, and caterpillars feeding inside.',
  },
  {
    label: 'Paddy Rusty Leaves',
    crop: 'Paddy (Rice)',
    symptom: 'Paddy lower leaves turning rusty brown with yellowing midrib 3 weeks after transplanting.',
  },
  {
    label: 'Chilli Upward Curl',
    crop: 'Chilli',
    symptom: 'Chilli leaves curling upward like a boat with silvery bronzing on young shoots.',
  },
  {
    label: 'Microgreens Tray Mold',
    crop: 'Microgreens',
    symptom: 'Microgreens seedlings have slimy water-soaked stem rot and cobweb mold at tray base.',
  },
];

function providerBadgeLabel(provider: string): string {
  const clean = (provider || '').toLowerCase();
  if (clean.includes('gemini')) return 'Gemini AI + Crop-Safety Shield';
  if (clean.includes('groq')) return 'Groq Llama + Crop-Safety Shield';
  return 'ICAR / CIB&RC Verified Engine';
}

function confidenceBadgeClasses(confidence: string): string {
  const lower = (confidence || '').toLowerCase();
  if (lower.startsWith('high')) {
    return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60';
  }
  if (lower.startsWith('medium')) {
    return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60';
  }
  return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700/60';
}

interface InventoryMatchCardProps {
  item: AgriDoctorMatchingProduct;
  isAdded: boolean;
  canAddToCart: boolean;
  onSelectProduct: (item: AgriDoctorMatchingProduct) => void;
}

const InventoryMatchCard: React.FC<InventoryMatchCardProps> = ({
  item,
  isAdded,
  canAddToCart,
  onSelectProduct,
}) => {
  const fallbackGst = getCategoryConfig(item.category || 'Pesticide').defaultGstRate;
  const resolvedGst =
    typeof item.gst_rate === 'number' && Number.isFinite(item.gst_rate) ? item.gst_rate : fallbackGst;

  return (
    <div
      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
        item.in_stock
          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xs'
          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-65'
      }`}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {item.product_name}
          </h5>
          {item.company_name && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium">
              {item.company_name}
            </span>
          )}
          {item.category && (
            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-1.5 py-0.5 rounded font-semibold">
              {item.category} ({resolvedGst}% GST)
            </span>
          )}
          {item.matched_molecule && (
            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60 px-1.5 py-0.5 rounded font-mono font-semibold">
              Active: {item.matched_molecule}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-900 dark:text-white font-mono">
            ₹{Number(item.selling_price).toFixed(2)}
          </span>
          {Boolean(item.mrp && item.mrp > item.selling_price) && (
            <span className="line-through text-slate-400 dark:text-slate-500 font-mono">
              ₹{Number(item.mrp).toFixed(2)}
            </span>
          )}
          <span>•</span>
          <span
            className={
              item.in_stock
                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                : 'text-rose-600 dark:text-rose-400 font-semibold'
            }
          >
            {item.in_stock ? `${item.current_stock} ${item.unit || 'units'} in stock` : 'Out of Stock'}
          </span>
          {item.batch_number && (
            <>
              <span>•</span>
              <span className="font-mono text-[11px]">Batch: {item.batch_number}</span>
            </>
          )}
          {item.expiry_date && (
            <>
              <span>•</span>
              <span className="font-mono text-[11px]">Exp: {item.expiry_date}</span>
            </>
          )}
        </div>
      </div>

      {canAddToCart && item.in_stock && (
        <button
          type="button"
          onClick={() => onSelectProduct(item)}
          className={`px-3.5 py-2 text-xs font-bold rounded-xl shrink-0 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            isAdded
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs'
          }`}
        >
          {isAdded ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Added to Bill</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Bill</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

interface DiagnosisResultPanelProps {
  diagnosis: AgriDoctorDiagnosisResponse;
  customerPhone?: string;
  addedProductId: number | null;
  canAddToCart: boolean;
  onAddProduct: (item: AgriDoctorMatchingProduct, dosageContext?: string) => void;
}

const DiagnosisResultPanel: React.FC<DiagnosisResultPanelProps> = ({
  diagnosis,
  customerPhone,
  addedProductId,
  canAddToCart,
  onAddProduct,
}) => {
  if (!diagnosis.is_agriculture_related) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-950/50 p-5 space-y-2"
      >
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Outside Agriculture &amp; Crop Advisory Scope</span>
        </div>
        <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200/90 leading-relaxed">
          {diagnosis.root_cause_explanation}
        </p>
      </div>
    );
  }

  const primaryMolecule = diagnosis.approved_molecules[0];
  const dosageContext = primaryMolecule
    ? `Agri Doctor (${diagnosis.likely_condition}): ${primaryMolecule.dosage_per_pump} — ${primaryMolecule.technical_molecule}`
    : undefined;

  const buildWhatsAppDiagnosisUrl = (): string => {
    const phone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
    const molLines =
      diagnosis.approved_molecules.length > 0
        ? diagnosis.approved_molecules
            .map(
              (m) =>
                `🧪 *Approved Molecule:* ${m.technical_molecule}\n💧 *15L Pump:* ${m.dosage_per_pump}\n🌾 *Per Acre:* ${m.dosage_per_acre}`
            )
            .join('\n\n')
        : '⚠️ Field inspection required before chemical spray.';

    const safetyLine =
      diagnosis.crop_safety_warnings[0] ||
      'Verify label crop approval and pre-harvest interval before spraying.';

    const message =
      `🌱 *NockBill Agri Doctor Clinical Prescription*\n` +
      `Crop: ${diagnosis.detected_crop}\n` +
      `Diagnosis: ${diagnosis.likely_condition}\n` +
      `🔬 *Root Cause:* ${diagnosis.root_cause_explanation}\n\n` +
      `${molLines}\n\n` +
      `🛡️ *Crop Safety:* ${safetyLine}`;

    const cleanPhone = phone.length >= 10 ? `91${phone.slice(-10)}` : '';
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div role="status" className="space-y-4">
      {/* 1. Diagnosis & Likely Root Cause */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
                Crop: {diagnosis.detected_crop}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/70 text-sky-900 dark:text-sky-300 border border-sky-300 dark:border-sky-700/60">
                {diagnosis.treatment_category}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${confidenceBadgeClasses(
                  diagnosis.confidence
                )}`}
              >
                Confidence: {diagnosis.confidence}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {providerBadgeLabel(diagnosis.provider)}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white pt-0.5">
              {diagnosis.likely_condition}
            </h3>
          </div>

          <a
            href={buildWhatsAppDiagnosisUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Share on WhatsApp</span>
          </a>
        </div>

        {/* Root Cause Callout */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            <Microscope className="w-4 h-4 shrink-0" />
            <span>Likely Agronomic Root Cause</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            {diagnosis.root_cause_explanation}
          </p>
        </div>

        {/* Field Verification Checklist */}
        {diagnosis.verification_checklist.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Confirm on Farmer&apos;s Leaf / Plant Before Dispensing:
            </span>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700 dark:text-slate-300">
              {diagnosis.verification_checklist.map((step, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 bg-slate-50/80 dark:bg-slate-800/40 rounded-lg px-2.5 py-1.5 border border-slate-200/70 dark:border-slate-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 2. Crop-Safety & Phytotoxicity Guardrail Banner */}
      {diagnosis.crop_safety_warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700/70 bg-amber-50/90 dark:bg-amber-950/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>Critical Crop-Safety &amp; Phytotoxicity Guardrails</span>
          </div>
          <ul className="space-y-1 text-xs text-amber-950 dark:text-amber-100/90 leading-relaxed">
            {diagnosis.crop_safety_warnings.map((warn, wIdx) => (
              <li key={wIdx} className="flex items-start gap-2">
                <span className="font-bold text-amber-700 dark:text-amber-400">•</span>
                <span>{warn}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Recommended CIB&RC Technical Molecule(s) */}
      <div className="space-y-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Recommended CIB&amp;RC Medicine &amp; Spray Dosage</span>
        </h4>

        {diagnosis.approved_molecules.length === 0 ? (
          <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-900 dark:text-rose-200">
            <b>Conservative Crop Protection Hold:</b> Symptoms are too broad to safely prescribe a synthetic chemical. Inspect leaf undersides and stem vascular tissue using the checklist above so the standing crop is never risked with the wrong molecule.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {diagnosis.approved_molecules.map((mol, mIdx) => (
              <div
                key={mIdx}
                className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-black text-emerald-950 dark:text-emerald-200 font-mono">
                    {mol.technical_molecule}
                  </span>
                  {mol.verified_brands.length > 0 && (
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">
                      Reference Brands: <b>{mol.verified_brands.slice(0, 4).join(', ')}</b>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-emerald-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                      15L Knapsack Pump
                    </span>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block mt-0.5">
                      {mol.dosage_per_pump}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-emerald-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                      Dosage Per Acre
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                      {mol.dosage_per_acre}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-emerald-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                      Spray &amp; PHI Guidance
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 block mt-0.5">
                      {mol.phi_and_application}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Verified Crop-Safe Products Available in Live Shop Inventory */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              Crop-Safe Stock Available in Your Shop ({diagnosis.matching_products.length})
            </span>
          </h4>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Herbicides, expired batches &amp; incompatible molecules automatically blocked
          </span>
        </div>

        {diagnosis.matching_products.length > 0 ? (
          <div className="space-y-2">
            {diagnosis.matching_products.map((item) => (
              <InventoryMatchCard
                key={item.id}
                item={item}
                isAdded={addedProductId === item.id}
                canAddToCart={canAddToCart}
                onSelectProduct={(prodItem) => onAddProduct(prodItem, dosageContext)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-amber-400 dark:border-amber-700 bg-white dark:bg-slate-900 p-5 text-center space-y-1.5">
            <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              No Verified Crop-Safe Stock Match on Shelf
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              {diagnosis.out_of_stock_notice ||
                'No unexpired in-stock product in your inventory matches the recommended active molecule. Do NOT substitute a random pesticide or herbicide — wrong chemical selection can destroy the entire crop.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const AgriDoctorModal: React.FC<AgriDoctorModalProps> = ({
  isOpen,
  onClose,
  onAddToCart,
  customerPhone,
  initialProblem,
  initialCrop,
}) => {
  const [activeTab, setActiveTab] = useState<'diagnose' | 'catalog'>('diagnose');
  const [crops, setCrops] = useState<AgriDoctorCrop[]>([]);

  // Tab 1: Clinical Problem Diagnosis & Safe Medicine Recommender
  const [diagnosisCrop, setDiagnosisCrop] = useState<string>(initialCrop || '');
  const [problemInput, setProblemInput] = useState<string>(initialProblem || '');
  const [diagnoseLoading, setDiagnoseLoading] = useState<boolean>(false);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<AgriDoctorDiagnosisResponse | null>(null);

  // Tab 2: Crop Reference Catalog
  const [selectedCrop, setSelectedCrop] = useState<string>('Cotton');
  const [advisories, setAdvisories] = useState<AgriDoctorAdvisory[]>([]);
  const [selectedAdvisory, setSelectedAdvisory] = useState<AgriDoctorAdvisory | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [addedProductId, setAddedProductId] = useState<number | null>(null);
  const dialogContainerRef = useRef<HTMLDivElement | null>(null);
  const diagnoseTabRef = useRef<HTMLButtonElement | null>(null);
  const catalogTabRef = useRef<HTMLButtonElement | null>(null);
  const lastCompositionEndRef = useRef<number | null>(null);

  const runDiagnosis = useCallback(
    async (overrideProblem?: string, overrideCrop?: string) => {
      const description = (overrideProblem ?? problemInput).trim();
      const targetCrop = overrideCrop !== undefined ? overrideCrop : diagnosisCrop;
      if (description.length < 4) {
        setDiagnoseError('Please describe the crop symptoms or problem (at least 4 characters).');
        return;
      }
      if (overrideProblem !== undefined) {
        setProblemInput(overrideProblem);
      }
      if (overrideCrop !== undefined) {
        setDiagnosisCrop(overrideCrop);
      }
      setDiagnoseError(null);
      setDiagnoseLoading(true);
      try {
        const res = await agriDoctorApi.diagnose({
          problem_description: description,
          crop_name: targetCrop || undefined,
        });
        setDiagnosisResult(res);
      } catch (err: unknown) {
        setDiagnoseError(getErrorMessage(err, 'Failed to analyze crop problem. Please try again.'));
      } finally {
        setDiagnoseLoading(false);
      }
    },
    [problemInput, diagnosisCrop]
  );

  // Focus overlay & Escape key dismissal when modal opens
  useEffect(() => {
    if (!isOpen) return;
    dialogContainerRef.current?.focus();
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-trigger diagnosis if opened from Dashboard with an initial symptom query
  useEffect(() => {
    if (!isOpen) return;
    if (initialProblem && initialProblem.trim().length >= 4) {
      setActiveTab('diagnose');
      void runDiagnosis(initialProblem, initialCrop ?? '');
    }
  }, [isOpen, initialProblem, initialCrop, runDiagnosis]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCrops = async () => {
      try {
        const data = await agriDoctorApi.getCrops();
        setCrops(data);
        if (data.length > 0 && !selectedCrop) {
          setSelectedCrop(data[0].crop_name);
        }
      } catch (err: unknown) {
        setCatalogError(getErrorMessage(err, 'Could not load crop catalog.'));
      }
    };
    void fetchCrops();
  }, [isOpen, selectedCrop]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'catalog') return;
    const fetchAdvisories = async () => {
      try {
        setCatalogLoading(true);
        setCatalogError(null);
        const data = await agriDoctorApi.getAdvisories({
          crop: searchQuery ? undefined : selectedCrop,
          search: searchQuery || undefined,
        });
        setAdvisories(data);
        setSelectedAdvisory(data.length > 0 ? data[0] : null);
      } catch (err: unknown) {
        setCatalogError(getErrorMessage(err, 'Failed to fetch advisories.'));
      } finally {
        setCatalogLoading(false);
      }
    };
    void fetchAdvisories();
  }, [isOpen, activeTab, selectedCrop, searchQuery]);

  if (!isOpen) return null;

  const handleAddToCart = (item: AgriDoctorMatchingProduct, customDosageNote?: string) => {
    if (!onAddToCart) return;
    const categoryName = item.category || 'Pesticide';
    const fallbackGst = getCategoryConfig(categoryName).defaultGstRate;
    const resolvedGst =
      typeof item.gst_rate === 'number' && Number.isFinite(item.gst_rate) ? item.gst_rate : fallbackGst;

    const prod: Product = {
      id: item.id,
      name: item.product_name,
      product_name: item.product_name,
      trade_name: item.trade_name || '',
      company_name: item.company_name || '',
      category: categoryName,
      unit: item.unit || 'Bottles',
      hsn_code: item.hsn_code || '',
      selling_price: item.selling_price,
      cost_price: 0,
      purchase_price: 0,
      mrp: item.mrp || item.selling_price,
      current_stock: item.current_stock,
      min_stock_level: 5,
      gst_rate: resolvedGst,
      batch_number: item.batch_number || '',
      expiry_date: item.expiry_date || '',
      is_active: true,
    };
    const note =
      customDosageNote ||
      (selectedAdvisory
        ? `Agri Doctor Advice: ${selectedAdvisory.dosage_per_pump} (${selectedAdvisory.technical_molecule})`
        : undefined);
    onAddToCart(prod, note);
    setAddedProductId(item.id);
    setTimeout(() => setAddedProductId(null), 2500);
  };

  const buildWhatsAppAdvisoryUrl = (): string => {
    if (!selectedAdvisory) return '#';
    const phone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
    const message =
      `🌱 *Agri Doctor Crop Advisory*:\n` +
      `Crop: ${selectedAdvisory.crop_name}\n` +
      `Target Pest / Disease: ${selectedAdvisory.pest_disease}\n` +
      `Recommended Active Molecule: ${selectedAdvisory.technical_molecule}\n` +
      `💧 Dosage (Per 15L Pump): ${selectedAdvisory.dosage_per_pump}\n` +
      `🌾 Dosage (Per Acre): ${selectedAdvisory.dosage_per_acre}\n` +
      `⚠️ Application Advice: ${selectedAdvisory.advisory_notes}\n\n` +
      `Verified Agricultural Advisory.`;
    const cleanPhone = phone.length >= 10 ? `91${phone.slice(-10)}` : '';
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = activeTab === 'diagnose' ? 'catalog' : 'diagnose';
      setActiveTab(next);
      if (next === 'diagnose') {
        diagnoseTabRef.current?.focus();
      } else {
        catalogTabRef.current?.focus();
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agri-doctor-modal-title"
      ref={dialogContainerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 focus:outline-none"
    >
      <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Sprout className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="agri-doctor-modal-title" className="text-lg sm:text-xl font-bold tracking-tight">
                  Agri Doctor Clinical Recommender
                </h2>
                <span className="text-[11px] bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 px-2.5 py-0.5 rounded-full font-semibold">
                  Crop-Safe Inventory Shield
                </span>
              </div>
              <p className="text-xs text-emerald-100/90">
                Diagnose root cause, prescribe ICAR/CIB&amp;RC molecules, and match verified safe stock in your shop
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Agri Doctor modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Agri Doctor Modes"
          onKeyDown={handleTabKeyDown}
          className="px-4 sm:px-6 pt-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto"
        >
          <button
            ref={diagnoseTabRef}
            id="agri-tab-diagnose"
            type="button"
            role="tab"
            aria-selected={activeTab === 'diagnose'}
            aria-controls="agri-panel-diagnose"
            tabIndex={activeTab === 'diagnose' ? 0 : -1}
            onClick={() => setActiveTab('diagnose')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'diagnose'
                ? 'border-emerald-600 text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-950'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>AI Problem Diagnosis &amp; Safe Medicine Recommender</span>
          </button>

          <button
            ref={catalogTabRef}
            id="agri-tab-catalog"
            type="button"
            role="tab"
            aria-selected={activeTab === 'catalog'}
            aria-controls="agri-panel-catalog"
            tabIndex={activeTab === 'catalog' ? 0 : -1}
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'catalog'
                ? 'border-emerald-600 text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-950'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Browse Crop Reference Catalog</span>
          </button>
        </div>

        {/* =====================================================================
            TAB 1: CLINICAL PROBLEM DIAGNOSIS & CROP-SAFE INVENTORY RECOMMENDER
        ===================================================================== */}
        {activeTab === 'diagnose' && (
          <div
            id="agri-panel-diagnose"
            role="tabpanel"
            aria-labelledby="agri-tab-diagnose"
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/60 dark:bg-slate-950"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runDiagnosis();
              }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4"
            >
              {/* Crop Selector Pills */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  1. Affected Crop (Optional — leave on Auto-Detect if mentioned in symptoms)
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <button
                    type="button"
                    aria-pressed={diagnosisCrop === ''}
                    onClick={() => setDiagnosisCrop('')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                      diagnosisCrop === ''
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Auto-Detect Crop
                  </button>
                  {crops.map((c) => {
                    const isSelected = diagnosisCrop.toLowerCase() === c.crop_name.toLowerCase();
                    return (
                      <button
                        key={c.crop_name}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setDiagnosisCrop(c.crop_name)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {c.crop_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Symptom Textarea */}
              <div>
                <label
                  htmlFor="agri-doctor-problem-input"
                  className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1"
                >
                  2. Describe Farmer&apos;s Crop Problem &amp; Field Symptoms
                </label>
                <p
                  id="agri-doctor-problem-hint"
                  className="text-[11px] text-slate-500 dark:text-slate-400 mb-2"
                >
                  Include leaf color/curling direction, spots, stem/boll damage, or visible insects. Press Enter to diagnose or Shift+Enter for a new line.
                </p>
                <textarea
                  id="agri-doctor-problem-input"
                  name="problem_description"
                  rows={3}
                  maxLength={800}
                  value={problemInput}
                  aria-describedby="agri-doctor-problem-hint"
                  aria-invalid={Boolean(diagnoseError)}
                  onChange={(e) => {
                    setProblemInput(e.target.value);
                    if (diagnoseError) setDiagnoseError(null);
                  }}
                  onCompositionEnd={(e) => {
                    lastCompositionEndRef.current = e.timeStamp;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (e.nativeEvent.isComposing) return;
                      if (
                        lastCompositionEndRef.current !== null &&
                        Math.abs(e.timeStamp - lastCompositionEndRef.current) < 50
                      ) {
                        return;
                      }
                      void runDiagnosis();
                    }
                  }}
                  placeholder="e.g., Farmer says cotton bolls have small round holes, flared squares, and pinkish larvae inside..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Sample Quick Chips + Submit Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                    Quick Examples:
                  </span>
                  {QUICK_SYMPTOM_EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => {
                        void runDiagnosis(ex.symptom, ex.crop);
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={diagnoseLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shrink-0"
                >
                  <Sparkles className={`w-4 h-4 ${diagnoseLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {diagnoseLoading ? 'Diagnosing & Checking Safety...' : 'Diagnose & Recommend Safe Stock'}
                  </span>
                </button>
              </div>

              {diagnoseError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{diagnoseError}</span>
                </div>
              )}
            </form>

            {diagnosisResult ? (
              <DiagnosisResultPanel
                diagnosis={diagnosisResult}
                customerPhone={customerPhone}
                addedProductId={addedProductId}
                canAddToCart={Boolean(onAddToCart)}
                onAddProduct={handleAddToCart}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 p-6 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Zero-Guesswork Crop Protection Engine
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                  Describe the farmer&apos;s crop symptoms above to view the likely root cause, field verification checklist, CIB&amp;RC approved active molecule with exact pump/acre dosages, and verified crop-safe bottles currently in your shop&apos;s live inventory.
                </p>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 2: BROWSE CROP REFERENCE CATALOG
        ===================================================================== */}
        {activeTab === 'catalog' && (
          <div
            id="agri-panel-catalog"
            role="tabpanel"
            aria-labelledby="agri-tab-catalog"
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Search Bar & Crop Pills */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
              <search>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <label htmlFor="agri-doctor-search" className="sr-only">
                      Search crop pests, diseases, or molecules
                    </label>
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="agri-doctor-search"
                      name="catalog_search"
                      type="search"
                      placeholder="Search by pest, disease, crop or symptom (e.g., Pink bollworm, blast, thrips, zinc)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
                    />
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </search>

              {!searchQuery && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {crops.map((c) => {
                    const isSelected = selectedCrop.toLowerCase() === c.crop_name.toLowerCase();
                    return (
                      <button
                        key={c.crop_name}
                        type="button"
                        onClick={() => {
                          setSelectedCrop(c.crop_name);
                          setSearchQuery('');
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>{c.crop_name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {c.pest_count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {catalogError && (
              <div
                role="alert"
                className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200"
              >
                {catalogError}
              </div>
            )}

            {/* Body Grid: Left = Pest list, Right = Selected advisory & shelf matches */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[360px]">
              {/* Left Column: Pests & Diseases */}
              <div className="md:col-span-5 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-3 space-y-2 max-h-[460px] bg-white dark:bg-slate-950">
                {catalogLoading && advisories.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">Loading advisories...</div>
                ) : advisories.length === 0 ? (
                  <div className="text-center py-12 px-4 text-slate-500 dark:text-slate-400 text-sm">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-70" />
                    No matching pests or diseases found for your search.
                  </div>
                ) : (
                  advisories.map((adv) => {
                    const isSelected =
                      selectedAdvisory?.pest_disease === adv.pest_disease &&
                      selectedAdvisory?.crop_name === adv.crop_name;
                    const inStockCount = adv.matching_products.filter((p) => p.in_stock).length;
                    return (
                      <button
                        key={`${adv.crop_name}-${adv.pest_disease}`}
                        type="button"
                        onClick={() => setSelectedAdvisory(adv)}
                        className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-500'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Bug
                                className={`w-4 h-4 shrink-0 ${
                                  isSelected
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              />
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {adv.pest_disease}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {adv.symptoms}
                            </p>
                          </div>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              inStockCount > 0
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {inStockCount > 0 ? `${inStockCount} safe stock` : 'Out of stock'}
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-emerald-900 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/50 rounded px-2 py-1 font-mono font-medium truncate">
                          {adv.technical_molecule}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Right Column: Detailed Advisory & Shelf Stock Recommender */}
              <div className="md:col-span-7 overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[460px] bg-slate-50/50 dark:bg-slate-900/40">
                {selectedAdvisory ? (
                  <>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 rounded">
                              {selectedAdvisory.crop_name}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 rounded">
                              {selectedAdvisory.category}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                            {selectedAdvisory.pest_disease}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            {selectedAdvisory.symptoms}
                          </p>
                        </div>

                        <a
                          href={buildWhatsAppAdvisoryUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Share Advice</span>
                        </a>
                      </div>

                      {selectedAdvisory.root_cause && (
                        <div className="text-xs bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                          <b>Root Cause:</b> {selectedAdvisory.root_cause}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                            Recommended Molecule
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                            {selectedAdvisory.technical_molecule}
                          </span>
                        </div>

                        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/70">
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            <Droplets className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Dosage (15L Pump)</span>
                          </div>
                          <span className="font-bold text-emerald-950 dark:text-emerald-200 block mt-0.5">
                            {selectedAdvisory.dosage_per_pump}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200/70 dark:border-amber-800/60">
                        <p>
                          <b>Field Dosage (Per Acre):</b> {selectedAdvisory.dosage_per_acre}
                        </p>
                        <p>
                          <b>Application Advice:</b> {selectedAdvisory.advisory_notes}
                        </p>
                        {selectedAdvisory.crop_safety_warning && (
                          <p className="text-amber-900 dark:text-amber-200 pt-1 border-t border-amber-200/60 dark:border-amber-800/60">
                            <b>Crop Safety Warning:</b> {selectedAdvisory.crop_safety_warning}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* In-Stock Matching Products Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Verified Crop-Safe Shelf Stock ({selectedAdvisory.matching_products.length})
                          </h4>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Real-time FEFO inventory</span>
                      </div>

                      {selectedAdvisory.matching_products.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 text-center border border-dashed border-slate-300 dark:border-slate-700">
                          <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-1 opacity-80" />
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            No verified crop-safe brands in stock
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Order <b>{selectedAdvisory.technical_molecule}</b> from your distributor — do not substitute unverified molecules.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedAdvisory.matching_products.map((item) => (
                            <InventoryMatchCard
                              key={item.id}
                              item={item}
                              isAdded={addedProductId === item.id}
                              canAddToCart={Boolean(onAddToCart)}
                              onSelectProduct={(prodItem) => handleAddToCart(prodItem)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-slate-400 text-sm">
                    Select a pest or disease from the left to view advisory and shelf stock.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>ICAR &amp; CIB&amp;RC Crop-Safety Guardrail Active — Non-selective herbicides &amp; expired batches quarantined</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
