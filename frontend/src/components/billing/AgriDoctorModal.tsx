import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sprout, 
  Bug, 
  ShieldCheck, 
  Plus, 
  ExternalLink, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Droplets
} from 'lucide-react';
import { agriDoctorApi, getErrorMessage } from '../../api';
import { AgriDoctorCrop, AgriDoctorAdvisory, AgriDoctorMatchingProduct, Product } from '../../types';

interface AgriDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: Product, dosageNote?: string) => void;
  customerPhone?: string;
}

export const AgriDoctorModal: React.FC<AgriDoctorModalProps> = ({
  isOpen,
  onClose,
  onAddToCart,
  customerPhone,
}) => {
  const [crops, setCrops] = useState<AgriDoctorCrop[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<string>('Cotton');
  const [advisories, setAdvisories] = useState<AgriDoctorAdvisory[]>([]);
  const [selectedAdvisory, setSelectedAdvisory] = useState<AgriDoctorAdvisory | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addedProductId, setAddedProductId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCrops = async () => {
      try {
        setLoading(true);
        const data = await agriDoctorApi.getCrops();
        setCrops(data);
        if (data.length > 0 && !selectedCrop) {
          setSelectedCrop(data[0].crop_name);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Could not load crop catalog.'));
      } finally {
        setLoading(false);
      }
    };
    fetchCrops();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchAdvisories = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await agriDoctorApi.getAdvisories({
          crop: searchQuery ? undefined : selectedCrop,
          search: searchQuery || undefined,
        });
        setAdvisories(data);
        if (data.length > 0) {
          setSelectedAdvisory(data[0]);
        } else {
          setSelectedAdvisory(null);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to fetch advisories.'));
      } finally {
        setLoading(false);
      }
    };
    fetchAdvisories();
  }, [isOpen, selectedCrop, searchQuery]);

  if (!isOpen) return null;

  const handleAddToCart = (item: AgriDoctorMatchingProduct) => {
    if (!onAddToCart) return;
    // Map to Product shape expected by BillingPage
    const prod: Product = {
      id: item.id,
      name: item.product_name,
      product_name: item.product_name,
      trade_name: item.trade_name || '',
      company_name: item.company_name || '',
      category: item.category || 'Pesticide',
      unit: item.unit || 'Bottles',
      hsn_code: '3808',
      selling_price: item.selling_price,
      cost_price: 0,
      purchase_price: 0,
      mrp: item.mrp || item.selling_price,
      current_stock: item.current_stock,
      min_stock_level: 5,
      gst_rate: 18,
      batch_number: item.batch_number || '',
      expiry_date: item.expiry_date || '',
      is_active: true,
    };
    const note = selectedAdvisory 
      ? `Agri Doctor Advice: ${selectedAdvisory.dosage_per_pump} (${selectedAdvisory.technical_molecule})`
      : undefined;
    onAddToCart(prod, note);
    setAddedProductId(item.id);
    setTimeout(() => setAddedProductId(null), 2500);
  };

  const buildWhatsAppAdvisoryUrl = () => {
    if (!selectedAdvisory) return '#';
    const phone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
    const message = (
      `🌱 *Agri Doctor Crop Advisory*:\n` +
      `Crop: ${selectedAdvisory.crop_name}\n` +
      `Target Pest / Disease: ${selectedAdvisory.pest_disease}\n` +
      `Recommended Active Molecule: ${selectedAdvisory.technical_molecule}\n` +
      `💧 Dosage (Per 15L Pump): ${selectedAdvisory.dosage_per_pump}\n` +
      `🌾 Dosage (Per Acre): ${selectedAdvisory.dosage_per_acre}\n` +
      `⚠️ Application Advice: ${selectedAdvisory.advisory_notes}\n\n` +
      `Verified Agricultural Advisory.`
    );
    const cleanPhone = phone.length >= 10 ? `91${phone.slice(-10)}` : '';
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Sprout className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Agri Doctor Advisory</h2>
                <span className="text-xs bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-medium">
                  CIBRC Guidelines
                </span>
              </div>
              <p className="text-xs text-emerald-200/90">
                Identify crop diseases, approved molecules, pump dosage, and match shelf stock in 1 click
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close Agri Doctor modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Crop Pills */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="agri-doctor-search"
                type="text"
                placeholder="Search by pest, disease, crop or symptom (e.g., Pink bollworm, blast, thrips, curl)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              />
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>

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
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{c.crop_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                      {c.pest_count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Body Grid: Left = Pest list, Right = Selected advisory & shelf matches */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
          
          {/* Left Column: Pests & Diseases */}
          <div className="md:col-span-5 border-r border-slate-200 overflow-y-auto p-3 space-y-2 max-h-[500px]">
            {loading && advisories.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">Loading advisories...</div>
            ) : advisories.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-500 text-sm">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                No matching pests or diseases found for your search.
              </div>
            ) : (
              advisories.map((adv) => {
                const isSelected = selectedAdvisory?.pest_disease === adv.pest_disease && selectedAdvisory?.crop_name === adv.crop_name;
                const inStockCount = adv.matching_products.filter(p => p.in_stock).length;
                return (
                  <div
                    key={`${adv.crop_name}-${adv.pest_disease}`}
                    onClick={() => setSelectedAdvisory(adv)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Bug className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                          <h4 className="text-sm font-bold text-slate-900">{adv.pest_disease}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{adv.symptoms}</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        inStockCount > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {inStockCount > 0 ? `${inStockCount} in stock` : 'Out of stock'}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-emerald-900 bg-emerald-100/60 rounded px-2 py-1 font-mono font-medium truncate">
                      {adv.technical_molecule}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Detailed Advisory & Shelf Stock Recommender */}
          <div className="md:col-span-7 overflow-y-auto p-5 space-y-4 max-h-[500px] bg-slate-50/50">
            {selectedAdvisory ? (
              <>
                {/* Advisory Header Card */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 bg-brand-100 text-brand-800 rounded">
                          {selectedAdvisory.crop_name}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          {selectedAdvisory.category}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">
                        {selectedAdvisory.pest_disease}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {selectedAdvisory.symptoms}
                      </p>
                    </div>

                    <a
                      href={buildWhatsAppAdvisoryUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                      title="Share advisory on WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Share Advice
                    </a>
                  </div>

                  {/* Technical & Dosage Matrix */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Recommended Molecule
                      </span>
                      <span className="font-bold text-slate-800 block mt-0.5">
                        {selectedAdvisory.technical_molecule}
                      </span>
                    </div>

                    <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                        <Droplets className="w-3 h-3 text-emerald-600" />
                        Dosage (15L Pump)
                      </div>
                      <span className="font-bold text-emerald-900 block mt-0.5">
                        {selectedAdvisory.dosage_per_pump}
                      </span>
                    </div>
                  </div>

                  {/* Acre & Timing Notes */}
                  <div className="text-xs text-slate-600 space-y-1 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60">
                    <p><b>Field Dosage:</b> {selectedAdvisory.dosage_per_acre}</p>
                    <p><b>Symptoms:</b> {selectedAdvisory.symptoms}</p>
                    <p className="text-amber-900 pt-1 border-t border-amber-200/50">
                      <b>Expert Advice:</b> {selectedAdvisory.advisory_notes}
                    </p>
                  </div>
                </div>

                {/* In-Stock Matching Products Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Available on Your Shelves ({selectedAdvisory.matching_products.length} brands)
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500">Real-time inventory</span>
                  </div>

                  {selectedAdvisory.matching_products.length === 0 ? (
                    <div className="bg-white rounded-xl p-6 text-center border border-dashed border-slate-300">
                      <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-1 opacity-70" />
                      <p className="text-xs font-semibold text-slate-700">No matching brands in stock</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Order <b>{selectedAdvisory.technical_molecule}</b> from your distributor in Inward Purchases.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedAdvisory.matching_products.map((item) => {
                        const isAdded = addedProductId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`p-3 bg-white rounded-xl border flex items-center justify-between gap-3 transition-all ${
                              item.in_stock ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-60 bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-bold text-slate-900 truncate">
                                  {item.product_name}
                                </h5>
                                {item.company_name && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                    {item.company_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span className="font-semibold text-slate-900">₹{Number(item.selling_price).toFixed(2)}</span>
                                {item.mrp && item.mrp > item.selling_price && (
                                  <span className="line-through text-slate-400">₹{Number(item.mrp).toFixed(2)}</span>
                                )}
                                <span>•</span>
                                <span className={item.in_stock ? 'text-emerald-700 font-semibold' : 'text-rose-600'}>
                                  {item.in_stock ? `${item.current_stock} ${item.unit || 'units'} available` : 'Out of Stock'}
                                </span>
                                {item.batch_number && (
                                  <>
                                    <span>•</span>
                                    <span>Batch: {item.batch_number}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {onAddToCart && item.in_stock && (
                              <button
                                type="button"
                                onClick={() => handleAddToCart(item)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-all ${
                                  isAdded
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm'
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Added
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" />
                                    Add to Bill
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
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

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Accredited CIBRC Agronomic Active Ingredient Database</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
