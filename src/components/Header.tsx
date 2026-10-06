import React, { useState } from 'react';
import { UserRole } from '../types';

interface HeaderProps {
  currentTab: string;
  activeRole: UserRole | null;
  pendingRequestsCount: number;
  totalDonorsCount?: number;
  totalBanksCount?: number;
  supabaseConnected?: boolean;
  isAuthenticated: boolean;
  onLogout: () => void;
  hospitalName?: string;
  donorName?: string;
  donorGroup?: string;
  donorPoints?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  activeRole,
  pendingRequestsCount,
  totalDonorsCount = 1000,
  totalBanksCount = 20,
  supabaseConnected = true,
  isAuthenticated,
  onLogout,
  hospitalName,
  donorName,
  donorGroup,
  donorPoints,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const getPortalLabel = () => {
    if (!isAuthenticated) return 'National Rapid Response';
    if (activeRole === 'hospital') return 'Hospital Admin Portal';
    return 'Voluntary Donor Hub';
  };

  return (
    <>
      <header className="fixed top-0 w-full z-40 bg-[#f8f9ff]/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="max-w-4xl mx-auto h-16 px-4 flex items-center justify-between gap-2">
          {/* Zone 1: Brand & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* SVG Logo icon matching authentic Blood-Connect droplet */}
            <div className="relative w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shadow-xs border border-red-100/80 flex-shrink-0">
              <svg className="w-6 h-6 text-[#b70011]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                <path d="M10.5 10.5H13.5V8.5H10.5V10.5ZM10.5 13.5H8.5V15.5H10.5V13.5ZM13.5 15.5V13.5H15.5V11.5H13.5V13.5H11.5V15.5H13.5Z" fill="#ffffff" />
                <path d="M11 11H13V9H11V11ZM9 13H11V11H9V13ZM13 13H15V11H13V13ZM11 15H13V13H11V15Z" fill="#ffffff" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-[17px] text-[#0b1c30] tracking-tight truncate">
                  Blood-Connect
                </span>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#b70011] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#b70011]"></span>
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#b70011] tracking-wider uppercase truncate">
                {getPortalLabel()}
              </span>
            </div>
          </div>

          {/* Zone 2 & 3: Actions, Portal Badge, and Logout */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Supabase Status Pill */}
            {supabaseConnected && (
              <div
                title="Connected to Supabase: 1,000 Donors, 20 Blood Banks"
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-bold text-emerald-800"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase Live</span>
              </div>
            )}

            {/* Authenticated User Status or Role Badge */}
            {isAuthenticated && (
              <>
                {/* Notifications Button */}
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label="Notifications"
                  className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[21px]">notifications</span>
                  {pendingRequestsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#b70011] ring-2 ring-white"></span>
                  )}
                </button>

                {/* Role Pill */}
                <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-800">
                  <span className="material-symbols-outlined text-[15px] text-[#b70011]">
                    {activeRole === 'hospital' ? 'local_hospital' : 'favorite'}
                  </span>
                  <span className="truncate max-w-[120px]">
                    {activeRole === 'hospital' ? (hospitalName || 'Hospital Admin') : `${donorName || 'Donor'} (${donorGroup || 'O+'})`}
                  </span>
                </div>

                {/* Prominent Logout Button */}
                <button
                  onClick={onLogout}
                  title="Sign out of your session"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-[#b70011] border border-red-200/80 text-[12px] font-bold transition-all active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span className="hidden xs:inline">Sign Out</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Notifications Drawer / Dropdown */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 bg-slate-900/20 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-[20px]">notifications_active</span>
                <h3 className="font-display font-semibold text-slate-900 text-sm">Critical Lifeline Alerts</h3>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 mt-3 max-h-72 overflow-y-auto">
              <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-100 text-xs">
                <div className="flex items-center justify-between font-semibold text-red-900 mb-1">
                  <span>🚨 Urgent SOS: 4 Units O-</span>
                  <span className="text-[10px] text-red-600 font-normal">8m ago</span>
                </div>
                <p className="text-red-800">AIIMS Trauma ICU Bed 14. Severe blood loss trauma case.</p>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-xs">
                <div className="flex items-center justify-between font-semibold text-emerald-900 mb-1">
                  <span>✅ Dispatch Accepted</span>
                  <span className="text-[10px] text-emerald-600 font-normal">14m ago</span>
                </div>
                <p className="text-emerald-800">Apollo Bilaspur accepted 2 units cross-match logistics transfer.</p>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-100 text-xs">
                <div className="flex items-center justify-between font-semibold text-blue-900 mb-1">
                  <span>📢 Donation Drive Approaching</span>
                  <span className="text-[10px] text-blue-600 font-normal">1h ago</span>
                </div>
                <p className="text-blue-800">Youth Conclave Camp: 85 donors pledged for Oct 12.</p>
              </div>
            </div>

            <button
              onClick={() => setShowNotifications(false)}
              className="w-full mt-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Close Notifications
            </button>
          </div>
        </div>
      )}
    </>
  );
};
