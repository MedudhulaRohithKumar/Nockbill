import React, { useState } from 'react';
import { 
  X, 
  Truck, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  FileText,
  ShieldCheck,
  Save
} from 'lucide-react';
import { ewayBillApi, getErrorMessage } from '../../api';
import { Sale } from '../../types';

interface EWayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onEWayBillSaved?: (updatedSale: Partial<Sale>) => void;
}

export const EWayBillModal: React.FC<EWayBillModalProps> = ({
  isOpen,
  onClose,
  sale,
  onEWayBillSaved,
}) => {
  const [vehicleNo, setVehicleNo] = useState<string>(sale.vehicle_no || '');
  const [transDistance, setTransDistance] = useState<number>(25);
  const [transMode, setTransMode] = useState<string>('1'); // 1 = Road
  const [transporterId, setTransporterId] = useState<string>('');
  const [transporterName, setTransporterName] = useState<string>('');
  const [ewayBillNoInput, setEwayBillNoInput] = useState<string>(sale.eway_bill_no || '');

  const [loading, setLoading] = useState<boolean>(false);
  const [savingNo, setSavingNo] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDownloadJson = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanVehicle = vehicleNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!cleanVehicle || cleanVehicle.length < 4) {
      setError('Please enter a valid vehicle registration number (e.g., TS16AB1234).');
      return;
    }

    try {
      setLoading(true);
      const res = await ewayBillApi.generateJson(sale.id, {
        vehicle_no: cleanVehicle,
        trans_distance_km: Number(transDistance) || 25,
        trans_mode: transMode,
        vehicle_type: 'R',
        transporter_id: transporterId || undefined,
        transporter_name: transporterName || undefined,
      });

      // Trigger automatic client-side JSON file download
      const jsonStr = JSON.stringify(res.eway_bill_data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.filename || `EWB_${sale.invoice_number.replace('/', '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloaded(true);
      setSuccessMsg(`NIC Standard E-Way Bill JSON downloaded successfully! Upload to ewaybillgst.gov.in.`);
      if (onEWayBillSaved) {
        onEWayBillSaved({ vehicle_no: cleanVehicle });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to generate E-Way Bill JSON.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEwayNumber = async () => {
    setError(null);
    setSuccessMsg(null);
    const cleanNo = ewayBillNoInput.replace(/\D/g, '');
    if (cleanNo.length < 12) {
      setError('E-Way Bill Number must contain at least 12 digits.');
      return;
    }

    try {
      setSavingNo(true);
      const res = await ewayBillApi.saveNumber(sale.id, cleanNo);
      setSuccessMsg(res.message);
      if (onEWayBillSaved) {
        onEWayBillSaved({
          eway_bill_no: res.eway_bill_no,
          eway_bill_date: res.eway_bill_date,
        });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save E-Way Bill Number.'));
    } finally {
      setSavingNo(false);
    }
  };

  const isMandatory = Number(sale.grand_total || 0) >= 50000;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
              <Truck className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Government GST E-Way Bill</h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full font-semibold">
                  NIC v1.0
                </span>
              </div>
              <p className="text-xs text-indigo-200/90">
                Generate 1-click JSON for ewaybillgst.gov.in portal upload
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close E-Way Bill modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 font-medium">Invoice:</span>
            <span className="font-bold text-slate-800 ml-1.5">{sale.invoice_number}</span>
            <div className="text-slate-500 mt-0.5">
              <span>Customer: </span>
              <span className="font-semibold text-slate-700">{sale.customer_name || 'Walk-in Farmer'}</span>
              <span className="ml-1 text-slate-400">({sale.customer_gstin || 'URP'})</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-medium block">Total Value</span>
            <span className="text-base font-extrabold text-slate-900">
              ₹{Number(sale.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {isMandatory && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">E-Way Bill Legally Mandatory</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Under Rule 138 of CGST Rules, an E-Way Bill is strictly mandatory for consignments of ₹50,000 or above before dispatch.
              </p>
            </div>
          </div>
        )}

        {/* Notifications */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleDownloadJson} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Vehicle Number */}
            <div>
              <label htmlFor="vehicle-no-input" className="block text-xs font-bold text-slate-700 mb-1">
                Vehicle Number <span className="text-rose-600">*</span>
              </label>
              <input
                id="vehicle-no-input"
                type="text"
                required
                placeholder="e.g. TS16AB1234"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Truck, tempo, tractor or pickup van</span>
            </div>

            {/* Transport Distance */}
            <div>
              <label htmlFor="trans-dist-input" className="block text-xs font-bold text-slate-700 mb-1">
                Approx Distance (KM) <span className="text-rose-600">*</span>
              </label>
              <input
                id="trans-dist-input"
                type="number"
                min={1}
                max={4000}
                required
                value={transDistance}
                onChange={(e) => setTransDistance(Number.parseInt(e.target.value) || 25)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Distance from shop to delivery village</span>
            </div>

            {/* Transport Mode */}
            <div>
              <label htmlFor="trans-mode-select" className="block text-xs font-bold text-slate-700 mb-1">
                Transport Mode
              </label>
              <select
                id="trans-mode-select"
                value={transMode}
                onChange={(e) => setTransMode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="1">1 - Road (Standard)</option>
                <option value="2">2 - Rail</option>
                <option value="3">3 - Air</option>
                <option value="4">4 - Ship</option>
              </select>
            </div>

            {/* Transporter ID */}
            <div>
              <label htmlFor="transporter-id-input" className="block text-xs font-bold text-slate-700 mb-1">
                Transporter ID / GSTIN <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="transporter-id-input"
                type="text"
                placeholder="Transporter 15-digit GSTIN"
                value={transporterId}
                onChange={(e) => setTransporterId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Action: Generate & Download JSON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              {loading ? 'Generating JSON...' : 'Download NIC E-Way Bill JSON File'}
            </button>
          </div>
        </form>

        {/* Step 2: Upload Instructions & Save Returned Number */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Step 2: Enter Portal 12-Digit EWB Number
            </span>
            <a
              href="https://ewaybillgst.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold inline-flex items-center gap-1"
            >
              <span>ewaybillgst.gov.in</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-[11px] text-slate-500">
            Upload the downloaded JSON at <b>e-Waybill &gt; Generate Bulk</b>. The portal will generate your 12-digit E-Way Bill number instantly:
          </p>

          <div className="flex items-center gap-2">
            <input
              id="eway-bill-no-input"
              type="text"
              maxLength={20}
              placeholder="e.g. 231004928172"
              value={ewayBillNoInput}
              onChange={(e) => setEwayBillNoInput(e.target.value.replace(/\D/g, ''))}
              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-mono tracking-wider focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={savingNo || ewayBillNoInput.length < 12}
              onClick={handleSaveEwayNumber}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              {savingNo ? 'Saving...' : 'Save to Bill'}
            </button>
          </div>

          {sale.eway_bill_no && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-100/70 p-2.5 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Attached E-Way Bill No: <b>{sale.eway_bill_no}</b> (Will print on invoice)</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
