import React, { useState } from 'react';
import { BloodGroup, IntegratedBloodBank } from '../types';
import { INTEGRATED_BLOOD_BANKS } from '../lib/supabase';

export interface BloodCompatibilityRule {
  canDonateTo: BloodGroup[];
  canReceiveFrom: BloodGroup[];
  title: string;
  description: string;
  antigens: string;
  antibodies: string;
  rarityInIndia: string;
}

export const BLOOD_COMPATIBILITY_DATA: Record<BloodGroup, BloodCompatibilityRule> = {
  'O-': {
    canDonateTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['O-'],
    title: 'Universal Red Cell Donor',
    description: 'Can donate red blood cells to patients of any blood group. Essential for emergency ICUs.',
    antigens: 'None',
    antibodies: 'Anti-A, Anti-B',
    rarityInIndia: '~2% of population',
  },
  'O+': {
    canDonateTo: ['O+', 'A+', 'B+', 'AB+'],
    canReceiveFrom: ['O+', 'O-'],
    title: 'Universal Positive Donor',
    description: 'Can donate to any Rh-positive patient (approx. 93% of the population in India).',
    antigens: 'Rh (D)',
    antibodies: 'Anti-A, Anti-B',
    rarityInIndia: '~38% of population (Most common)',
  },
  'A-': {
    canDonateTo: ['A-', 'A+', 'AB-', 'AB+'],
    canReceiveFrom: ['A-', 'O-'],
    title: 'Rh-Negative Subtype Donor',
    description: 'Can safely donate to any A or AB patient, regardless of their Rh factor.',
    antigens: 'A',
    antibodies: 'Anti-B',
    rarityInIndia: '~0.5% of population (Very rare)',
  },
  'A+': {
    canDonateTo: ['A+', 'AB+'],
    canReceiveFrom: ['A+', 'A-', 'O+', 'O-'],
    title: 'A-Positive Reserve',
    description: 'Can donate to A+ and AB+ recipients. Can receive blood from all A and O donors.',
    antigens: 'A, Rh (D)',
    antibodies: 'Anti-B',
    rarityInIndia: '~21% of population',
  },
  'B-': {
    canDonateTo: ['B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['B-', 'O-'],
    title: 'Rh-Negative B Subtype',
    description: 'Can donate to any B and AB patient. Can only receive from B- and O- donors.',
    antigens: 'B',
    antibodies: 'Anti-A',
    rarityInIndia: '~1% of population',
  },
  'B+': {
    canDonateTo: ['B+', 'AB+'],
    canReceiveFrom: ['B+', 'B-', 'O+', 'O-'],
    title: 'B-Positive Power Donor',
    description: 'High prevalence in South Asia. Can safely receive from all B and O types.',
    antigens: 'B, Rh (D)',
    antibodies: 'Anti-A',
    rarityInIndia: '~32% of population',
  },
  'AB-': {
    canDonateTo: ['AB-', 'AB+'],
    canReceiveFrom: ['AB-', 'A-', 'B-', 'O-'],
    title: 'Universal Plasma Donor',
    description: 'Rarest blood group in the country. Can receive red blood cells from any Rh-negative donor.',
    antigens: 'A, B',
    antibodies: 'None against ABO',
    rarityInIndia: '~0.4% of population (Extremely rare)',
  },
  'AB+': {
    canDonateTo: ['AB+'],
    canReceiveFrom: ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
    title: 'Universal Red Cell Recipient',
    description: 'Can safely receive red blood cells from all 8 blood groups in emergency situations.',
    antigens: 'A, B, Rh (D)',
    antibodies: 'None',
    rarityInIndia: '~5% of population',
  },
};

const ALL_BLOOD_GROUPS: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

interface BloodCompatibilityFinderProps {
  initialGroup?: BloodGroup;
  bloodBanks?: IntegratedBloodBank[];
  className?: string;
  onSelectHospital?: (hospital: IntegratedBloodBank) => void;
}

export const BloodCompatibilityFinder: React.FC<BloodCompatibilityFinderProps> = ({
  initialGroup = 'O+',
  bloodBanks = INTEGRATED_BLOOD_BANKS,
  className = '',
  onSelectHospital,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup>(initialGroup);
  const [showCompatibleHospitals, setShowCompatibleHospitals] = useState<boolean>(false);
  const [compatibilityDirection, setCompatibilityDirection] = useState<'receive' | 'donate'>('receive');
  const [cityFilter, setCityFilter] = useState<string>('All');

  const rule = BLOOD_COMPATIBILITY_DATA[selectedGroup];

  // Target compatible blood groups depending on whether user wants to receive or donate
  const targetGroups: BloodGroup[] =
    compatibilityDirection === 'receive' ? rule.canReceiveFrom : rule.canDonateTo;

  // Extract unique cities
  const availableCities = ['All', ...Array.from(new Set(bloodBanks.map((b) => b.city).filter(Boolean)))];

  // Calculate compatible stock per hospital
  const hospitalMatches = bloodBanks
    .map((bank) => {
      const stockMap = bank.stock || {};
      let totalCompatibleUnits = 0;
      const compatibleBreakdown: Array<{ group: BloodGroup; units: number }> = [];

      targetGroups.forEach((bg) => {
        const units = (stockMap as Record<string, number>)[bg] || 0;
        if (units > 0) {
          totalCompatibleUnits += units;
          compatibleBreakdown.push({ group: bg, units });
        }
      });

      return {
        bank,
        totalCompatibleUnits,
        compatibleBreakdown,
      };
    })
    .filter((item) => {
      const matchCity = cityFilter === 'All' || item.bank.city.toLowerCase() === cityFilter.toLowerCase();
      return matchCity && item.totalCompatibleUnits > 0;
    })
    .sort((a, b) => b.totalCompatibleUnits - a.totalCompatibleUnits);

  return (
    <section className={`bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-[#b70011] border border-red-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
          </div>
          <div>
            <h3 className="font-display font-bold text-[15px] text-[#0b1c30]">
              Blood Compatibility Matrix
            </h3>
            <p className="text-[11px] text-slate-500">
              Donor & Recipient Rules • Real-time Hospital Stock Matcher
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
          NBTC Protocol
        </span>
      </div>

      {/* Blood Group Picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
          <span>Select Blood Group</span>
          <span className="text-[#b70011] font-bold font-mono text-[13px]">{selectedGroup}</span>
        </label>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {ALL_BLOOD_GROUPS.map((group) => {
            const isSelected = selectedGroup === group;
            return (
              <button
                key={group}
                type="button"
                onClick={() => setSelectedGroup(group)}
                className={`h-11 rounded-xl text-xs font-extrabold flex flex-col items-center justify-center transition-all select-none border ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#b70011] to-red-700 text-white border-red-700 shadow-sm scale-[1.02] ring-2 ring-red-400/30'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="text-[13px] leading-none">{group}</span>
                {group === 'O-' && (
                  <span className={`text-[8px] mt-0.5 ${isSelected ? 'text-red-100' : 'text-red-600'}`}>Universal</span>
                )}
                {group === 'AB+' && (
                  <span className={`text-[8px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-emerald-700'}`}>Recipient</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clinical Type Summary */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900">{rule.title}</span>
          <span className="text-[10px] text-slate-500 font-mono">{rule.rarityInIndia}</span>
        </div>
        <p className="text-slate-600 leading-relaxed text-[11px]">{rule.description}</p>
      </div>

      {/* Two Compatibility Cards: Donate To vs Receive From */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Can Donate To Card */}
        <div className="bg-rose-50/50 rounded-xl p-3 border border-rose-200/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-red-900 font-bold text-xs">
              <span className="material-symbols-outlined text-[16px] text-red-600">arrow_upward</span>
              <span>Can Donate To</span>
            </div>
            <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
              {rule.canDonateTo.length} {rule.canDonateTo.length === 1 ? 'Group' : 'Groups'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {rule.canDonateTo.map((group) => (
              <span
                key={group}
                className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-[#b70011] font-mono font-bold text-xs shadow-2xs"
              >
                {group}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-auto pt-1">
            Safe red cell transfusion recipients without antibody hemagglutination.
          </p>
        </div>

        {/* Can Receive From Card */}
        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-200/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
              <span className="material-symbols-outlined text-[16px] text-emerald-700">arrow_downward</span>
              <span>Can Receive From</span>
            </div>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              {rule.canReceiveFrom.length} {rule.canReceiveFrom.length === 1 ? 'Group' : 'Groups'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {rule.canReceiveFrom.map((group) => (
              <span
                key={group}
                className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 font-mono font-bold text-xs shadow-2xs"
              >
                {group}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-auto pt-1">
            Compatible red cell donor blood types safe for this patient.
          </p>
        </div>
      </div>

      {/* Button: Find Hospitals Having Compatible Blood in Stock */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowCompatibleHospitals(!showCompatibleHospitals)}
          className="w-full py-3 bg-[#b70011] hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showCompatibleHospitals ? 'expand_less' : 'local_hospital'}
          </span>
          <span>
            {showCompatibleHospitals
              ? 'Hide Hospital Stock Results'
              : `Find Hospitals Having Compatible Blood for ${selectedGroup} in Stock`}
          </span>
        </button>

        {/* Compatible Hospital Stock Drawer / Results */}
        {showCompatibleHospitals && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
            {/* Direction Toggle & City Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCompatibilityDirection('receive')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                    compatibilityDirection === 'receive'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Compatible to Receive ({rule.canReceiveFrom.join(', ')})
                </button>
                <button
                  type="button"
                  onClick={() => setCompatibilityDirection('donate')}
                  className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                    compatibilityDirection === 'donate'
                      ? 'bg-[#b70011] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Compatible to Donate ({rule.canDonateTo.join(', ')})
                </button>
              </div>

              {availableCities.length > 2 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">City:</span>
                  {availableCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setCityFilter(city)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-colors ${
                        cityFilter === city
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results Counter */}
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] text-slate-600 font-semibold">
                Found <span className="font-bold text-slate-900">{hospitalMatches.length}</span> facilities with compatible stock
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Looking for: {targetGroups.join(', ')}
              </span>
            </div>

            {/* Hospital Cards List */}
            {hospitalMatches.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center flex flex-col items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-slate-300 text-[28px]">search_off</span>
                <span className="font-semibold text-slate-700">No compatible blood in stock currently</span>
                <span className="text-[11px] text-slate-400">
                  Try switching city filters or checking emergency broadcasts.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                {hospitalMatches.map(({ bank, totalCompatibleUnits, compatibleBreakdown }) => (
                  <div
                    key={bank.id}
                    className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col gap-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-display font-bold text-[13px] text-slate-900 truncate">
                            {bank.name}
                          </span>
                          {bank.verified && (
                            <span
                              className="material-symbols-outlined text-emerald-600 text-[14px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                              title="Verified Facility"
                            >
                              verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">location_on</span>
                          <span>{bank.city}</span>
                          {bank.category && <span>• {bank.category}</span>}
                          {bank.distanceKm && <span>• {bank.distanceKm} km away</span>}
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold font-mono">
                          {totalCompatibleUnits} Units
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Compatible Total</span>
                      </div>
                    </div>

                    {/* Breakdown of Compatible Units */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      <span className="text-[10px] text-slate-400 font-medium">In Stock:</span>
                      {compatibleBreakdown.map((item) => (
                        <span
                          key={item.group}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            item.group === selectedGroup
                              ? 'bg-red-50 text-[#b70011] border-red-200 ring-1 ring-red-400/30'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {item.group}: {item.units}U
                        </span>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        {bank.operatingHours || '24/7 Emergency Blood Bank'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {bank.contactNumber && (
                          <a
                            href={`tel:${bank.contactNumber}`}
                            className="px-2.5 py-1 bg-[#b70011] hover:bg-red-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[13px]">call</span>
                            <span>Call</span>
                          </a>
                        )}
                        {bank.mapsUrl && (
                          <a
                            href={bank.mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors border border-slate-200"
                          >
                            <span className="material-symbols-outlined text-[13px]">map</span>
                            <span>Map</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

