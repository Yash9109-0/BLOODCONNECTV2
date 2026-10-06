import React, { useState } from 'react';
import { BloodGroup, IntegratedDonor } from '../types';

interface RegisterDonorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDonorRegistered: (donor: IntegratedDonor) => void;
}

export const RegisterDonorModal: React.FC<RegisterDonorModalProps> = ({
  isOpen,
  onClose,
  onDonorRegistered,
}) => {
  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [city, setCity] = useState('Raipur');
  const [locality, setLocality] = useState('Tatibandh (Near AIIMS)');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState(24);
  const [weight, setWeight] = useState(65);
  const [hemoglobin, setHemoglobin] = useState(13.8);
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
        setErrorMsg('Could not detect GPS location. Using default city coordinates.');
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMsg('Please enter donor full name and phone number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/supabase/donors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          bloodGroup,
          city,
          locality,
          phone: phone.trim(),
          email: email.trim(),
          age,
          weight,
          hemoglobin,
          lat,
          lng,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register donor');
      }

      onDonorRegistered(data.donor);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error registering donor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-[#b70011] flex items-center justify-center border border-red-100">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-[16px] text-slate-900">
                Register Real Voluntary Donor
              </h3>
              <p className="text-[11px] text-slate-500">Live voluntary donor registry with real GPS coordinates</p>
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
          {/* Full Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-slate-700">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Chandra Agrawal"
              className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          {/* Blood Group & Age */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">Blood Group *</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl font-bold text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                {(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as BloodGroup[]).map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">Age (18-65) *</label>
              <input
                type="number"
                min={18}
                max={65}
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">Mobile Phone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98261-XXXXX"
                className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">Weight (kg) *</label>
              <input
                type="number"
                min={45}
                max={150}
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 h-10 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          {/* City & Locality */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">City / District</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-slate-50 border border-slate-200 h-10 px-2 rounded-xl text-[12px] text-slate-900 focus:outline-none"
              >
                <option value="Raipur">Raipur</option>
                <option value="Bhilai">Bhilai</option>
                <option value="Durg">Durg</option>
                <option value="Bilaspur">Bilaspur</option>
                <option value="Korba">Korba</option>
                <option value="Rajnandgaon">Rajnandgaon</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-700">Locality / Sector</label>
              <input
                type="text"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="e.g. Shankar Nagar / Sector 6"
                className="bg-slate-50 border border-slate-200 h-10 px-2 rounded-xl text-[12px] text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* GPS Coordinates & Detection */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">📍 Real GPS Location</span>
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={isDetectingGps}
                className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {isDetectingGps ? 'hourglass_top' : 'my_location'}
                </span>
                <span>{isDetectingGps ? 'Detecting...' : 'Autofill via Device GPS'}</span>
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
            className="w-full py-3 bg-[#b70011] hover:bg-red-700 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 mt-1"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{isSubmitting ? 'Registering...' : 'Register as Verified Voluntary Donor'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
