import React from 'react';
import { UserRole } from '../types';

interface BottomNavProps {
  role: UserRole | null;
  activeSubTab: string;
  onSelectSubTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ role, activeSubTab, onSelectSubTab }) => {
  if (!role) return null;

  const hospitalTabs = [
    { id: 'inventory', label: 'Inventory', icon: 'inventory_2' },
    { id: 'broadcast', label: 'SOS Alert', icon: 'emergency' },
    { id: 'facilities', label: '20 Banks', icon: 'hub' },
    { id: 'registry', label: '1k Donors', icon: 'groups' },
    { id: 'camps', label: 'Drives', icon: 'event' },
  ];

  const donorTabs = [
    { id: 'pass', label: 'E-Pass', icon: 'badge' },
    { id: 'eligibility', label: 'Self-Test', icon: 'health_and_safety' },
    { id: 'centers', label: 'Walk-In', icon: 'pin_drop' },
    { id: 'rewards', label: 'Rewards', icon: 'storefront' },
    { id: 'bot', label: 'AI Bot', icon: 'smart_toy' },
  ];

  const tabs = role === 'hospital' ? hospitalTabs : donorTabs;

  return (
    <nav className="fixed bottom-0 w-full z-40 bg-[#f8f9ff]/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
        {tabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectSubTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center h-full gap-1 transition-all select-none ${
                isActive
                  ? 'text-[#b70011] font-bold scale-105'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span className="text-[10px] leading-none tracking-tight truncate max-w-[68px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
