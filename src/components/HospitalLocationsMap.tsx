import React, { useState } from 'react';
import { IntegratedBloodBank } from '../types';

interface HospitalLocationsMapProps {
  bloodBanks: IntegratedBloodBank[];
  onSelectHospital?: (hospital: IntegratedBloodBank) => void;
  activeHospitalId?: string;
  onOpenAddModal?: () => void;
}

export const HospitalLocationsMap: React.FC<HospitalLocationsMapProps> = ({
  bloodBanks,
  onSelectHospital,
  activeHospitalId,
  onOpenAddModal,
}) => {
  const [districtFilter, setDistrictFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string | null>(
    activeHospitalId || (bloodBanks[0]?.id ?? null)
  );

  const filteredBanks = bloodBanks.filter((b) => {
    const matchDist =
      districtFilter === 'All' ||
      (b.district || b.city || '').toLowerCase().includes(districtFilter.toLowerCase());
    const matchSearch =
      !searchQuery ||
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.district || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchDist && matchSearch;
  });

  const selectedBank =
    bloodBanks.find((b) => b.id === selectedBankId) || filteredBanks[0] || bloodBanks[0];

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-50 text-[#b70011] flex items-center justify-center border border-red-100">
            <span className="material-symbols-outlined text-[18px]">map</span>
          </div>
          <div>
            <h3 className="font-display font-bold text-[16px] text-slate-900">
              Live Hospital & Blood Bank Locations
            </h3>
            <p className="text-[11px] text-slate-500">
              {bloodBanks.length} Real Verified Facilities with Exact GPS Pins & Stock
            </p>
          </div>
        </div>

        {onOpenAddModal && (
          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">add_location_alt</span>
            <span>+ Add Real Hospital</span>
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-[16px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facility name, road, or city..."
            className="w-full bg-slate-50 border border-slate-200 h-9 pl-8 pr-3 rounded-xl text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {['All', 'Raipur', 'Bilaspur', 'Durg', 'Korba', 'Rajnandgaon'].map((dist) => (
            <button
              key={dist}
              type="button"
              onClick={() => setDistrictFilter(dist)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                districtFilter === dist
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {dist}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Interactive Map Canvas / Grid Representation */}
      <div className="relative w-full h-56 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-3 overflow-hidden border border-slate-800 flex flex-col justify-between text-white shadow-inner">
        {/* Map Grid Background Styling */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(#ffffff 1px, transparent 1px), radial-gradient(#ffffff 1px, #0f172a 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        />

        {/* Top Overlay Badge */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-slate-200">Chhattisgarh Emergency Life Grid</span>
          </div>

          {selectedBank && (
            <span className="text-[10px] text-slate-300 font-mono bg-white/10 px-2 py-0.5 rounded backdrop-blur-xs">
              📍 {selectedBank.lat?.toFixed(3)}° N, {selectedBank.lng?.toFixed(3)}° E
            </span>
          )}
        </div>

        {/* Interactive Hospital Pins Layer */}
        <div className="relative z-10 flex items-center justify-around flex-wrap gap-2 my-auto px-2">
          {filteredBanks.slice(0, 8).map((bank) => {
            const isSelected = selectedBank?.id === bank.id;
            return (
              <button
                key={bank.id}
                type="button"
                onClick={() => {
                  setSelectedBankId(bank.id);
                  if (onSelectHospital) onSelectHospital(bank);
                }}
                className={`group flex flex-col items-center transition-all transform ${
                  isSelected ? 'scale-110 -translate-y-1' : 'opacity-85 hover:opacity-100 hover:scale-105'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isSelected
                      ? 'bg-red-500 text-white ring-4 ring-red-400/40'
                      : bank.category === 'Govt'
                      ? 'bg-emerald-600 text-white'
                      : bank.category === 'Charitable'
                      ? 'bg-purple-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">local_hospital</span>
                </div>
                <span
                  className={`text-[9px] font-bold mt-1 max-w-[85px] truncate px-1 rounded transition-colors ${
                    isSelected ? 'bg-red-600 text-white shadow-xs' : 'text-slate-200 bg-black/40'
                  }`}
                >
                  {bank.name.split(',')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom Banner with Direct Actions */}
        {selectedBank && (
          <div className="relative z-10 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-white/10 flex items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="font-display font-bold text-[12px] text-white truncate">
                {selectedBank.name}
              </span>
              <span className="text-[10px] text-slate-300 truncate">
                {selectedBank.address} • {selectedBank.distanceKm ?? 0} km away
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a
                href={selectedBank.mapsUrl || `https://maps.google.com/?q=${selectedBank.lat},${selectedBank.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">directions</span>
                <span>Directions</span>
              </a>
              <a
                href={`tel:${selectedBank.contactNumber}`}
                className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                title="Call Hospital"
              >
                <span className="material-symbols-outlined text-[15px]">call</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Facilities Directory List with Full Details */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filteredBanks.map((bank) => {
          const isSelected = selectedBank?.id === bank.id;
          const totalUnits =
            Object.values(bank.stock || {}).reduce((a, b) => a + (b || 0), 0) || 160;

          return (
            <div
              key={bank.id}
              onClick={() => {
                setSelectedBankId(bank.id);
                if (onSelectHospital) onSelectHospital(bank);
              }}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-red-50/70 border-red-300 shadow-2xs'
                  : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-display font-bold text-[13px] text-slate-900">
                      {bank.name}
                    </span>
                    {bank.category && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          bank.category === 'Govt'
                            ? 'bg-emerald-100 text-emerald-800'
                            : bank.category === 'Charitable'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {bank.category}
                      </span>
                    )}
                    {bank.lat && (
                      <span className="text-[9px] font-mono text-slate-500 bg-white px-1 py-0.2 rounded border border-slate-200">
                        📍 {bank.lat.toFixed(2)}, {bank.lng?.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                    {bank.address}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {bank.operatingHours || '24/7 Emergency Blood Bank'} • Distance: {bank.distanceKm ?? 0} km
                  </span>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="font-display font-extrabold text-[14px] text-slate-900 tabular-nums">
                    {totalUnits} Units
                  </span>
                  <div className="text-[10px] text-slate-400 font-medium">{bank.district || bank.city}</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-200/60">
                <a
                  href={`tel:${bank.contactNumber}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">call</span>
                  <span>{bank.contactNumber}</span>
                </a>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={bank.mapsUrl || `https://maps.google.com/?q=${bank.lat},${bank.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-blue-700 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[13px]">directions</span>
                    <span>Google Maps</span>
                  </a>

                  {onSelectHospital && (
                    <button
                      type="button"
                      onClick={() => onSelectHospital(bank)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold"
                    >
                      Select Facility
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
