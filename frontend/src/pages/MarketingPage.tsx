import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  MapPin, 
  Phone, 
  Filter, 
  Calendar, 
  MessageSquare, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Save,
  Check
} from 'lucide-react';
import { campaignsApi, getErrorMessage } from '../api';
import { useShop } from '../context/ShopContext';
import { FarmerSegmentItem, CampaignTemplate, MarketingCampaign } from '../types';

export const MarketingPage: React.FC = () => {
  const { settings } = useShop();

  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('KHARIF_SEED_ARRIVAL');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [targetCrop, setTargetCrop] = useState<string>('Cotton');

  // Filters
  const [season, setSeason] = useState<string>('ALL');
  const [category, setCategory] = useState<string>('All');
  const [selectedVillage, setSelectedVillage] = useState<string>('');
  const [khataFilter, setKhataFilter] = useState<string>('ALL');
  const [searchName, setSearchName] = useState<string>('');

  // Data
  const [farmers, setFarmers] = useState<FarmerSegmentItem[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [totalFarmersCount, setTotalFarmersCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sent tracking
  const [sentPhoneSet, setSentPhoneSet] = useState<Set<string>>(new Set());
  const [savedCampaigns, setSavedCampaigns] = useState<MarketingCampaign[]>([]);
  const [isSavingCampaign, setIsSavingCampaign] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // 1. Fetch Templates & Past Campaigns
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [tplList, campList] = await Promise.all([
          campaignsApi.getTemplates(),
          campaignsApi.list(),
        ]);
        setTemplates(tplList);
        setSavedCampaigns(campList);
        if (tplList.length > 0) {
          setSelectedTemplateId(tplList[0].id);
          setCustomMessage(tplList[0].template);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to load campaign data.'));
      }
    };
    fetchInitial();
  }, []);

  // 2. Fetch Farmer Segments on filter change
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await campaignsApi.getSegments({
          season: season === 'ALL' ? undefined : season,
          category: category === 'All' ? undefined : category,
          village: selectedVillage || undefined,
          khata_filter: khataFilter,
        });
        setFarmers(res.farmers);
        setVillages(res.villages);
        setTotalFarmersCount(res.total_farmers);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to fetch customer segments.'));
      } finally {
        setLoading(false);
      }
    };
    fetchSegments();
  }, [season, category, selectedVillage, khataFilter]);

  // Handle template selection
  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const found = templates.find(t => t.id === tplId);
    if (found) {
      setCustomMessage(found.template);
    }
  };

  // Compile personalized message for a farmer
  const compileMessage = (farmer: FarmerSegmentItem): string => {
    let msg = customMessage || '';
    msg = msg.replace(/{farmer_name}/g, farmer.customer_name || 'Kisan Bhai');
    msg = msg.replace(/{shop_name}/g, settings.shop_name || 'Kisan Seva Kendra');
    msg = msg.replace(/{shop_phone}/g, settings.phone || '');
    msg = msg.replace(/{shop_address}/g, settings.address_line1 || settings.city || 'Mandi Road');
    msg = msg.replace(/{crop}/g, targetCrop || 'Fasal');
    msg = msg.replace(/{village}/g, farmer.village || farmer.customer_address || 'Apka Kshetra');
    msg = msg.replace(/{pending_balance}/g, Number(farmer.pending_khata_balance || 0).toFixed(2));
    return msg;
  };

  // Build WhatsApp URL
  const buildWhatsAppUrl = (farmer: FarmerSegmentItem): string => {
    const rawDigits = farmer.customer_phone.replace(/\D/g, '');
    const cleanPhone = rawDigits.length >= 10 ? `91${rawDigits.slice(-10)}` : rawDigits;
    const text = compileMessage(farmer);
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const handleDispatchClick = (farmer: FarmerSegmentItem) => {
    setSentPhoneSet(prev => new Set([...prev, farmer.customer_phone]));
  };

  // Save campaign to history
  const handleSaveCampaignRecord = async () => {
    try {
      setIsSavingCampaign(true);
      setSaveSuccessMsg(null);
      const res = await campaignsApi.create({
        campaign_name: `${season} Season - ${targetCrop} Broadcast`,
        season: season === 'ALL' ? 'KHARIF' : season,
        target_crop: targetCrop,
        target_village: selectedVillage || undefined,
        template_text: customMessage,
        recipients_count: filteredFarmers.length,
      });
      setSavedCampaigns(prev => [res, ...prev]);
      setSaveSuccessMsg('Campaign record saved to history successfully!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save campaign record.'));
    } finally {
      setIsSavingCampaign(false);
    }
  };

  // Client-side search filter by farmer name or phone
  const filteredFarmers = useMemo(() => {
    if (!searchName.trim()) return farmers;
    const q = searchName.toLowerCase().trim();
    return farmers.filter(f => 
      f.customer_name.toLowerCase().includes(q) || 
      f.customer_phone.includes(q) ||
      (f.village && f.village.toLowerCase().includes(q))
    );
  }, [farmers, searchName]);

  const sentCount = useMemo(() => {
    return filteredFarmers.filter(f => sentPhoneSet.has(f.customer_phone)).length;
  }, [filteredFarmers, sentPhoneSet]);

  const samplePreviewMessage = useMemo(() => {
    const sampleFarmer: FarmerSegmentItem = filteredFarmers[0] || {
      customer_name: 'Ramesh Patel',
      customer_phone: '9876543210',
      village: 'Rampur',
      total_bills: 4,
      total_spend: 34500,
      preferred_categories: ['Seeds', 'Fertilizer'],
      pending_khata_balance: 1500,
    };
    return compileMessage(sampleFarmer);
  }, [filteredFarmers, customMessage, targetCrop, settings]);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <span>Seasonal WhatsApp Broadcast Marketing</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Anti-Ban Compliant
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Segment registered farmers by crop affinity or village, choose preloaded seasonal templates, and dispatch personalized WhatsApp alerts in 1 click.
          </p>
        </div>

        {/* Top KPI Cards */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total In Store</span>
            <span className="text-base font-black text-slate-800">{totalFarmersCount}</span>
          </div>
          <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Target Audience</span>
            <span className="text-base font-black text-emerald-900">{filteredFarmers.length}</span>
          </div>
          <div className="px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-blue-700 block">Dispatched</span>
            <span className="text-base font-black text-blue-900">{sentCount}</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* 2-Column Grid: Left = Filters & Templates; Right = Live Preview & Dispatch Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: 5 Columns on Large screens */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Step 1: Farmer Segmentation Filters */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Filter className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900">Step 1: Segment Target Farmers</h2>
            </div>

            <div className="space-y-3">
              {/* Season Selection */}
              <div>
                <label htmlFor="filter-season" className="block text-xs font-semibold text-slate-700 mb-1">
                  Season
                </label>
                <select
                  id="filter-season"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">All Seasons</option>
                  <option value="KHARIF">Kharif (Cotton, Paddy, Soybean, Maize)</option>
                  <option value="RABI">Rabi (Wheat, Gram, Mustard, Onion)</option>
                  <option value="ZAID">Zaid / Summer (Vegetables, Maize, Watermelon)</option>
                </select>
              </div>

              {/* Product Category Affinity */}
              <div>
                <label htmlFor="filter-category" className="block text-xs font-semibold text-slate-700 mb-1">
                  Crop Input Category
                </label>
                <select
                  id="filter-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All Categories</option>
                  <option value="Seeds">Seed Buyers (Certified Hybrid)</option>
                  <option value="Pesticide">Pesticide & Fungicide Buyers</option>
                  <option value="Fertilizer">Fertilizer Buyers (DAP, NPK, Urea)</option>
                  <option value="Micronutrients">Micronutrient & Bio-stimulants</option>
                </select>
              </div>

              {/* Village Filter */}
              <div>
                <label htmlFor="filter-village" className="block text-xs font-semibold text-slate-700 mb-1">
                  Village / Locality ({villages.length} discovered)
                </label>
                <select
                  id="filter-village"
                  value={selectedVillage}
                  onChange={(e) => setSelectedVillage(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Villages & Towns</option>
                  {villages.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Khata Credit Filter */}
              <div>
                <label htmlFor="filter-khata" className="block text-xs font-semibold text-slate-700 mb-1">
                  Khata (Udhar) Status
                </label>
                <select
                  id="filter-khata"
                  value={khataFilter}
                  onChange={(e) => setKhataFilter(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">All Farmers (Cash + Credit)</option>
                  <option value="ZERO_DUE">Zero Dues Only (VIP Pre-booking)</option>
                  <option value="WITH_UDHAR">Has Pending Udhar Dues</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 2: Choose / Customize Template */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900">Step 2: Message Template</h2>
            </div>

            <div className="space-y-3">
              {/* Template Select */}
              <div>
                <label htmlFor="select-template" className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Preloaded Campaign
                </label>
                <select
                  id="select-template"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              {/* Target Crop Variable */}
              <div>
                <label htmlFor="target-crop-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Crop Name
                </label>
                <input
                  id="target-crop-input"
                  type="text"
                  value={targetCrop}
                  onChange={(e) => setTargetCrop(e.target.value)}
                  placeholder="e.g. Cotton (कपास), Paddy, Wheat, Chilli"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Message Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="message-editor" className="text-xs font-semibold text-slate-700">
                    Personalized Message Text
                  </label>
                  <span className="text-[10px] text-slate-400">Merge tags auto-replace per farmer</span>
                </div>
                <textarea
                  id="message-editor"
                  rows={4}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
                />
                
                {/* Variable Pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['{farmer_name}', '{shop_name}', '{crop}', '{village}', '{shop_phone}', '{pending_balance}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setCustomMessage(prev => `${prev} ${tag}`)}
                      className="text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded border border-slate-300 transition-colors"
                      title={`Insert ${tag}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Campaign Record Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSavingCampaign || filteredFarmers.length === 0}
                  onClick={handleSaveCampaignRecord}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingCampaign ? 'Saving Record...' : 'Save Campaign to History'}
                </button>
              </div>
            </div>
          </div>

          {/* Past Campaigns Log */}
          {savedCampaigns.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Past Campaigns History
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {savedCampaigns.slice(0, 5).map(c => (
                  <div key={c.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{c.campaign_name}</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {c.target_village ? ` • Village: ${c.target_village}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      {c.total_recipients} farmers
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: 7 Columns on Large screens (Preview & Dispatch Deck) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Live Mobile WhatsApp Preview Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-sm font-bold text-slate-900">Live WhatsApp Chat Preview</h3>
              </div>
              <span className="text-xs text-slate-400">Sample recipient: {filteredFarmers[0]?.customer_name || 'Ramesh Patel'}</span>
            </div>

            {/* WhatsApp Green Bubble Simulator */}
            <div className="p-4 bg-[#EFEAE2] rounded-xl border border-slate-300 max-w-md mx-auto shadow-inner">
              <div className="bg-white rounded-lg p-3.5 shadow-sm text-xs leading-relaxed text-slate-900 relative">
                <p className="whitespace-pre-wrap font-sans">{samplePreviewMessage}</p>
                <div className="text-[10px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1">
                  <span>10:30 AM</span>
                  <Check className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Dispatch Deck */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Anti-Ban Dispatch Queue</span>
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    {filteredFarmers.length} Farmers
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Clicking "Send" opens WhatsApp with the personalized text pre-filled. No spam bot risk.
                </p>
              </div>

              {/* Search Farmer in Queue */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  id="search-farmer-input"
                  type="text"
                  placeholder="Search name or village..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Progress: {sentCount} sent of {filteredFarmers.length}</span>
                <span>{filteredFarmers.length > 0 ? Math.round((sentCount / filteredFarmers.length) * 100) : 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${filteredFarmers.length > 0 ? (sentCount / filteredFarmers.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Farmer Queue List */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                Segmenting store customers...
              </div>
            ) : filteredFarmers.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                No farmers match the selected season, category, or village filters.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredFarmers.map((f, idx) => {
                  const isSent = sentPhoneSet.has(f.customer_phone);
                  const waUrl = buildWhatsAppUrl(f);

                  return (
                    <div
                      key={f.customer_phone}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isSent
                          ? 'bg-emerald-50/50 border-emerald-200 opacity-80'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                          <h4 className="text-sm font-bold text-slate-900 truncate">{f.customer_name}</h4>
                          {isSent && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Sent
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                          <span className="font-mono text-slate-600">📱 {f.customer_phone}</span>
                          {f.village && <span>📍 {f.village}</span>}
                          <span>•</span>
                          <span>Spend: ₹{Number(f.total_spend).toLocaleString('en-IN')}</span>
                          {f.pending_khata_balance > 0 && (
                            <span className="text-rose-700 font-semibold bg-rose-50 px-1.5 py-0.2 rounded">
                              Udhar: ₹{Number(f.pending_khata_balance).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Send Button */}
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleDispatchClick(f)}
                        className={`px-3.5 py-2 text-xs font-bold rounded-xl shrink-0 flex items-center gap-1.5 transition-all shadow-sm ${
                          isSent
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSent ? 'Resend' : 'Send via WhatsApp'}</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
