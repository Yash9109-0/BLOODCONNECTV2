/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useBloodConnectStore } from './lib/store';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AuthScreen } from './components/AuthScreen';
import { HospitalDashboard } from './components/HospitalDashboard';
import { DonorDashboard } from './components/DonorDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { UserRole } from './types';

export default function App() {
  const {
    session,
    loginAs,
    logout,
    activeSubTab,
    setActiveSubTab,
    activeRole,
    setActiveRole,
    inventory,
    updateInventoryUnit,
    donor,
    updateDonorSelfTest,
    awardReferralPoints,
    hospital,
    rewards,
    redeemVoucher,
    camps,
    addWalkInDonor,
    createCamp,
    updateCamp,
    deleteCamp,
    requests,
    addEmergencyRequest,
    crossHospitalStock,
    liveBloodBanks,
    liveDonors,
    supabaseConnected,
    totalDonorsCount,
    totalBanksCount,
    switchActiveHospital,
    switchActiveDonor,
  } = useBloodConnectStore();

  const handleLoginSuccess = (
    role: UserRole,
    details?: { email?: string; name?: string; facilityName?: string }
  ) => {
    loginAs(role, details);
  };

  const handleSubTabSelect = (tab: string) => {
    setActiveSubTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-sans selection:bg-red-500/20">
      {/* Top Fixed Header with role badge and logout button */}
      <Header
        currentTab={session.role || 'login'}
        activeRole={session.role}
        pendingRequestsCount={hospital.pendingRequests}
        totalDonorsCount={totalDonorsCount}
        totalBanksCount={totalBanksCount}
        supabaseConnected={supabaseConnected}
        isAuthenticated={session.isAuthenticated}
        onLogout={logout}
        hospitalName={hospital.name}
        donorName={donor.name}
        donorGroup={donor.bloodGroup}
        donorPoints={donor.points}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 w-full pt-16">
        {/* PAGE 1: Unauthenticated Login / Register Screen (No dashboard visible) */}
        {!session.isAuthenticated && (
          <AuthScreen
            activeRole={activeRole}
            setActiveRole={setActiveRole}
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {/* PAGE 2: Hospital Admin Dashboard ONLY (Strictly for authenticated hospital accounts) */}
        {session.isAuthenticated && session.role === 'hospital' && (
          <HospitalDashboard
            activeSubTab={activeSubTab}
            onSelectSubTab={handleSubTabSelect}
            hospital={hospital}
            inventory={inventory}
            onUpdateInventory={updateInventoryUnit}
            camps={camps}
            onAddWalkIn={addWalkInDonor}
            onCreateCamp={createCamp}
            onUpdateCamp={updateCamp}
            onDeleteCamp={deleteCamp}
            requests={requests}
            onAddRequest={addEmergencyRequest}
            crossHospitalStock={crossHospitalStock}
            liveBloodBanks={liveBloodBanks}
            liveDonors={liveDonors}
            onSwitchHospital={switchActiveHospital}
            totalDonorsCount={totalDonorsCount}
            supabaseConnected={supabaseConnected}
          />
        )}

        {/* PAGE 3: Voluntary Donor Dashboard ONLY (Strictly for authenticated donor accounts) */}
        {session.isAuthenticated && session.role === 'donor' && (
          <DonorDashboard
            activeSubTab={activeSubTab}
            onSelectSubTab={handleSubTabSelect}
            donor={donor}
            rewards={rewards}
            onRedeemReward={redeemVoucher}
            onUpdateSelfTest={updateDonorSelfTest}
            onAwardReferralPoints={awardReferralPoints}
            camps={camps}
            requests={requests}
            onNavigateToChat={() => handleSubTabSelect('bot')}
            liveBloodBanks={liveBloodBanks}
            liveDonors={liveDonors}
            onSwitchDonor={switchActiveDonor}
          />
        )}

        {/* PAGE 4: Super Admin Dashboard ONLY (Strictly for state authority / super_admin role) */}
        {session.isAuthenticated && session.role === 'super_admin' && (
          <SuperAdminDashboard
            activeSubTab={activeSubTab}
            onSelectSubTab={handleSubTabSelect}
            liveBloodBanks={liveBloodBanks}
          />
        )}
      </main>

      {/* Bottom Sticky Tab Navigation (Rendered ONLY when logged in, with strictly role-isolated tabs) */}
      {session.isAuthenticated && (
        <BottomNav
          role={session.role}
          activeSubTab={activeSubTab}
          onSelectSubTab={handleSubTabSelect}
        />
      )}
    </div>
  );
}
