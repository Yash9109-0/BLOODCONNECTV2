import React, { useState } from 'react';
import { IntegratedBloodBank } from '../types';

interface RegisterHospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHospitalRegistered: (hospital: IntegratedBloodBank) => void;
}

export const RegisterHospitalModal: React.FC<RegisterHospitalModalProps> = ({
  isOpen,
  onClose,
  onHospitalRegistered,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Govt' | 'Charitable' | 'Private'>('Govt');
  const [licenseNumber, setLicenseNumber] = useState('NACO-CG-');
  const [city, setCity] = useState('Raipur');
  const [district, setDistrict] = useState('Raipur');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('+91 771-');
  const [operatingHours, setOperatingHours] = useState('24/7 Emergency Blood Bank');
  const [lat, setLat] = useState(21.2570);
  const [lng, setLng] = useState(81.5794);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser');
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 10000) / 10000);
        setLng(Math.round(pos.coords.longitude * 10000) / 10000);
        setIsDetectingGps(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setIsDetectingGps(false);
        setErrorMsg('Could not detect GPS location. Defaulting to Raipur center.');
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !contactNumber.trim()) {
      setErrorMsg('Please enter facility name, full address, and hotline number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/supabase/blood-banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          licenseNumber: licenseNumber.trim(),
          city,
          district,
          address: address.trim(),
          contactNumber: contactNumber.trim(),
          operatingHours,
          lat,
          lng,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add hospital blood bank');
      }

      onHospitalRegistered(data.bloodBank);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error registering hospital');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <span className="material-symbols-outlined text-[18px]">local_hospital</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-[16px] text-slate-900">
                Add Real Hospital / Blood Bank
              </h3>
              <p className="text-[11px] text-slate-500">Connect a real medical center to the regional blood grid</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-red-600">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-slate-700">Hospital / Facility Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Suyash Superspeciality Hospital Blood Bank"
              className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Category & License */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none"
              >
                <option value="Govt">Govt / Medical College</option>
                <option value="Charitable">Charitable / Red Cross</option>
                <option value="Private">Private / Corporate</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">NACO License #</label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="e.g. NACO-CG-9021"
                className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* District & City */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">District</label>
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setCity(e.target.value);
                }}
                className="bg-slate-50 border border-slate-200 h-10 px-2 rounded-xl text-[12px] text-slate-900 focus:outline-none"
              >
                <option value="Raipur">Raipur</option>
                <option value="Durg">Durg</option>
                <option value="Bilaspur">Bilaspur</option>
                <option value="Korba">Korba</option>
                <option value="Rajnandgaon">Rajnandgaon</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">Emergency Hotline *</label>
              <input
                type="tel"
                required
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91 771-XXXXXXX"
                className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Full Physical Street Address */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-slate-700">Physical Address & Landmark *</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Kota Road, Gudhiyari, Raipur, Chhattisgarh 492009"
              className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none"
            />
          </div>

          {/* Operating Hours */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-slate-700">Operating Schedule</label>
            <input
              type="text"
              value={operatingHours}
              onChange={(e) => setOperatingHours(e.target.value)}
              placeholder="e.g. 24/7 Emergency Blood Bank"
              className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none"
            />
          </div>

          {/* GPS Coordinates */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">📍 Real GPS Coordinates</span>
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={isDetectingGps}
                className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {isDetectingGps ? 'hourglass_top' : 'my_location'}
                </span>
                <span>{isDetectingGps ? 'Detecting...' : 'Detect Coordinates'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
              <div className="bg-white p-1.5 rounded border border-slate-200">
                Lat: <span className="font-bold text-slate-900">{lat}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-slate-200">
                Lng: <span className="font-bold text-slate-900">{lng}</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 mt-1"
          >
            <span className="material-symbols-outlined text-[18px]">add_business</span>
            <span>{isSubmitting ? 'Adding...' : 'Connect Real Facility to Life Grid'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
