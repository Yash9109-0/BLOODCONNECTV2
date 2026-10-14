import React from 'react';
import { UserRole } from '../types';

interface BottomNavProps {
  role: UserRole | null;
  activeSubTab: string;
  onSelectSubTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ role, activeSubTab, onSelectSubTab }) => {
  if (!role) return null;

  const superAdminTabs = [
    { id: 'approvals', label: 'Approvals', icon: 'verified_user' },
    { id: 'audit', label: 'Audit Trail', icon: 'fact_check' },
  ];

  const hospitalTabs = [
    { id: 'inventory', label: 'Inventory', icon: 'inventory_2' },
    { id: 'broadcast', label: 'SOS Alert', icon: 'emergency' },
    { id: 'confirm', label: 'Confirm', icon: 'qr_code_scanner' },
    { id: 'facilities', label: '20 Banks', icon: 'hub' },
    { id: 'registry', label: '1k Donors', icon: 'groups' },
    { id: 'camps', label: 'Drives', icon: 'event' },
  ];

  const donorTabs = [
    { id: 'pass', label: 'E-Pass', icon: 'badge' },
    { id: 'requests', label: 'Requests', icon: 'emergency' },
    { id: 'inventory', label: 'Stock', icon: 'inventory_2' },
    { id: 'eligibility', label: 'Self-Test', icon: 'health_and_safety' },
    { id: 'centers', label: 'Walk-In', icon: 'pin_drop' },
    { id: 'rewards', label: 'Rewards', icon: 'storefront' },
    { id: 'bot', label: 'AI Bot', icon: 'smart_toy' },
  ];

  const tabs =
    role === 'super_admin' ? superAdminTabs : role === 'hospital' ? hospitalTabs : donorTabs;

  return (
    <nav className="fixed bottom-0 w-full z-40 bg-[#f8f9ff]/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
        {tabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectSubTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-all select-none min-w-0 ${
                isActive
                  ? 'text-[#b70011] font-bold scale-105'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span className="text-[9.5px] leading-none tracking-tight truncate max-w-[50px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
