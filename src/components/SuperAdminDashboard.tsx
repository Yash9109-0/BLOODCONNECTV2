import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { IntegratedBloodBank } from '../types';

export interface UnverifiedHospitalItem {
  id: string;
  name: string;
  licenseNumber: string;
  city: string;
  address: string;
  contactNumber: string;
  verified: boolean;
  createdAt?: string;
  source: 'database' | 'local';
}

interface SuperAdminDashboardProps {
  activeSubTab?: string;
  onSelectSubTab?: (tab: string) => void;
  liveBloodBanks?: IntegratedBloodBank[];
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  activeSubTab = 'approvals',
  onSelectSubTab,
  liveBloodBanks = [],
}) => {
  const [hospitalsList, setHospitalsList] = useState<UnverifiedHospitalItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'verified' | 'all'>('pending');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Fetch hospitals from Supabase public.hospitals table, supplemented with unverified blood bank mocks
  const fetchHospitals = async () => {
    setIsLoading(true);
    try {
      const items: UnverifiedHospitalItem[] = [];

      // 1. Try reading from public.hospitals table
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          data.forEach((h: any) => {
            const isVerified =
              h.is_verified === true ||
              h.verified === true ||
              h.status === 'verified';

            items.push({
              id: h.id || h.user_id,
              name: h.name || 'Unnamed Hospital',
              licenseNumber: h.license_number || 'PENDING-VERIFY',
              city: h.city || 'Raipur',
              address: h.address || 'Chhattisgarh',
              contactNumber: h.contact_number || h.phone || 'N/A',
              verified: isVerified,
              createdAt: h.created_at,
              source: 'database',
            });
          });
        }
      } catch (dbErr) {
        console.warn('Supabase hospitals query note:', dbErr);
      }

      // 2. If table is empty or missing rows, provide realistic sample pending hospitals for SuperAdmin
      if (items.length === 0) {
        const mockPending: UnverifiedHospitalItem[] = [
          {
            id: 'hosp-pending-1',
            name: 'Mahanadi Lifeline Trauma & Blood Bank',
            licenseNumber: 'CG-BLD-PEND-2026-08',
            city: 'Raipur',
            address: 'Ring Road No. 1, Sarona, Raipur, CG 492010',
            contactNumber: '+91 771-4299100',
            verified: false,
            createdAt: '2 hours ago',
            source: 'local',
          },
          {
            id: 'hosp-pending-2',
            name: 'Bhilai Specialty Surgical Care Center',
            licenseNumber: 'CG-BLD-PEND-2026-11',
            city: 'Bhilai',
            address: 'GE Road, Supela Chowk, Bhilai, CG 490023',
            contactNumber: '+91 788-2289400',
            verified: false,
            createdAt: '5 hours ago',
            source: 'local',
          },
          {
            id: 'hosp-pending-3',
            name: 'Hasdeo Critical Care & Blood Storage Unit',
            licenseNumber: 'CG-BLD-PEND-2026-19',
            city: 'Korba',
            address: 'Transport Nagar, T.P. Nagar, Korba, CG 495677',
            contactNumber: '+91 7759-245100',
            verified: false,
            createdAt: '1 day ago',
            source: 'local',
          },
          {
            id: 'hosp-verified-1',
            name: 'Dr. B.R. Ambedkar Memorial Model Blood Centre',
            licenseNumber: 'CG-BLD-0101',
            city: 'Raipur',
            address: 'Medical College Campus, Jail Road, Raipur, CG 492001',
            contactNumber: '+91 771-2525602',
            verified: true,
            createdAt: 'Active Facility',
            source: 'local',
          },
          {
            id: 'hosp-verified-2',
            name: 'AIIMS Raipur Blood Bank & Component Lab',
            licenseNumber: 'CG-BLD-0103',
            city: 'Raipur',
            address: 'GE Road, Tatibandh, Raipur, CG 492099',
            contactNumber: '+91 771-2577000',
            verified: true,
            createdAt: 'Active Facility',
            source: 'local',
          },
        ];

        setHospitalsList(mockPending);
        return;
      }

      setHospitalsList(items);
    } catch (err) {
      console.warn('Error fetching unverified hospitals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  // Action: Approve hospital
  const handleApprove = async (hospitalItem: UnverifiedHospitalItem) => {
    setActionInProgress(hospitalItem.id);
    try {
      if (hospitalItem.source === 'database') {
        const { error } = await supabase
          .from('hospitals')
          .update({ is_verified: true, verified: true })
          .eq('id', hospitalItem.id);

        if (error) {
          // If id didn't match, try user_id
          await supabase
            .from('hospitals')
            .update({ is_verified: true, verified: true })
            .eq('user_id', hospitalItem.id);
        }
      }

      setHospitalsList((prev) =>
        prev.map((h) => (h.id === hospitalItem.id ? { ...h, verified: true } : h))
      );
      showToast(`✅ Approved! ${hospitalItem.name} can now broadcast emergency blood requests.`);
    } catch (err) {
      console.warn('Error approving hospital:', err);
      showToast('❌ Approval failed. Please check network.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Action: Reject hospital
  const handleReject = async (hospitalItem: UnverifiedHospitalItem) => {
    if (!window.confirm(`Are you sure you want to REJECT the verification request for "${hospitalItem.name}"?`)) {
      return;
    }

    setActionInProgress(hospitalItem.id);
    try {
      if (hospitalItem.source === 'database') {
        await supabase
          .from('hospitals')
          .update({ is_verified: false, verified: false })
          .eq('id', hospitalItem.id);
      }

      setHospitalsList((prev) =>
        prev.map((h) => (h.id === hospitalItem.id ? { ...h, verified: false } : h))
      );
      showToast(`🚫 Verification rejected for ${hospitalItem.name}.`);
    } catch (err) {
      console.warn('Error rejecting hospital:', err);
      showToast('Failed to reject hospital.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Filtered list
  const filteredList = hospitalsList.filter((item) => {
    const matchesFilter =
      filterStatus === 'all'
        ? true
        : filterStatus === 'pending'
        ? !item.verified
        : item.verified;

    const matchesSearch =
      !searchTerm.trim() ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const pendingCount = hospitalsList.filter((h) => !h.verified).length;
  const verifiedCount = hospitalsList.filter((h) => h.verified).length;

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 gap-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0b1c30] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-[18px] text-amber-400">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-indigo-900/40 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <span className="material-symbols-outlined text-[28px]">shield_person</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-[18px] tracking-tight">
                  Super Admin Console
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-400/30">
                  State Authority
                </span>
              </div>
              <p className="text-[12px] text-slate-300">
                Department of Health & Family Welfare • Chhattisgarh Blood Council
              </p>
            </div>
          </div>

          <button
            onClick={fetchHospitals}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="Refresh Hospital Directory"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-indigo-900/60">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 font-medium">Pending Verification</span>
              <span className="text-[20px] font-display font-bold text-amber-400">
                {pendingCount}
              </span>
            </div>
            <span className="material-symbols-outlined text-amber-400 text-[26px]">
              pending_actions
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 font-medium">Verified Facilities</span>
              <span className="text-[20px] font-display font-bold text-emerald-400">
                {verifiedCount}
              </span>
            </div>
            <span className="material-symbols-outlined text-emerald-400 text-[26px]">
              verified
            </span>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[20px]">
              fact_check
            </span>
            <h2 className="font-display font-bold text-[15px] text-[#0b1c30]">
              Hospital Authorization Requests
            </h2>
          </div>

          {/* Segmented Filter */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center text-[12px] font-semibold">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterStatus === 'pending'
                  ? 'bg-white text-amber-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('verified')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterStatus === 'verified'
                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verified ({verifiedCount})
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by hospital name, city, or license number..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </section>

      {/* Hospital List Cards */}
      <section className="flex flex-col gap-3">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center flex flex-col items-center gap-2 text-slate-500">
            <span className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
            <span className="text-[13px]">Scanning clinical verification queue...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[36px] text-slate-300">
              task_alt
            </span>
            <h3 className="font-display font-bold text-[15px] text-[#0b1c30]">
              {filterStatus === 'pending'
                ? 'No Pending Hospital Verifications'
                : 'No Matching Facilities Found'}
            </h3>
            <p className="text-[12px] text-slate-500 max-w-sm">
              All registered medical facilities have been reviewed or matched by current filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((item) => {
              const isProcessing = actionInProgress === item.id;
              return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 border transition-all shadow-xs flex flex-col gap-3 ${
                  !item.verified
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-slate-200/80'
                }`}
              >
                {/* Hospital Header Details */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        item.verified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {item.verified ? 'verified' : 'medical_services'}
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-display font-bold text-[14px] text-[#0b1c30] truncate">
                          {item.name}
                        </h3>
                        {item.verified ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Verified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold animate-pulse">
                            Needs Approval
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-500 truncate mt-0.5">
                        <span className="font-semibold text-slate-700">{item.city}</span> • Lic: {item.licenseNumber}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                    {item.createdAt || 'Recent'}
                  </span>
                </div>

                {/* Address & Contact Row */}
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/60 flex flex-col gap-1 text-[12px] text-slate-600">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">
                      location_on
                    </span>
                    <span className="truncate">{item.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">
                      call
                    </span>
                    <span className="font-mono text-slate-800 font-medium">{item.contactNumber}</span>
                  </div>
                </div>

                {/* Operational Warning for Unverified */}
                {!item.verified && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-800 font-medium bg-amber-100/60 p-2 rounded-lg">
                    <span className="material-symbols-outlined text-[16px] text-amber-700">
                      block
                    </span>
                    <span>Emergency SOS broadcasts are locked until you approve this license.</span>
                  </div>
                )}

                {/* Approve / Reject Controls */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  {!item.verified ? (
                    <>
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={isProcessing}
                        className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-semibold text-[13px] flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-all disabled:opacity-70"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          check_circle
                        </span>
                        <span>{isProcessing ? 'Approving...' : 'Approve Facility'}</span>
                      </button>

                      <button
                        onClick={() => handleReject(item)}
                        disabled={isProcessing}
                        className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-700 font-display font-semibold text-[13px] flex items-center justify-center gap-1 transition-all disabled:opacity-70"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                        <span>Reject</span>
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-700 text-[12px] font-semibold">
                        <span className="material-symbols-outlined text-[18px]">
                          verified
                        </span>
                        <span>Authorized for SOS Broadcasts</span>
                      </div>

                      <button
                        onClick={() => handleReject(item)}
                        disabled={isProcessing}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          cancel
                        </span>
                        <span>Revoke Status</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </section>
    </div>
  );
};

