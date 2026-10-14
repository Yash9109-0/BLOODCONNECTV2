import React, { useState, useMemo, useEffect } from 'react';
import { IntegratedDonor, DonorProfile } from '../types';

interface LeaderboardProps {
  liveDonors?: IntegratedDonor[];
  currentDonor?: DonorProfile;
  onSelectSubTab?: (tab: string) => void;
}

interface RankedDonor {
  id: string;
  firstName: string;
  city: string;
  points: number;
  bloodGroup: string;
  badgeLevel: 'Gold' | 'Silver' | 'Bronze';
  streak: number;
  totalDonations: number;
  rank: number;
  isCurrentUser?: boolean;
}

/**
 * Extracts strictly the first name for privacy compliance.
 * Never outputs full surnames, phone numbers, or emails.
 */
function getSanitizedFirstName(fullName: string): string {
  if (!fullName) return 'Voluntary Donor';
  const withoutPrefix = fullName.replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.|Shri|Smt\.)\s+/i, '').trim();
  const first = withoutPrefix.split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Donor';
}

function calculateBadgeTier(donationsCount: number, points: number): 'Gold' | 'Silver' | 'Bronze' {
  if (donationsCount >= 5 || points >= 600) return 'Gold';
  if (donationsCount >= 3 || points >= 300) return 'Silver';
  return 'Bronze';
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  liveDonors = [],
  currentDonor,
  onSelectSubTab,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [remoteDonors, setRemoteDonors] = useState<IntegratedDonor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch from server /api/supabase/donors if liveDonors is empty or to enrich stats
  useEffect(() => {
    let isMounted = true;
    const fetchDonors = async () => {
      if (liveDonors.length > 50) return;
      setIsLoading(true);
      try {
        const res = await fetch('/api/supabase/donors?limit=250');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.donors)) {
            setRemoteDonors(data.donors);
          }
        }
      } catch (err) {
        console.warn('Notice loading leaderboard donors:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchDonors();
    return () => {
      isMounted = false;
    };
  }, [liveDonors.length]);

  // Combine and deduplicate donor pool
  const allRawDonors = useMemo(() => {
    const list = remoteDonors.length > 0 ? remoteDonors : liveDonors;
    const map = new Map<string, IntegratedDonor>();

    // Add current donor if available
    if (currentDonor) {
      map.set(currentDonor.id || currentDonor.donorCode, {
        id: currentDonor.id || currentDonor.donorCode,
        name: currentDonor.name,
        bloodGroup: currentDonor.bloodGroup,
        city: currentDonor.city,
        phone: '', // Stripped
        email: '', // Stripped
        age: currentDonor.age,
        weight: currentDonor.weight,
        status: 'Ready',
        points: currentDonor.points,
        totalDonations: currentDonor.totalDonations,
        streak: currentDonor.streak || 3,
      });
    }

    list.forEach((d) => {
      const key = d.id || d.phone;
      if (!map.has(key)) {
        map.set(key, d);
      }
    });

    return Array.from(map.values());
  }, [liveDonors, remoteDonors, currentDonor]);

  // Extract unique cities list
  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    allRawDonors.forEach((d) => {
      if (d.city && d.city.trim()) {
        const c = d.city.trim();
        citySet.add(c.charAt(0).toUpperCase() + c.slice(1));
      }
    });
    const popular = ['Raipur', 'Bhilai', 'Bilaspur', 'Durg', 'Korba', 'Rajnandgaon'];
    popular.forEach((p) => citySet.add(p));
    return ['All', ...Array.from(citySet).sort()];
  }, [allRawDonors]);

  // Rank and filter donors by city and points
  const rankedDonors: RankedDonor[] = useMemo(() => {
    // 1. Filter by city if selected
    let filtered = allRawDonors;
    if (selectedCity !== 'All') {
      filtered = filtered.filter(
        (d) => (d.city || '').toLowerCase().trim() === selectedCity.toLowerCase().trim()
      );
    }

    // 2. Filter by search query (first name or city only)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((d) => {
        const firstName = getSanitizedFirstName(d.name).toLowerCase();
        const city = (d.city || '').toLowerCase();
        return firstName.includes(q) || city.includes(q);
      });
    }

    // 3. Sort strictly by points descending
    const sorted = [...filtered].sort((a, b) => {
      const ptsA = a.points ?? 0;
      const ptsB = b.points ?? 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      return (b.totalDonations ?? 0) - (a.totalDonations ?? 0);
    });

    // 4. Map to privacy-safe RankedDonor objects
    return sorted.map((d, index) => {
      const isCur =
        currentDonor &&
        (d.id === currentDonor.id ||
          d.id === currentDonor.donorCode ||
          d.name.toLowerCase() === currentDonor.name.toLowerCase());

      const donations = d.totalDonations || Math.max(1, Math.round((d.points || 100) / 150));
      const streakVal =
        d.streak !== undefined && d.streak !== null
          ? d.streak
          : isCur && currentDonor?.streak
          ? currentDonor.streak
          : Math.max(1, Math.min(donations, 5));

      return {
        id: d.id,
        firstName: getSanitizedFirstName(d.name),
        city: d.city || 'Raipur',
        points: d.points || 100,
        bloodGroup: d.bloodGroup || 'O+',
        badgeLevel: calculateBadgeTier(donations, d.points || 0),
        streak: streakVal,
        totalDonations: donations,
        rank: index + 1,
        isCurrentUser: Boolean(isCur),
      };
    });
  }, [allRawDonors, selectedCity, searchQuery, currentDonor]);

  // Find current donor's rank in the active view
  const currentDonorRank = useMemo(() => {
    return rankedDonors.find((d) => d.isCurrentUser);
  }, [rankedDonors]);

  // Top 3 Podium
  const top1 = rankedDonors[0];
  const top2 = rankedDonors[1];
  const top3 = rankedDonors[2];

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Leaderboard Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 text-white p-5 border border-amber-500/30 shadow-xl">
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-red-600/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-slate-950/40 backdrop-blur-xs flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[24px]">leaderboard</span>
              </div>
            </div>
            <div>
              <h2 className="font-display font-black text-[18px] text-white tracking-tight">
                LifeSaver Leaderboard
              </h2>
              <p className="text-[11px] text-amber-200/80 font-medium">
                Top Voluntary Blood Donors Ranked by Honor Points
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider shrink-0">
            🏆 State Grid
          </span>
        </div>

        {/* Privacy Shield Notice */}
        <div className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300">
          <span className="material-symbols-outlined text-emerald-400 text-[15px]">verified_user</span>
          <span>
            <strong>Privacy Protected:</strong> Displaying first names and city only. Contact numbers are never published.
          </span>
        </div>
      </section>

      {/* City Filter Pills */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Filter by City
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            {rankedDonors.length} Donors Ranked
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {availableCities.map((city) => {
            const isSelected = selectedCity === city;
            return (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-2xs ${
                  isSelected
                    ? 'bg-[#b70011] text-white shadow-red-500/20 shadow-md scale-102'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {city === 'All' ? '🌟 All Cities' : city}
              </button>
            );
          })}
        </div>
      </section>

      {/* Search Bar */}
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[18px]">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by first name or city..."
          className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-[13px] shadow-2xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-slate-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Current Donor Standing Card (Pinned) */}
      {currentDonorRank && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border-2 border-red-300 shadow-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#b70011] text-white flex flex-col items-center justify-center font-bold shadow-xs shrink-0">
              <span className="text-[10px] uppercase leading-none opacity-80">Rank</span>
              <span className="text-[15px] font-black leading-none">#{currentDonorRank.rank}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#b70011] text-white uppercase">
                  You
                </span>
                <span className="font-display font-extrabold text-[14px] text-slate-900 truncate">
                  {currentDonorRank.firstName}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">({currentDonorRank.city})</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs">
                <span className="font-bold text-[#b70011]">{currentDonorRank.points} Pts</span>
                <span className="text-slate-300">•</span>
                <span className="text-orange-600 font-bold flex items-center gap-0.5">
                  <span>🔥</span> {currentDonorRank.streak}x Streak
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
              {currentDonorRank.badgeLevel} Hero
            </span>
            <span className="text-[10px] text-slate-500 mt-1">
              {currentDonorRank.totalDonations} Donations
            </span>
          </div>
        </div>
      )}

      {/* Top 3 Podium Cards */}
      {rankedDonors.length >= 3 && !searchQuery && (
        <section className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto w-full items-end pt-2">
          {/* Rank 2 - Silver */}
          {top2 && (
            <div className="p-3 rounded-2xl bg-gradient-to-b from-slate-100 via-slate-50 to-white border-2 border-slate-300 text-center flex flex-col items-center gap-1 shadow-sm">
              <div className="w-9 h-9 rounded-full bg-slate-300 text-slate-800 font-black flex items-center justify-center text-sm shadow-xs border border-white">
                🥈
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">#2 Rank</span>
              <h4 className="font-display font-bold text-[13px] text-slate-900 truncate w-full">
                {top2.firstName}
              </h4>
              <span className="text-[10px] font-medium text-slate-500 truncate w-full">
                {top2.city}
              </span>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-extrabold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded-md">
                <span>{top2.points}</span>
                <span className="text-[9px] text-[#b70011]">Pts</span>
              </div>
              <span className="text-[10px] font-bold text-orange-600 mt-0.5 flex items-center gap-0.5">
                <span>🔥</span> {top2.streak}x
              </span>
            </div>
          )}

          {/* Rank 1 - Gold (Center, Elevated) */}
          {top1 && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-b from-amber-100 via-yellow-50 to-white border-2 border-amber-400 text-center flex flex-col items-center gap-1 shadow-md -translate-y-2">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 font-black flex items-center justify-center text-lg shadow-sm border-2 border-white animate-bounce-subtle">
                👑
              </div>
              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">#1 Champion</span>
              <h4 className="font-display font-extrabold text-[15px] text-slate-900 truncate w-full">
                {top1.firstName}
              </h4>
              <span className="text-[11px] font-semibold text-slate-600 truncate w-full">
                {top1.city}
              </span>
              <div className="mt-1 flex items-center gap-1 text-[12px] font-black text-amber-900 bg-amber-200/90 px-2.5 py-0.5 rounded-lg shadow-2xs">
                <span>{top1.points}</span>
                <span className="text-[10px] text-[#b70011]">Pts</span>
              </div>
              <span className="text-[10px] font-extrabold text-orange-600 mt-0.5 flex items-center gap-0.5">
                <span>🔥</span> {top1.streak}x Streak
              </span>
            </div>
          )}

          {/* Rank 3 - Bronze */}
          {top3 && (
            <div className="p-3 rounded-2xl bg-gradient-to-b from-amber-50 via-orange-50/40 to-white border-2 border-amber-700/40 text-center flex flex-col items-center gap-1 shadow-sm">
              <div className="w-9 h-9 rounded-full bg-amber-700/20 text-amber-900 font-black flex items-center justify-center text-sm shadow-xs border border-white">
                🥉
              </div>
              <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider">#3 Rank</span>
              <h4 className="font-display font-bold text-[13px] text-slate-900 truncate w-full">
                {top3.firstName}
              </h4>
              <span className="text-[10px] font-medium text-slate-500 truncate w-full">
                {top3.city}
              </span>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-extrabold text-slate-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                <span>{top3.points}</span>
                <span className="text-[9px] text-[#b70011]">Pts</span>
              </div>
              <span className="text-[10px] font-bold text-orange-600 mt-0.5 flex items-center gap-0.5">
                <span>🔥</span> {top3.streak}x
              </span>
            </div>
          )}
        </section>
      )}

      {/* Rankings Table / List */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            All Ranked Voluntary Lifesavers
          </span>
          <span className="text-[10px] text-slate-400">
            Sorted by Points
          </span>
        </div>

        {isLoading && rankedDonors.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-3xl animate-spin">
              progress_activity
            </span>
            <p className="text-sm font-semibold text-slate-700">Loading State Leaderboard...</p>
          </div>
        ) : rankedDonors.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-3xl">emoji_events</span>
            <p className="text-sm font-bold text-slate-700">No Donors Found in {selectedCity}</p>
            <p className="text-xs text-slate-500">Try choosing "All Cities" or clearing the search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {rankedDonors.map((donor) => {
              const isTop3 = donor.rank <= 3;
              const medalIcon = donor.rank === 1 ? '🥇' : donor.rank === 2 ? '🥈' : donor.rank === 3 ? '🥉' : null;

              return (
                <div
                  key={donor.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    donor.isCurrentUser
                      ? 'bg-red-50/80 border-red-300 shadow-xs'
                      : isTop3
                      ? 'bg-amber-50/30 border-amber-200/80 hover:border-amber-300'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {/* Left: Rank & Donor Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-display font-extrabold text-[13px] shrink-0 ${
                        donor.rank === 1
                          ? 'bg-amber-400 text-amber-950 shadow-xs'
                          : donor.rank === 2
                          ? 'bg-slate-300 text-slate-800 shadow-xs'
                          : donor.rank === 3
                          ? 'bg-amber-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {medalIcon || `#${donor.rank}`}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display font-bold text-[14px] text-slate-900 truncate">
                          {donor.firstName}
                        </span>
                        {donor.isCurrentUser && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#b70011] text-white uppercase">
                            You
                          </span>
                        )}
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                          {donor.bloodGroup}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[13px]">location_on</span>
                          <span>{donor.city}</span>
                        </span>
                        <span>•</span>
                        <span className="text-orange-600 font-bold flex items-center gap-0.5">
                          <span>🔥</span>
                          <span>{donor.streak}x Streak</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Points & Tier */}
                  <div className="flex flex-col items-end shrink-0">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-extrabold text-[15px] text-slate-900 tabular-nums">
                        {donor.points.toLocaleString()}
                      </span>
                      <span className="text-[11px] font-bold text-[#b70011]">Pts</span>
                    </div>

                    <span
                      className={`mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        donor.badgeLevel === 'Gold'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : donor.badgeLevel === 'Silver'
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-amber-900/10 text-amber-900 border-amber-700/30'
                      }`}
                    >
                      {donor.badgeLevel} Hero
                    </span>
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

