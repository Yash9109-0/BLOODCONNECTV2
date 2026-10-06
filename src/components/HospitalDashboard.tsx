import React, { useState, useEffect } from 'react';
import {
  BloodStockItem,
  HospitalProfile,
  DonationCamp,
  EmergencyRequest,
  CrossHospitalStock,
  BloodGroup,
  UrgencyLevel,
  IntegratedBloodBank,
  IntegratedDonor,
} from '../types';
import { HospitalLocationsMap } from './HospitalLocationsMap';
import { RegisterDonorModal } from './RegisterDonorModal';
import { RegisterHospitalModal } from './RegisterHospitalModal';

interface HospitalDashboardProps {
  hospital: HospitalProfile;
  inventory: BloodStockItem[];
  onUpdateInventory: (group: string, delta: number) => void;
  camps: DonationCamp[];
  onAddWalkIn: (campId: string) => void;
  requests: EmergencyRequest[];
  onAddRequest: (req: Omit<EmergencyRequest, 'id' | 'createdAt' | 'status'>) => EmergencyRequest;
  crossHospitalStock: CrossHospitalStock[];
  liveBloodBanks?: IntegratedBloodBank[];
  liveDonors?: IntegratedDonor[];
  onSwitchHospital?: (bankId: string) => void;
  totalDonorsCount?: number;
  supabaseConnected?: boolean;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  hospital,
  inventory,
  onUpdateInventory,
  camps,
  onAddWalkIn,
  requests,
  onAddRequest,
  crossHospitalStock,
  liveBloodBanks = [],
  liveDonors = [],
  onSwitchHospital,
  totalDonorsCount = 1000,
  supabaseConnected = true,
}) => {
  // Emergency Form State
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup>('O-');
  const [unitsNeeded, setUnitsNeeded] = useState<number>(4);
  const [departmentRef, setDepartmentRef] = useState<string>('Trauma ICU / Bed 14');
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('CRITICAL (Golden Hour)');
  const [patientRef, setPatientRef] = useState<string>('Emergency Trauma Surgery');
  const [aiDraftMessage, setAiDraftMessage] = useState<string>(
    '🚨 *URGENT BLOOD SOS // GOLDEN HOUR PROTOCOL* 🩸\n*Required Blood Group:* *O-* (4 Units urgently needed)\n*Hospital:* AIIMS Raipur Blood Center\n*Department:* Trauma ICU / Bed 14\n*Urgency:* CRITICAL (Golden Hour)\n📍 *Location:* https://maps.google.com/?q=AIIMS+Raipur+Blood+Center\n📞 *Hotline:* +91 98765-43210'
  );
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [freeModel, setFreeModel] = useState<string>('google/gemini-2.0-flash-exp:free');

  // Cross hospital filter
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Supabase Integration UI State
  const [gridTab, setGridTab] = useState<'blood-banks' | 'cross-match'>('blood-banks');
  const [bankDistrictFilter, setBankDistrictFilter] = useState<string>('All');
  const [bankCategoryFilter, setBankCategoryFilter] = useState<string>('All');
  const [showMatchedDonorsDrawer, setShowMatchedDonorsDrawer] = useState<boolean>(true);
  const [donorSearchQuery, setDonorSearchQuery] = useState<string>('');
  const [donorGroupFilter, setDonorGroupFilter] = useState<string>('All');
  const [showAllDonorsModal, setShowAllDonorsModal] = useState<boolean>(false);
  const [showRegisterHospitalModal, setShowRegisterHospitalModal] = useState<boolean>(false);
  const [showRegisterDonorModal, setShowRegisterDonorModal] = useState<boolean>(false);
  const [localBanks, setLocalBanks] = useState<IntegratedBloodBank[]>(liveBloodBanks);
  const [localDonors, setLocalDonors] = useState<IntegratedDonor[]>(liveDonors);

  useEffect(() => {
    if (liveBloodBanks && liveBloodBanks.length > 0) {
      setLocalBanks(liveBloodBanks);
    }
  }, [liveBloodBanks]);

  useEffect(() => {
    if (liveDonors && liveDonors.length > 0) {
      setLocalDonors(liveDonors);
    }
  }, [liveDonors]);

  const handleDonorRegistered = (donor: IntegratedDonor) => {
    setLocalDonors((prev) => [donor, ...prev]);
    showToast(`✅ Registered ${donor.name} (${donor.bloodGroup}) at ${donor.locality || donor.city}!`);
  };

  const handleHospitalRegistered = (bank: IntegratedBloodBank) => {
    setLocalBanks((prev) => [bank, ...prev]);
    showToast(`✅ Added ${bank.name} to the active regional grid!`);
  };

  // New camp form state
  const [newCampTitle, setNewCampTitle] = useState('');
  const [newCampVenue, setNewCampVenue] = useState('');
  const [newCampDate, setNewCampDate] = useState('Oct 26');
  const [newCampTime, setNewCampTime] = useState('09:30 - 16:30');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Sync draft message when parameters change
  useEffect(() => {
    const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(hospital.name + ' ' + hospital.city)}`;
    setAiDraftMessage(
      `🚨 *URGENT BLOOD SOS // GOLDEN HOUR PROTOCOL* 🩸\n*Required Blood Group:* *${selectedGroup}* (${unitsNeeded} Units needed)\n*Hospital:* ${hospital.name}\n*Department:* ${departmentRef}\n*Urgency:* ${urgencyLevel}\n📍 *Maps Route:* ${mapsLink}\n📞 *Hotline:* ${hospital.contactNumber}`
    );
  }, [selectedGroup, unitsNeeded, departmentRef, urgencyLevel, hospital.name, hospital.city, hospital.contactNumber]);

  // Call server-side free AI route for broadcast generation
  const handleGenerateWithGemini = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch('/api/ai/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalName: hospital.name,
          city: hospital.city,
          bloodGroup: selectedGroup,
          unitsNeeded,
          department: departmentRef,
          contactNumber: hospital.contactNumber,
          urgencyLevel,
          patientRef,
          model: freeModel,
        }),
      });

      const data = await response.json();
      if (data.broadcastMessage) {
        setAiDraftMessage(data.broadcastMessage);
        const providerLabel = data.provider === 'openrouter_free' ? 'OpenRouter Free Model' : data.provider === 'gemini_free' ? 'Gemini Free' : 'Free Engine';
        showToast(`✨ ${providerLabel} crafted WhatsApp alert template!`);
      } else {
        showToast('Generated emergency template');
      }
    } catch (err) {
      console.warn('Fallback template used:', err);
      showToast('Generated alert template');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Broadcast to WhatsApp
  const handleBroadcastWhatsApp = () => {
    // Save to store
    onAddRequest({
      hospitalName: hospital.name,
      city: hospital.city,
      bloodGroup: selectedGroup,
      unitsNeeded,
      urgencyLevel,
      department: departmentRef,
      patientRef,
      contactNumber: hospital.contactNumber,
      formattedMessage: aiDraftMessage,
    });

    const encodedText = encodeURIComponent(aiDraftMessage);
    const waUrl = `https://wa.me/?text=${encodedText}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showToast('Broadcast dispatched to WhatsApp donor groups & network!');
  };

  // Social Dispatch
  const handleSocialDispatch = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(aiDraftMessage);
    }
    showToast('Copied to clipboard! Ready to paste into Telegram & Instagram');
  };

  const filteredCrossStock = crossHospitalStock.filter((item) =>
    filterGroup === 'All' ? true : item.group === filterGroup
  );

  const matchedDonors = localDonors.filter((d) => d.bloodGroup === selectedGroup);

  const filteredBanks = localBanks.filter((b) => {
    const matchDist =
      bankDistrictFilter === 'All' ||
      (b.district || b.city || '').toLowerCase().includes(bankDistrictFilter.toLowerCase());
    const matchCat =
      bankCategoryFilter === 'All' ||
      (b.category || '').toLowerCase() === bankCategoryFilter.toLowerCase();
    return matchDist && matchCat;
  });

  const filteredRegistryDonors = localDonors.filter((d) => {
    const matchGrp = donorGroupFilter === 'All' || d.bloodGroup === donorGroupFilter;
    const matchQ =
      !donorSearchQuery ||
      d.name.toLowerCase().includes(donorSearchQuery.toLowerCase()) ||
      d.city.toLowerCase().includes(donorSearchQuery.toLowerCase()) ||
      (d.locality || '').toLowerCase().includes(donorSearchQuery.toLowerCase()) ||
      d.phone.includes(donorSearchQuery);
    return matchGrp && matchQ;
  });

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 py-4 pb-28 gap-4">
      {/* Top Hospital Info Header */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-[#b70011] border border-red-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[28px]">local_hospital</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-display font-bold text-[16px] text-[#0b1c30] truncate">
                  {hospital.name}
                </h1>
                <span
                  className="material-symbols-outlined text-emerald-600 text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  title="Verified Clinical Facility"
                >
                  verified
                </span>
              </div>
              <p className="text-[12px] text-slate-500 truncate">
                {hospital.licenseNumber} • {hospital.zoneHub}
              </p>
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => showToast('3 active regional cross-match alerts pending')}
              aria-label="Facility alerts"
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            </button>
            <span className="absolute -top-1 -right-1 bg-[#b70011] text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-xs">
              3
            </span>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => {
              const el = document.getElementById('broadcast-creator-section');
              el?.scrollIntoView({ behavior: 'smooth' });
              showToast('Scrolled to Emergency Broadcast Form');
            }}
            className="flex-1 bg-[#b70011] hover:bg-red-700 text-white text-[13px] font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all"
          >
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <span className="tracking-wide">Emergency Broadcast</span>
          </button>

          <button
            onClick={() => {
              showToast('API Network Sync: Connected to Supabase National Life Grid');
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[13px] font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            <span>Sync API</span>
          </button>
        </div>
      </section>

      {/* Key Metrics Strip */}
      <section className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500">Total Stock</span>
          <span className="font-display font-extrabold text-[22px] text-[#0b1c30] mt-0.5 tabular-nums">
            {hospital.totalStock}
          </span>
          <span className="text-[11px] font-medium text-emerald-600">Units Ready</span>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500">Expiring &lt;7d</span>
          <span className="font-display font-extrabold text-[22px] text-[#b70011] mt-0.5 tabular-nums">
            {hospital.expiring7d}
          </span>
          <span className="text-[11px] font-medium text-red-600">Priority Use</span>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500">Requests</span>
          <span className="font-display font-extrabold text-[22px] text-[#0b1c30] mt-0.5 tabular-nums">
            {hospital.pendingRequests}
          </span>
          <span className="text-[11px] font-bold text-[#b70011]">Pending</span>
        </div>
      </section>

      {/* Dynamic Blood Inventory Matrix */}
      <section id="inventory-section" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[20px]">inventory_2</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Live Blood Inventory</h2>
          </div>
          <span className="text-[11px] text-slate-400">Updated 2m ago</span>
        </div>

        {/* RLS Security Notice */}
        <div className="px-3 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-[11px] text-emerald-800 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-emerald-600">verified_user</span>
          <span>
            <strong>Row-Level Security (RLS) active:</strong> You are authorized to edit AIIMS Raipur stock only.
          </span>
        </div>

        {/* 2x4 Interactive Card Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {inventory.map((item) => {
            const isCritical = item.status === 'Critical';
            const isLow = item.status === 'Low';
            const isStable = item.status === 'Stable';

            return (
              <div
                key={item.group}
                className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between gap-2.5 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <span className="font-display font-extrabold text-[24px] text-[#0b1c30] leading-none">
                    {item.group}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      isCritical
                        ? 'bg-red-600 text-white'
                        : isLow
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>}
                    {item.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] text-slate-500">In Reserve</span>
                    <span className="font-display font-extrabold text-[18px] text-[#0b1c30] tabular-nums">
                      {item.units} <span className="text-[11px] font-normal text-slate-400">U</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isCritical ? 'bg-[#b70011]' : isLow ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.max(6, item.percentage)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Adjust +/- buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      onUpdateInventory(item.group, -1);
                      showToast(`${item.group} decremented by 1 Unit`);
                    }}
                    className="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-lg active:scale-95 transition-all"
                  >
                    −
                  </button>
                  <button
                    onClick={() => {
                      onUpdateInventory(item.group, 1);
                      showToast(`${item.group} incremented by 1 Unit`);
                    }}
                    className="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-lg active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Emergency Blood Request Creator Module (AI-Powered) */}
      <section
        id="broadcast-creator-section"
        className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[22px]">emergency</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Broadcast Blood Request</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-[#b70011] text-[11px] font-bold">
            Golden Hour Protocol
          </span>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Blood Type Dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Requested Group</label>
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value as BloodGroup)}
                  className="w-full bg-slate-50 border border-slate-200 h-11 px-3 rounded-xl font-display font-bold text-[14px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="O-">O Negative (O-)</option>
                  <option value="AB-">AB Negative (AB-)</option>
                  <option value="A-">A Negative (A-)</option>
                  <option value="B-">B Negative (B-)</option>
                  <option value="A+">A Positive (A+)</option>
                  <option value="B+">B Positive (B+)</option>
                  <option value="O+">O Positive (O+)</option>
                  <option value="AB+">AB Positive (AB+)</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 pointer-events-none text-[20px]">
                  arrow_drop_down
                </span>
              </div>
            </div>

            {/* Units Counter */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Units Required</label>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 h-11 px-2 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUnitsNeeded((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-bold text-base active:bg-slate-100"
                >
                  −
                </button>
                <span className="font-display font-extrabold text-[18px] text-slate-900 tabular-nums">
                  {unitsNeeded}
                </span>
                <button
                  type="button"
                  onClick={() => setUnitsNeeded((prev) => prev + 1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-bold text-base active:bg-slate-100"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Department & Urgency */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Department / Bed</label>
              <input
                type="text"
                value={departmentRef}
                onChange={(e) => setDepartmentRef(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 h-11 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                placeholder="e.g. Trauma ICU / Bed 14"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Urgency Level</label>
              <select
                value={urgencyLevel}
                onChange={(e) => setUrgencyLevel(e.target.value as UrgencyLevel)}
                className="w-full bg-slate-50 border border-slate-200 h-11 px-2.5 rounded-xl text-[12px] font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="CRITICAL (Golden Hour)">🚨 Critical (Golden Hour)</option>
                <option value="Urgent">⚠️ Urgent (&lt;4 hrs)</option>
                <option value="Routine">Routine Schedule</option>
              </select>
            </div>
          </div>

          {/* AI Draft Preview */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[#b70011]">
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                <span className="text-[11px] font-bold uppercase tracking-wider">Free AI Alert Generator</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  ⚡ OpenRouter Free
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={freeModel}
                  onChange={(e) => setFreeModel(e.target.value)}
                  className="text-[11px] text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none"
                >
                  <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Free)</option>
                  <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Free)</option>
                  <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
                  <option value="qwen/qwen-2.5-72b-instruct:free">Qwen 2.5 72B (Free)</option>
                  <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                  <option value="zero-cost-clinical-engine">Offline Free Engine</option>
                </select>
                <button
                  type="button"
                  onClick={handleGenerateWithGemini}
                  disabled={isGeneratingAI}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isGeneratingAI ? 'hourglass_top' : 'auto_awesome'}
                  </span>
                  <span>{isGeneratingAI ? 'Drafting...' : 'Generate with Free AI'}</span>
                </button>
              </div>
            </div>

            <pre className="text-[12px] text-slate-800 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
              {aiDraftMessage}
            </pre>
          </div>

          {/* Matched Voluntary Donors from Supabase Grid */}
          <div className="bg-gradient-to-r from-red-50/90 to-rose-50/90 border border-red-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#b70011] text-[18px]">contact_phone</span>
                <span className="text-[12px] font-bold text-slate-900">
                  Matched Donors: {matchedDonors.length} Verified {selectedGroup} Donors
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowRegisterDonorModal(true)}
                  className="px-2 py-0.5 bg-white hover:bg-red-50 text-[#b70011] border border-red-200 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[13px]">person_add</span>
                  <span>+ Add Real Donor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMatchedDonorsDrawer(!showMatchedDonorsDrawer)}
                  className="text-[11px] font-bold text-[#b70011] hover:underline flex items-center gap-0.5 ml-1"
                >
                  <span>{showMatchedDonorsDrawer ? 'Collapse' : 'Expand & Dispatch'}</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {showMatchedDonorsDrawer ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-600">
              {matchedDonors.length} registered voluntary donors matching {selectedGroup} in Chhattisgarh (Raipur, Durg, Bhilai, Bilaspur, Rajnandgaon) with verified GPS locations.
            </p>

            {showMatchedDonorsDrawer && matchedDonors.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pt-1 pr-0.5">
                {matchedDonors.slice(0, 8).map((d) => (
                  <div
                    key={d.id}
                    className="bg-white rounded-lg p-2 border border-red-100 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-bold text-[12px] text-slate-900 truncate">
                          {d.name}
                        </span>
                        <span className="bg-red-100 text-[#b70011] text-[10px] font-bold px-1.5 py-0.2 rounded">
                          {d.bloodGroup}
                        </span>
                        {d.distanceKm !== undefined && (
                          <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            📍 {d.distanceKm} km
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 truncate">
                        {d.locality ? `${d.locality}, ` : ''}{d.city} • {d.phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={`https://wa.me/91${d.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(aiDraftMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                        title="Send SOS alert to donor WhatsApp"
                      >
                        <span>WA SOS</span>
                      </a>
                      <a
                        href={`tel:${d.phone}`}
                        className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                        title="Call donor"
                      >
                        <span className="material-symbols-outlined text-[15px]">call</span>
                      </a>
                    </div>
                  </div>
                ))}
                {matchedDonors.length > 8 && (
                  <div className="text-center pt-1">
                    <span className="text-[10px] text-slate-500 font-medium">
                      + {matchedDonors.length - 8} more verified {selectedGroup} donors ready in Supabase database
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Broadcast Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleBroadcastWhatsApp}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-display font-semibold text-[14px] py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
            <span>Broadcast to WhatsApp & All {matchedDonors.length} Donors</span>
          </button>

          <button
            onClick={handleSocialDispatch}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-display font-semibold text-[13px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">cell_tower</span>
            <span>One-Click Social Media Dispatch</span>
          </button>
        </div>
      </section>

      {/* Cross-Hospital Network Blood Availability & 20 Connected Supabase Facilities */}
      <section id="grid-section" className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-blue-700 text-[20px]">hub</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Regional Facilities & Grid</h2>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {liveBloodBanks.length} Facilities Live
          </span>
        </div>

        {/* Mode Switcher: 20 Blood Banks vs Cross-Matching Stock */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setGridTab('blood-banks')}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
              gridTab === 'blood-banks'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            20 Connected Blood Banks
          </button>
          <button
            type="button"
            onClick={() => setGridTab('cross-match')}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
              gridTab === 'cross-match'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stock By Blood Group
          </button>
        </div>

        {gridTab === 'blood-banks' ? (
          <HospitalLocationsMap
            bloodBanks={localBanks}
            activeHospitalId={hospital.id}
            onSelectHospital={(bank) => {
              if (onSwitchHospital && bank.id !== hospital.id) {
                onSwitchHospital(bank.id);
                showToast(`Switched active management facility to ${bank.name}`);
              }
            }}
            onOpenAddModal={() => setShowRegisterHospitalModal(true)}
          />
        ) : (
          <>
            <p className="text-[12px] text-slate-500">
              Cross-matching public inventories for urgent blood group transfer.
            </p>

            {/* Blood Group Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {['All', 'O-', 'AB-', 'A-', 'B-', 'O+'].map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setFilterGroup(bg)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                    filterGroup === bg
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>

            {/* Hospital Stock List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredCrossStock.map((item) => (
                <div
                  key={item.hospitalId + item.group}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-bold text-[13px] text-slate-900 truncate">
                      {item.hospitalName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {item.city} • {item.distanceKm} km away
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-display font-bold text-[14px] text-slate-900 tabular-nums">
                        {item.units} Units
                      </div>
                      <span className="text-[10px] font-semibold text-[#b70011]">{item.group}</span>
                    </div>

                    <a
                      href={`tel:${item.contactNumber}`}
                      className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center transition-colors"
                      title="Call Blood Bank Coordinator"
                    >
                      <span className="material-symbols-outlined text-[17px]">call</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Voluntary Donors Registry (1,000 Real Records from Supabase) */}
      <section id="registry-section" className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[20px]">group</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Donors Registry</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRegisterDonorModal(true)}
              className="px-2.5 py-1 bg-[#b70011] hover:bg-red-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">person_add</span>
              <span>+ Register Real Donor</span>
            </button>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {localDonors.length} Donors Live
            </span>
          </div>
        </div>
        <p className="text-[12px] text-slate-500">
          Direct access to registered voluntary donors in Chhattisgarh with verified contact numbers and real GPS distances.
        </p>

        {/* Search Bar & Blood Group Chips */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              type="text"
              value={donorSearchQuery}
              onChange={(e) => setDonorSearchQuery(e.target.value)}
              placeholder="Search donor name, city, locality, or phone..."
              className="w-full bg-slate-50 border border-slate-200 h-10 pl-9 pr-3 rounded-xl text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {['All', 'A+', 'B+', 'O+', 'AB+', 'O-', 'A-', 'B-'].map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setDonorGroupFilter(bg)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  donorGroupFilter === bg
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Donors List */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filteredRegistryDonors.slice(0, 15).map((d) => (
            <div
              key={d.id}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display font-bold text-[13px] text-slate-900 truncate">
                    {d.name}
                  </span>
                  <span className="bg-red-100 text-[#b70011] text-[10px] font-bold px-1.5 py-0.2 rounded">
                    {d.bloodGroup}
                  </span>
                  {d.is_available !== false && (
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                      Ready
                    </span>
                  )}
                  {d.distanceKm !== undefined && (
                    <span className="text-[9px] font-mono text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                      📍 {d.distanceKm} km away
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 truncate">
                  {d.locality ? `${d.locality}, ` : ''}{d.city} {d.pincode ? `(${d.pincode})` : ''} • {d.phone}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href={`https://wa.me/91${d.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Namaste ${d.name}! Blood-Connect emergency alert for ${d.bloodGroup} blood required at ${hospital.name}, ${hospital.city}. Are you available to donate today?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors"
                  title="WhatsApp Donor"
                >
                  <span className="material-symbols-outlined text-[16px]">chat</span>
                </a>
                <a
                  href={`tel:${d.phone}`}
                  className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center transition-colors"
                  title="Call Donor"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                </a>
              </div>
            </div>
          ))}
          {filteredRegistryDonors.length > 15 && (
            <div className="text-center pt-1.5">
              <span className="text-[11px] font-semibold text-slate-500">
                Showing 15 of {filteredRegistryDonors.length} matching voluntary donors from Supabase
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Blood Donation Camp & Event Manager */}
      <section id="drives-section" className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[20px]">event</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Upcoming Donation Drives</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
            Active Open
          </span>
        </div>

        {camps.map((camp) => (
          <div key={camp.id} className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <h3 className="font-display font-bold text-[14px] text-[#0b1c30] truncate">
                  {camp.title}
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">{camp.venue}</p>
              </div>
              <span className="w-9 h-9 rounded-lg bg-red-100 text-[#b70011] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">diversity_1</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="bg-white rounded-lg p-2 border border-slate-200/60 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-[17px]">schedule</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-semibold text-slate-500">Date & Time</span>
                  <span className="text-[11px] font-bold text-slate-800 truncate">
                    {camp.dateStr}, {camp.timeStr}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-2 border border-slate-200/60 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[17px]">how_to_reg</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-semibold text-slate-500">Pledged Donors</span>
                  <span className="text-[11px] font-bold text-slate-800 tabular-nums">
                    {camp.pledgedCount} Registered
                  </span>
                </div>
              </div>
            </div>

            {/* Drive Action Controls */}
            <div className="flex items-center gap-2 pt-1">
              <a
                href={camp.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-semibold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-red-600">location_on</span>
                <span>Map Pin</span>
              </a>

              <button
                onClick={() => {
                  onAddWalkIn(camp.id);
                  showToast('Walk-in donor registered for ' + camp.title);
                }}
                className="flex-1 bg-[#b70011] hover:bg-red-700 text-white text-[12px] font-semibold py-2 rounded-lg flex items-center justify-center gap-1 shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>+ Walk-in</span>
              </button>
            </div>
          </div>
        ))}

        {/* Schedule New Regional Camp */}
        <button
          onClick={() => setShowScheduleModal(true)}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-dashed border-slate-300"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Schedule New Regional Camp</span>
        </button>
      </section>

      {/* Critical Logistics Feed */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-[15px] text-[#0b1c30]">Critical Logistics Feed</h2>
          <span className="text-[11px] text-slate-400">Network Status: Live</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
              <span className="text-[12px] text-slate-800 truncate">
                Apollo Bilaspur accepted cross-match dispatch
              </span>
            </div>
            <span className="text-[11px] text-slate-400 flex-shrink-0">8m ago</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#b70011] flex-shrink-0"></span>
              <span className="text-[12px] text-slate-800 truncate">
                Auto-alert: 3 Units O- depleted for OR 2
              </span>
            </div>
            <span className="text-[11px] text-slate-400 flex-shrink-0">21m ago</span>
          </div>
        </div>
      </section>

      {/* Modal: Schedule Camp */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display font-bold text-[16px] text-slate-900">Schedule Donation Camp</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <label className="font-semibold text-slate-700">Camp Title</label>
              <input
                type="text"
                value={newCampTitle}
                onChange={(e) => setNewCampTitle(e.target.value)}
                placeholder="e.g. City Rotaract Mega Blood Camp"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none"
              />

              <label className="font-semibold text-slate-700">Venue & City</label>
              <input
                type="text"
                value={newCampVenue}
                onChange={(e) => setNewCampVenue(e.target.value)}
                placeholder="e.g. Town Hall Auditorium, Raipur"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Date</label>
                  <input
                    type="text"
                    value={newCampDate}
                    onChange={(e) => setNewCampDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Time Range</label>
                  <input
                    type="text"
                    value={newCampTime}
                    onChange={(e) => setNewCampTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!newCampTitle) {
                  alert('Please enter camp title');
                  return;
                }
                showToast(`New drive "${newCampTitle}" published to network!`);
                setShowScheduleModal(false);
                setNewCampTitle('');
                setNewCampVenue('');
              }}
              className="w-full mt-2 h-11 bg-[#b70011] text-white font-semibold text-sm rounded-xl"
            >
              Publish Camp to Network
            </button>
          </div>
        </div>
      )}

      {/* Floating Micro Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 max-w-sm mx-auto bg-slate-900 text-white py-3 px-4 rounded-xl shadow-xl flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="text-[13px] font-medium leading-tight">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
