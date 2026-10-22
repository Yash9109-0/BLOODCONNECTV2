import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import {
  DonorProfile,
  RewardVoucher,
  DonationCamp,
  EmergencyRequest,
  IntegratedBloodBank,
  IntegratedDonor,
} from '../types';
import { HealthBotScreen } from './HealthBotScreen';
import { HospitalLocationsMap } from './HospitalLocationsMap';
import { BloodCompatibilityFinder } from './BloodCompatibilityFinder';
import { Leaderboard } from './Leaderboard';
export interface StoredCoupon {
  id: string;
  title: string;
  code?: string;
  partner: string;
  cost_points: number;
  pointsCost?: number;
  category?: string;
  description?: string;
  icon?: string;
  active?: boolean;
  created_at?: string;
}

export interface BadgeTierConfig {
  tier: 'Bronze' | 'Silver' | 'Gold';
  title: string;
  subtitle: string;
  minDonations: number;
  nextTier: string | null;
  targetDonations: number;
  progressPercent: number;
  donationsToNext: number;
  bgGradient: string;
  cardBorder: string;
  badgeGlow: string;
  textColor: string;
  pillBg: string;
  emblemGradient: string;
  emblemIcon: string;
  bannerTag: string;
  perks: string[];
}

export function getDonorBadgeTier(donationCount: number): BadgeTierConfig {
  const count = Math.max(0, donationCount || 0);

  if (count >= 5) {
    return {
      tier: 'Gold',
      title: 'Gold Hero',
      subtitle: 'Elite Master Voluntary Lifesaver',
      minDonations: 5,
      nextTier: null,
      targetDonations: 5,
      progressPercent: 100,
      donationsToNext: 0,
      bgGradient: 'from-amber-950 via-slate-950 to-yellow-950',
      cardBorder: 'border-amber-400/80 shadow-amber-500/25 shadow-xl',
      badgeGlow: 'bg-amber-400/20 text-amber-300 border-amber-400/50',
      textColor: 'text-amber-300',
      pillBg: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
      emblemGradient: 'from-amber-300 via-yellow-400 to-amber-600',
      emblemIcon: 'workspace_premium',
      bannerTag: '🏆 TOP 5% NATIONWIDE DONOR',
      perks: [
        'VIP Golden-Hour Emergency Alerts',
        'Hospital Fast-Track Priority Pass',
        'Annual Full-Body Health Checkups',
        'Official State LifeSaver Honor Roll',
      ],
    };
  }

  if (count >= 3) {
    return {
      tier: 'Silver',
      title: 'Silver Guardian',
      subtitle: 'Dedicated Regional Blood Guardian',
      minDonations: 3,
      nextTier: 'Gold Hero',
      targetDonations: 5,
      progressPercent: Math.min(100, Math.round(((count - 3) / 2) * 100)),
      donationsToNext: Math.max(0, 5 - count),
      bgGradient: 'from-slate-900 via-slate-800 to-slate-950',
      cardBorder: 'border-slate-300/80 shadow-slate-400/20 shadow-xl',
      badgeGlow: 'bg-slate-300/20 text-slate-100 border-slate-300/50',
      textColor: 'text-slate-200',
      pillBg: 'bg-slate-300/20 text-slate-100 border-slate-300/40',
      emblemGradient: 'from-slate-100 via-slate-300 to-slate-400',
      emblemIcon: 'shield',
      bannerTag: '🥈 DISTINGUISHED GUARDIAN',
      perks: [
        'Priority Emergency SOS Notifications',
        'Free Diagnostic CBC Screening',
        '+150 Pts Referral Multiplier',
        'Blood Bank Express Pass',
      ],
    };
  }

  return {
    tier: 'Bronze',
    title: 'Bronze Lifesaver',
    subtitle: 'Committed Voluntary Life Supporter',
    minDonations: 1,
    nextTier: 'Silver Guardian',
    targetDonations: 3,
    progressPercent: Math.min(100, Math.round((count / 3) * 100)),
    donationsToNext: Math.max(1, 3 - count),
    bgGradient: 'from-[#2e150d] via-[#3a1b10] to-[#1f0e09]',
    cardBorder: 'border-amber-700/80 shadow-orange-950/20 shadow-xl',
    badgeGlow: 'bg-amber-700/20 text-amber-300 border-amber-600/50',
    textColor: 'text-amber-400',
    pillBg: 'bg-amber-700/20 text-amber-300 border-amber-600/40',
    emblemGradient: 'from-amber-500 via-amber-600 to-amber-800',
    emblemIcon: 'stars',
    bannerTag: '🥉 VERIFIED VOLUNTARY DONOR',
    perks: [
      'National Voluntary Registry E-Pass',
      'Quarterly Clinical Health Tracker',
      'LifeSaver Reward Store Access',
      'Emergency WhatsApp & SMS Alerts',
    ],
  };
}

interface DonorDashboardProps {
  activeSubTab?: string;
  onSelectSubTab?: (tab: string) => void;
  donor: DonorProfile;
  rewards: RewardVoucher[];
  onRedeemReward: (id: string) => { success: boolean; message: string; code?: string };
  onUpdateSelfTest: (updates: Partial<DonorProfile>) => void;
  onAwardReferralPoints: () => void;
  camps: DonationCamp[];
  requests?: EmergencyRequest[];
  onNavigateToChat: () => void;
  liveBloodBanks?: IntegratedBloodBank[];
  liveDonors?: IntegratedDonor[];
  onSwitchDonor?: (donorId: string) => void;
}

export const DonorDashboard: React.FC<DonorDashboardProps> = ({
  activeSubTab = 'pass',
  onSelectSubTab,
  donor,
  rewards,
  onRedeemReward,
  onUpdateSelfTest,
  onAwardReferralPoints,
  camps,
  requests = [],
  onNavigateToChat,
  liveBloodBanks = [],
  liveDonors = [],
  onSwitchDonor,
}) => {
  // Centers filter state
  const [centerDistrict, setCenterDistrict] = useState('All');
  const [showCenterList, setShowCenterList] = useState(false);
  const [showDonorSelector, setShowDonorSelector] = useState(false);

  // Self-test interactive state
  const [isEditingSelfTest, setIsEditingSelfTest] = useState(false);
  const [ageInput, setAgeInput] = useState(donor.age.toString());
  const [weightInput, setWeightInput] = useState(donor.weight.toString());
  const [hbInput, setHbInput] = useState(donor.hemoglobin.toString());
  const [gapInput, setGapInput] = useState(donor.lastDonationDaysAgo.toString());
  const [hasRecentTattoo, setHasRecentTattoo] = useState(false);
  const [hasColdFever, setHasColdFever] = useState(false);

  // Synchronize interactive inputs whenever donor profile changes
  useEffect(() => {
    setAgeInput((donor.age ?? 25).toString());
    setWeightInput((donor.weight ?? 65).toString());
    setHbInput((donor.hemoglobin ?? 14.0).toString());
    setGapInput((donor.lastDonationDaysAgo ?? 100).toString());
  }, [donor.id, donor.age, donor.weight, donor.hemoglobin, donor.lastDonationDaysAgo]);

  // Referral / Share state
  const [referralCopied, setReferralCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPassModal, setShowPassModal] = useState(false);

  // Emergency Requests & Donations State
  const [requestsFilterMode, setRequestsFilterMode] = useState<'matching' | 'all'>('matching');
  const [requestCityFilter, setRequestCityFilter] = useState<string>('All');
  const [pledgingRequestId, setPledgingRequestId] = useState<string | null>(null);
  const [pledgedDonations, setPledgedDonations] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('bc_pledged_donations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedPledgedDonation, setSelectedPledgedDonation] = useState<any | null>(null);

  // Read-only Hospital Blood Inventory State for Donors
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('');
  const [inventoryBloodGroupFilter, setInventoryBloodGroupFilter] = useState<string>('All');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>('All');
  const [selectedHospitalForDetails, setSelectedHospitalForDetails] = useState<IntegratedBloodBank | null>(null);

  // Active Donation with Unique QR Code for Hospital Scan & Confirmation
  const [activeDonation, setActiveDonation] = useState<{
    id: string;
    donor_id: string;
    hospital_id?: string;
    status: 'pending' | 'confirmed';
    qr_code: string;
    points_awarded?: number;
    created_at?: string;
  }>(() => {
    try {
      const saved = localStorage.getItem(`bc_active_donation_${donor.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    const initialQr = `BC-DON-${(donor.donorCode || donor.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}-PASS`;
    return {
      id: `don-${Date.now()}`,
      donor_id: donor.id || donor.donorCode,
      status: 'pending',
      qr_code: initialQr,
      points_awarded: 0,
      created_at: new Date().toISOString(),
    };
  });
  const [isCheckingDonationStatus, setIsCheckingDonationStatus] = useState<boolean>(false);
  const [isGeneratingDonation, setIsGeneratingDonation] = useState<boolean>(false);

  // Rewards Coupons & Redemptions state loaded from server / coupons table
  const [coupons, setCoupons] = useState<StoredCoupon[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState<boolean>(true);
  const [redeemingCouponId, setRedeemingCouponId] = useState<string | null>(null);
  const [redeemedMap, setRedeemedMap] = useState<Record<string, { code: string; title: string; partner: string; pointsSpent?: number }>>(() => {
    try {
      const saved = localStorage.getItem(`bc_redeemed_coupons_${donor.id || donor.donorCode}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [unlockedCouponModal, setUnlockedCouponModal] = useState<{
    code: string;
    title: string;
    partner: string;
    cost_points: number;
    remainingPoints: number;
  } | null>(null);
  const [copiedCouponCode, setCopiedCouponCode] = useState<string | null>(null);

  // Badge Card & Share Badge state
  const [showShareBadgeModal, setShowShareBadgeModal] = useState<boolean>(false);
  const [badgeShareCopied, setBadgeShareCopied] = useState<boolean>(false);

  const currentBadgeTier = getDonorBadgeTier(donor.totalDonations);
  const donorReferralCode = donor.donorCode || donor.referralCode || 'BC-HERO';
  const donorReferralUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://bloodconnect.in'}/?ref=${encodeURIComponent(donorReferralCode)}`;
  const donorShareMessage = `🩸 I am a proud ${currentBadgeTier.title} on Blood-Connect with ${donor.totalDonations} voluntary blood donations saving ${donor.totalDonations * 3 || donor.livesSaved}+ lives! Join our lifesaver network to respond to emergency requests. Register with my donor code "${donorReferralCode}" or click here: ${donorReferralUrl}`;

  const handleShareBadgeClick = () => {
    onAwardReferralPoints();
    setShowShareBadgeModal(true);
    showToast('🎁 Badge ready to share! +150 Points awarded.');
  };

  const handleCopyBadgeShare = (textToCopy: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
    }
    setBadgeShareCopied(true);
    showToast('📋 Life Saver Badge & referral invite copied!');
    setTimeout(() => setBadgeShareCopied(false), 2500);
  };

  // Fetch coupons from /api/coupons and existing redemptions from /api/redemptions
  const loadCouponsAndRedemptions = async () => {
    setIsLoadingCoupons(true);
    try {
      const donorKey = donor.id || donor.donorCode;
      const [couponsRes, redemptionsRes] = await Promise.all([
        fetch('/api/coupons'),
        fetch(`/api/redemptions?donorId=${encodeURIComponent(donorKey)}`),
      ]);

      if (couponsRes.ok) {
        const couponsData = await couponsRes.json();
        if (couponsData.success && Array.isArray(couponsData.coupons)) {
          setCoupons(couponsData.coupons);
        }
      }

      if (redemptionsRes.ok) {
        const redData = await redemptionsRes.json();
        if (redData.success && Array.isArray(redData.redemptions)) {
          const map: Record<string, { code: string; title: string; partner: string; pointsSpent?: number }> = {};
          redData.redemptions.forEach((r: any) => {
            const cId = r.coupon_id || r.couponId;
            const code = r.coupon_code || r.couponCode || r.code;
            if (cId && code) {
              map[cId] = {
                code,
                title: r.coupon_title || r.title || 'Reward Coupon',
                partner: r.partner || 'LifeSaver Partner',
                pointsSpent: r.cost_points || r.points_spent,
              };
            }
          });
          setRedeemedMap((prev) => {
            const merged = { ...prev, ...map };
            try {
              localStorage.setItem(`bc_redeemed_coupons_${donorKey}`, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      }
    } catch (e) {
      console.warn('Notice loading coupons:', e);
    } finally {
      setIsLoadingCoupons(false);
    }
  };

  useEffect(() => {
    loadCouponsAndRedemptions();
  }, [donor.id, donor.donorCode]);

  // Sync activeDonation with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`bc_active_donation_${donor.id}`, JSON.stringify(activeDonation));
    } catch {}
  }, [activeDonation, donor.id]);

  // Update activeDonation when switching donor profiles
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bc_active_donation_${donor.id}`);
      if (saved) {
        setActiveDonation(JSON.parse(saved));
        return;
      }
    } catch {}
    const freshQr = `BC-DON-${(donor.donorCode || donor.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}-PASS`;
    setActiveDonation({
      id: `don-${Date.now()}`,
      donor_id: donor.id || donor.donorCode,
      status: 'pending',
      qr_code: freshQr,
      points_awarded: 0,
      created_at: new Date().toISOString(),
    });
  }, [donor.id, donor.donorCode]);

  // Ensure initial pending donation row exists in backend/supabase
  useEffect(() => {
    const registerInitialDonation = async () => {
      try {
        await fetch('/api/donations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donorId: donor.id || donor.donorCode,
            qrCode: activeDonation.qr_code,
          }),
        });
      } catch (err) {
        // silent
      }
    };
    registerInitialDonation();
  }, [activeDonation.qr_code, donor.id]);

  // Check donation confirmation status with server
  const handleCheckDonationStatus = async (showToastFeedback: boolean = true) => {
    if (!activeDonation?.qr_code) return;
    setIsCheckingDonationStatus(true);
    try {
      const res = await fetch(`/api/donations/status?qrCode=${encodeURIComponent(activeDonation.qr_code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.status) {
          if (data.status !== activeDonation.status) {
            setActiveDonation((prev) => ({
              ...prev,
              status: data.status,
              points_awarded: data.donation?.points_awarded || data.donation?.pointsAwarded || 150,
            }));
            if (data.status === 'confirmed') {
              confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 } });
              showToast('🎉 Hospital confirmed your donation! +150 LifeSaver points awarded!');
            }
          } else if (showToastFeedback) {
            if (data.status === 'confirmed') {
              showToast('✅ Donation Status: Confirmed & points credited!');
            } else {
              showToast('⏳ Donation Status: Pending clinical scan by hospital.');
            }
          }
        }
      }
    } catch (e) {
      if (showToastFeedback) showToast('Could not reach verification server');
    } finally {
      setIsCheckingDonationStatus(false);
    }
  };

  // Generate a fresh unique QR code for a new pending donation
  const handleGeneratePendingDonation = async () => {
    setIsGeneratingDonation(true);
    const newQr = `BC-DON-${(donor.donorCode || donor.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorId: donor.id || donor.donorCode,
          qrCode: newQr,
        }),
      });

      const newRow = {
        id: `don-${Date.now()}`,
        donor_id: donor.id || donor.donorCode,
        status: 'pending' as const,
        qr_code: newQr,
        points_awarded: 0,
        created_at: new Date().toISOString(),
      };

      if (res.ok) {
        const data = await res.json();
        if (data.donation) {
          newRow.id = data.donation.id || newRow.id;
        }
      }

      setActiveDonation(newRow);
      showToast('✅ Generated fresh pending donation QR! Ready for hospital scan.');
    } catch {
      setActiveDonation({
        id: `don-${Date.now()}`,
        donor_id: donor.id || donor.donorCode,
        status: 'pending',
        qr_code: newQr,
        points_awarded: 0,
        created_at: new Date().toISOString(),
      });
      showToast('✅ Generated fresh pending donation QR!');
    } finally {
      setIsGeneratingDonation(false);
    }
  };

  // Auto-poll status every 6s while activeDonation is pending
  useEffect(() => {
    if (activeDonation.status !== 'pending') return;
    const interval = setInterval(() => {
      handleCheckDonationStatus(false);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeDonation.qr_code, activeDonation.status]);

  // Inline Quick Bot Preview
  const [quickBotLang, setQuickBotLang] = useState<'en' | 'hi' | 'hinglish'>('hinglish');
  const [freeModel, setFreeModel] = useState<string>('google/gemini-2.0-flash-exp:free');
  const [quickInput, setQuickInput] = useState('');
  const [botMessages, setBotMessages] = useState<Array<{ role: 'user' | 'bot'; text: string }>>([
    {
      role: 'bot',
      text: 'Namaste Rahul! Aapki blood donation se related koi query ya thalassemia/anemia ke sawal ho toh puchiye.',
    },
  ]);
  const [isBotLoading, setIsBotLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Eligibility evaluation logic (Waiting period after last donation, Age, Weight, Hb)
  const numAge = parseInt(ageInput, 10) || 0;
  const numWeight = parseFloat(weightInput) || 0;
  const numHb = parseFloat(hbInput) || 0;
  const numGap = parseInt(gapInput, 10) || 0;

  // Active stats to evaluate: current inputs if editing, otherwise donor's verified stats
  const evalAge = isEditingSelfTest ? numAge : (donor.age || 0);
  const evalWeight = isEditingSelfTest ? numWeight : (donor.weight || 0);
  const evalHb = isEditingSelfTest ? numHb : (donor.hemoglobin || 0);
  const evalGap = isEditingSelfTest ? numGap : (donor.lastDonationDaysAgo || 0);

  // 1. Waiting period: standard minimum 90-day recovery gap (or first-time donor)
  const isFirstTimeDonor = (donor.totalDonations || 0) === 0 && evalGap === 0;
  const gapOk = isFirstTimeDonor || evalGap >= 90;
  const daysRemainingInGap = Math.max(0, 90 - evalGap);

  // 2. Age: 18 to 65 years
  const ageOk = evalAge >= 18 && evalAge <= 65;

  // 3. Weight: minimum 45 kg
  const weightOk = evalWeight >= 45;

  // 4. Hemoglobin: minimum 12.5 g/dL
  const hbOk = evalHb >= 12.5;

  // 5. Health conditions: no recent tattoo (6 months) and no fever/cold/antibiotics
  const healthOk = !hasRecentTattoo && !hasColdFever;

  // Overall clinical eligibility
  const isEligible = gapOk && ageOk && weightOk && hbOk && healthOk;

  // Detailed human-readable ineligible reasons
  const ineligibleReasons: string[] = [];
  if (!gapOk) {
    ineligibleReasons.push(`Waiting Period: ${daysRemainingInGap} day(s) remaining (min 90 days required)`);
  }
  if (!ageOk) {
    if (evalAge < 18) {
      ineligibleReasons.push(`Age: ${evalAge} yrs (must be at least 18 years old)`);
    } else {
      ineligibleReasons.push(`Age: ${evalAge} yrs (exceeds senior donor upper limit of 65)`);
    }
  }
  if (!weightOk) {
    ineligibleReasons.push(`Weight: ${evalWeight} kg (minimum 45 kg required, deficit: ${(45 - evalWeight).toFixed(1)} kg)`);
  }
  if (!hbOk) {
    ineligibleReasons.push(`Hemoglobin: ${evalHb} g/dL (minimum 12.5 g/dL required, deficit: ${(12.5 - evalHb).toFixed(1)} g/dL)`);
  }
  if (hasRecentTattoo) {
    ineligibleReasons.push('Recent tattoo or body piercing within last 6 months');
  }
  if (hasColdFever) {
    ineligibleReasons.push('Active cold, fever, or antibiotic treatment');
  }

  const handleSaveSelfTest = () => {
    onUpdateSelfTest({
      age: numAge,
      weight: numWeight,
      hemoglobin: numHb,
      lastDonationDaysAgo: numGap,
    });
    setIsEditingSelfTest(false);
    if (isEligible) {
      showToast('✅ Verified: You meet all clinical eligibility criteria to donate!');
    } else {
      showToast(`⚠️ Clinical Deferral: ${ineligibleReasons[0] || 'Criteria not met.'}`);
    }
  };

  // Redeem coupon through strict server route (POST /api/rewards/redeem)
  const handleRedeemCoupon = async (coupon: StoredCoupon) => {
    const cost = Number(coupon.cost_points ?? coupon.pointsCost ?? 0);
    const donorKey = donor.id || donor.donorCode;

    // 1. Block redemption on client if points are insufficient
    if (donor.points < cost) {
      const deficit = cost - donor.points;
      showToast(`⚠️ Insufficient Points: You have ${donor.points} Pts, need ${cost} Pts (${deficit} more needed).`);
      return;
    }

    setRedeemingCouponId(coupon.id);

    try {
      // 2. Server verifies points, deducts points from DB, saves redemption, and returns code
      const res = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorId: donorKey,
          couponId: coupon.id,
          sessionPoints: donor.points,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(`❌ Redemption Blocked: ${data.error || 'Server rejected redemption'}`);
        return;
      }

      // 3. Update donor points from server response
      const updatedRemaining = typeof data.remainingPoints === 'number' ? data.remainingPoints : (donor.points - cost);
      onUpdateSelfTest({ points: updatedRemaining });

      const updatedMap = {
        ...redeemedMap,
        [coupon.id]: {
          code: data.couponCode,
          title: coupon.title,
          partner: coupon.partner,
          pointsSpent: data.pointsDeducted || cost,
        },
      };
      setRedeemedMap(updatedMap);
      try {
        localStorage.setItem(`bc_redeemed_coupons_${donorKey}`, JSON.stringify(updatedMap));
      } catch {}

      // 4. Reveal unlocked coupon code in modal with copy button
      setUnlockedCouponModal({
        code: data.couponCode,
        title: coupon.title,
        partner: coupon.partner,
        cost_points: data.pointsDeducted || cost,
        remainingPoints: updatedRemaining,
      });

      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch {}

      showToast(`🎉 Redeemed ${coupon.title}! Code: ${data.couponCode}`);
    } catch (err: any) {
      showToast(`❌ Error redeeming coupon: ${err.message}`);
    } finally {
      setRedeemingCouponId(null);
    }
  };

  const handleCopyCouponCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCouponCode(code);
    showToast(`📋 Coupon code ${code} copied to clipboard!`);
    setTimeout(() => {
      setCopiedCouponCode((prev) => (prev === code ? null : prev));
    }, 2500);
  };

  const handleRedeem = (id: string) => {
    const target = coupons.find((c) => c.id === id);
    if (target) {
      handleRedeemCoupon(target);
      return;
    }
    const result = onRedeemReward(id);
    if (result.success) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }
      showToast(`🎉 ${result.message} Code: ${result.code}`);
    } else {
      showToast(result.message);
    }
  };

  const copyReferralUrl = () => {
    const url = `bloodconnect.in/ref/${donor.referralCode}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`https://${url}`);
    }
    setReferralCopied(true);
    onAwardReferralPoints();
    showToast('Referral link copied! +150 Points awarded to your reserve.');
    setTimeout(() => setReferralCopied(false), 2500);
  };

  const shareToSocial = () => {
    const shareText = `I am a verified ${donor.bloodGroup} Voluntary Life Saver on Blood-Connect! Join me and earn Lifeline points to save lives.`;
    const shareUrl = `https://bloodconnect.in/ref/${donor.referralCode}`;

    if (navigator.share) {
      navigator
        .share({
          title: 'Blood-Connect Life Saver Pass',
          text: shareText,
          url: shareUrl,
        })
        .catch(() => {});
    } else {
      copyReferralUrl();
    }
  };

  // Handle "I will donate" action -> creates pending donation row
  const handlePledgeDonation = async (req: EmergencyRequest) => {
    if (!isEligible) {
      showToast(`⚠️ Action Blocked: You are not eligible to donate. ${ineligibleReasons[0] || 'Please review eligibility criteria.'}`);
      if (onSelectSubTab) onSelectSubTab('eligibility');
      return;
    }

    setPledgingRequestId(req.id);
    const generatedQr = `BC-DON-${(donor.donorCode || donor.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorId: donor.id || donor.donorCode,
          hospitalId: req.hospitalName,
          requestId: req.id,
          qrCode: generatedQr,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.donation) {
        const updated = { ...pledgedDonations, [req.id]: data.donation };
        setPledgedDonations(updated);
        localStorage.setItem('bc_pledged_donations', JSON.stringify(updated));
        setSelectedPledgedDonation(data.donation);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
        });
        showToast(`❤️ Pledge registered for ${req.hospitalName}! Status: Pending.`);
      } else {
        throw new Error(data.error || 'Failed to register donation pledge on server');
      }
    } catch (err: any) {
      // Local fallback pending donation
      const fallbackDonation = {
        id: `don-${Date.now()}`,
        donor_id: donor.id || donor.donorCode,
        hospital_id: req.hospitalName,
        request_id: req.id,
        status: 'pending',
        qr_code: generatedQr,
        points_awarded: 0,
        created_at: new Date().toISOString(),
      };
      const updated = { ...pledgedDonations, [req.id]: fallbackDonation };
      setPledgedDonations(updated);
      localStorage.setItem('bc_pledged_donations', JSON.stringify(updated));
      setSelectedPledgedDonation(fallbackDonation);
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.8 },
      });
      showToast(`❤️ Pledge registered for ${req.hospitalName}! Status: Pending.`);
    } finally {
      setPledgingRequestId(null);
    }
  };

  // Generate & Download high resolution canvas badge
  const downloadBadgeImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 1000, 600);
    grad.addColorStop(0, '#b70011');
    grad.addColorStop(0.5, '#dc2626');
    grad.addColorStop(1, '#410002');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 600);

    // Subtle decorative grid circles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let r = 50; r <= 400; r += 50) {
      ctx.beginPath();
      ctx.arc(880, 480, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Header badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.roundRect(60, 50, 420, 45, 12);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('NATIONAL VOLUNTARY LIFE SAVER PASS', 80, 80);

    // Pass Code
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(donor.donorCode, 60, 140);

    // Donor Name
    ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(donor.name, 60, 210);

    // Location & Tier
    ctx.font = '600 24px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(`${donor.badgeTier} • ${donor.city} • Verified Donor`, 60, 255);

    // Blood Group Big Stamp
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(750, 60, 190, 190, 24);
    ctx.fill();

    ctx.fillStyle = '#b70011';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('BLOOD GROUP', 775, 105);

    ctx.font = '800 80px sans-serif';
    ctx.fillText(donor.bloodGroup, 785, 195);

    // Metrics container
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.roundRect(60, 310, 880, 140, 16);
    ctx.fill();

    // Metric 1: Total Donations
    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('Total Donations', 100, 360);
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${donor.totalDonations} Times`, 100, 410);

    // Metric 2: Lives Saved
    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('Estimated Impact', 400, 360);
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${donor.livesSaved}+ Lives Saved`, 400, 410);

    // Metric 3: Blood Points
    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('Reward Points', 700, 360);
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#85f8c4';
    ctx.fillText(`${donor.points} Pts`, 700, 410);

    // Footer
    ctx.font = '500 18px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`bloodconnect.in/ref/${donor.referralCode} • NACO Clinical Standard`, 60, 520);

    // Download trigger
    const link = document.createElement('a');
    link.download = `BloodConnect-Badge-${donor.name.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Life Saver Badge image downloaded!');
  };

  // Quick Bot message handling
  const handleQuickSend = async () => {
    if (!quickInput.trim()) return;
    const query = quickInput.trim();
    setQuickInput('');

    const newMsgs = [...botMessages, { role: 'user' as const, text: query }];
    setBotMessages(newMsgs);
    setIsBotLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          language: quickBotLang,
          model: freeModel,
          donorProfile: {
            name: donor.name,
            bloodGroup: donor.bloodGroup,
            weight: donor.weight,
            hb: donor.hemoglobin,
          },
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setBotMessages((prev) => [...prev, { role: 'bot', text: data.reply }]);
      }
    } catch (e) {
      setBotMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: 'Thank you for asking! Remember to drink plenty of fluids and maintain high-protein, iron-rich meals before your donation.\n\n⚠️ This is not medical advice, please ask a doctor.',
        },
      ]);
    } finally {
      setIsBotLoading(false);
    }
  };

  // Read-only Hospital Blood Inventory Filtering & Sorting
  const filteredInventoryHospitals = (liveBloodBanks || []).filter((h) => {
    const q = inventorySearchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      h.name.toLowerCase().includes(q) ||
      h.city.toLowerCase().includes(q) ||
      (h.district || '').toLowerCase().includes(q) ||
      (h.address || '').toLowerCase().includes(q);

    const matchCat =
      inventoryCategoryFilter === 'All' ||
      (h.category || '').toLowerCase() === inventoryCategoryFilter.toLowerCase();

    return matchSearch && matchCat;
  });

  const sortedInventoryHospitals = [...filteredInventoryHospitals].sort((a, b) => {
    if (inventoryBloodGroupFilter !== 'All') {
      const aUnits = ((a.stock || {}) as Record<string, number>)[inventoryBloodGroupFilter] || 0;
      const bUnits = ((b.stock || {}) as Record<string, number>)[inventoryBloodGroupFilter] || 0;
      return bUnits - aUnits;
    }
    const aTotal = Object.values(a.stock || {}).reduce((sum, u) => sum + (u || 0), 0);
    const bTotal = Object.values(b.stock || {}).reduce((sum, u) => sum + (u || 0), 0);
    return bTotal - aTotal;
  });

  const renderRequestsSection = (isFullPage: boolean = false) => {
    const matchingCount = requests.filter(
      (r) => r.status === 'Open' && r.bloodGroup === donor.bloodGroup
    ).length;

    const filteredRequests = requests.filter((req) => {
      if (req.status !== 'Open') return false;
      const matchGroup =
        requestsFilterMode === 'matching' ? req.bloodGroup === donor.bloodGroup : true;
      const matchCity =
        requestCityFilter === 'All' ||
        req.city.toLowerCase().trim() === requestCityFilter.toLowerCase().trim();
      return matchGroup && matchCity;
    });

    const availableCities = [
      'All',
      ...Array.from(new Set(requests.map((r) => r.city).filter(Boolean))),
    ];

    return (
      <section
        id="requests-section"
        className="flex flex-col gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-[#b70011] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] animate-pulse">emergency</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-[15px] text-slate-900">
                Emergency Blood Requests
              </h3>
              <p className="text-[11px] text-slate-500">
                Matching voluntary lifesavers with urgent patient needs
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-red-50 text-[#b70011] text-[10px] font-bold border border-red-200">
            {filteredRequests.length} Active
          </span>
        </div>

        {/* Ineligibility Warning Banner */}
        {!isEligible && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-start gap-2 min-w-0">
              <span className="material-symbols-outlined text-amber-700 text-[20px] shrink-0 mt-0.5">
                lock_clock
              </span>
              <div className="flex flex-col text-xs min-w-0">
                <span className="font-bold text-amber-950">Donation Pledging Temporarily Blocked</span>
                <span className="text-[11px] text-amber-800 leading-snug truncate">
                  {ineligibleReasons[0] || 'Clinical criteria (waiting period, age, weight, Hb) not met.'}
                  {ineligibleReasons.length > 1 && ` (+${ineligibleReasons.length - 1} more)`}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectSubTab && onSelectSubTab('eligibility')}
              className="px-2.5 py-1 bg-amber-200/90 hover:bg-amber-300 border border-amber-300 text-amber-950 rounded-lg text-[11px] font-bold transition-all shrink-0 self-start sm:self-auto shadow-2xs"
            >
              Check Eligibility →
            </button>
          </div>
        )}

        {/* Filter Bar: Matching vs All & City */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setRequestsFilterMode('matching')}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                requestsFilterMode === 'matching'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] text-red-600">bloodtype</span>
              <span>Matching {donor.bloodGroup}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-[#b70011] text-[10px]">
                {matchingCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRequestsFilterMode('all')}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                requestsFilterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All Requests</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {requests.filter((r) => r.status === 'Open').length}
              </span>
            </button>
          </div>

          {/* City Filter Pills */}
          {availableCities.length > 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
              <span className="text-[11px] text-slate-400 font-semibold pl-1 shrink-0">City:</span>
              {availableCities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setRequestCityFilter(c)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all ${
                    requestCityFilter === c
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List of Requests */}
        {filteredRequests.length === 0 ? (
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-[32px]">check_circle</span>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-slate-800">
                {requestsFilterMode === 'matching'
                  ? `No Open Requests for ${donor.bloodGroup}`
                  : 'No Emergency Requests Found'}
              </span>
              <span className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                {requestsFilterMode === 'matching'
                  ? `Blood banks currently have sufficient reserves for ${donor.bloodGroup}. You can explore all regional requests.`
                  : 'All hospital emergency blood reserves are stable.'}
              </span>
            </div>
            {requestsFilterMode === 'matching' && requests.length > 0 && (
              <button
                type="button"
                onClick={() => setRequestsFilterMode('all')}
                className="mt-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors shadow-2xs"
              >
                View All Regional Requests ({requests.length})
              </button>
            )}
          </div>
        ) : (
          <div className={isFullPage ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5' : 'flex flex-col gap-3'}>
            {filteredRequests.map((req) => {
              const isMatchingDonor = req.bloodGroup === donor.bloodGroup;
              const isPledged = Boolean(pledgedDonations[req.id]);
              const pledgedData = pledgedDonations[req.id];
              const isPledgingThis = pledgingRequestId === req.id;

              return (
                <div
                  key={req.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-3 ${
                    isMatchingDonor
                      ? 'bg-gradient-to-r from-red-50/90 to-rose-50/90 border-red-200 ring-2 ring-red-400/30'
                      : 'bg-slate-50 border-slate-200/90'
                  }`}
                >
                  {/* Top Row: Blood Group, Hospital, City, Urgency */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-[#b70011] text-white flex flex-col items-center justify-center font-bold flex-shrink-0 shadow-xs">
                        <span className="text-[15px] font-black leading-none">{req.bloodGroup}</span>
                        <span className="text-[9px] font-mono leading-none opacity-85 mt-0.5">
                          {req.unitsNeeded}U
                        </span>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-display font-bold text-[13px] text-slate-900 truncate">
                            {req.hospitalName}
                          </span>
                          {isMatchingDonor && (
                            <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-extrabold uppercase tracking-wide">
                              Your Match
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">
                            location_on
                          </span>
                          <span className="font-semibold text-slate-700">{req.city}</span>
                          {req.department && (
                            <>
                              <span>•</span>
                              <span className="truncate">{req.department}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 shadow-2xs ${
                          req.urgencyLevel.toLowerCase().includes('critical')
                            ? 'bg-red-600 text-white animate-pulse'
                            : req.urgencyLevel.toLowerCase().includes('urgent')
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {req.urgencyLevel.toLowerCase().includes('critical')
                            ? 'warning'
                            : 'schedule'}
                        </span>
                        <span>{req.urgencyLevel}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {req.createdAt || 'Just now'}
                      </span>
                    </div>
                  </div>

                  {/* Message or Patient Ref */}
                  {req.formattedMessage && (
                    <p className="text-[11px] text-slate-700 bg-white/90 p-2.5 rounded-xl border border-slate-200/70 leading-relaxed font-sans">
                      {req.formattedMessage}
                    </p>
                  )}

                  {/* Action Row */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                    {/* I Will Donate Button OR Pledge Status */}
                    {isPledged ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPledgedDonation(pledgedData)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">
                          verified
                        </span>
                        <span>Pledge Pending • Show QR</span>
                      </button>
                    ) : !isEligible ? (
                      <div className="flex flex-col gap-1 items-start">
                        <button
                          type="button"
                          disabled={true}
                          className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-not-allowed shadow-none select-none opacity-85"
                          title={`Donation Blocked: ${ineligibleReasons.join('; ')}`}
                        >
                          <span className="material-symbols-outlined text-[15px] text-slate-400">
                            block
                          </span>
                          <span>I Will Donate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectSubTab && onSelectSubTab('eligibility')}
                          className="text-[10px] text-red-600 font-semibold hover:underline flex items-center gap-0.5 text-left"
                          title="Open Eligibility Wizard to review criteria"
                        >
                          <span className="material-symbols-outlined text-[12px] shrink-0">warning</span>
                          <span className="truncate max-w-[190px]">
                            Blocked: {ineligibleReasons[0] || 'Eligibility criteria unmet'} →
                          </span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isPledgingThis}
                        onClick={() => handlePledgeDonation(req)}
                        className="px-3.5 py-1.5 bg-[#b70011] hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:bg-slate-300"
                      >
                        {isPledgingThis ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Pledging...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[15px]">
                              volunteer_activism
                            </span>
                            <span>I Will Donate</span>
                          </>
                        )}
                      </button>
                    )}

                    <div className="flex items-center gap-1.5">
                      {req.contactNumber && (
                        <a
                          href={`tel:${req.contactNumber}`}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Call Hospital Hotline"
                        >
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          <span className="hidden sm:inline">Call</span>
                        </a>
                      )}
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `🚨 EMERGENCY BLOOD REQUIRED: ${req.unitsNeeded} Units of ${req.bloodGroup} at ${req.hospitalName}, ${req.city}. Contact: ${req.contactNumber}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        title="Share on WhatsApp"
                      >
                        <span className="material-symbols-outlined text-[14px]">share</span>
                        <span className="hidden sm:inline">Share</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const currentPage = [
    'pass',
    'requests',
    'inventory',
    'eligibility',
    'centers',
    'rewards',
    'leaderboard',
    'bot',
  ].includes(activeSubTab)
    ? activeSubTab
    : 'pass';

  if (currentPage === 'bot') {
    return <HealthBotScreen donor={donor} />;
  }

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-32 sm:pb-36 gap-6">
      {/* PAGE 1: E-PASS & PROFILE */}
      {currentPage === 'pass' && (
        <div className="flex flex-col gap-5">
          {/* Donor Profile Quick Switcher bar */}
          {liveDonors.length > 0 && onSwitchDonor && (
            <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[#b70011] text-[18px]">manage_accounts</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-slate-800 truncate">
                    Active Donor: {donor.name} ({donor.bloodGroup})
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">
                    {liveDonors.length} registered voluntary donors
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDonorSelector(true)}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-[#b70011] border border-red-200 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex-shrink-0"
              >
                Switch Profile
              </button>
            </div>
          )}

          {/* 2-Column Responsive Layout on Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (5 cols on lg): Hero Pass Card, Leaderboard Callout, QR Verification Pass */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Hero Profile & Digital e-Donor ID Card */}
              <section
                id="pass-section"
                onClick={() => setShowPassModal(true)}
                className="relative w-full rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-[#b70011] via-[#dc2626] to-[#410002] text-white p-4 cursor-pointer active:scale-[0.99] transition-transform select-none"
              >
                {/* Background Watermark Pattern */}
                <div className="absolute -right-8 -bottom-10 opacity-10 pointer-events-none select-none">
                  <svg fill="currentColor" height="220" viewBox="0 0 100 100" width="220">
                    <path d="M50 0 C50 0 20 40 20 65 A30 30 0 0 0 80 65 C80 40 50 0 50 0 Z"></path>
                  </svg>
                </div>

                {/* Chip & Pass Header */}
                <div className="flex items-center justify-between relative z-10 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xs">
                      <span className="material-symbols-outlined text-[18px]">contactless</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/80 uppercase tracking-widest font-semibold">
                        National Donor Pass
                      </p>
                      <p className="font-display font-bold text-[14px] tracking-tight">{donor.donorCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-amber-500/25 backdrop-blur-md px-2.5 py-1 rounded-full text-amber-200 text-[11px] font-bold border border-amber-400/30 shadow-xs">
                      <span className="text-[13px]">🔥</span>
                      <span>{donor.streak || 3}x Streak</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[11px] font-semibold">
                      <span
                        className="material-symbols-outlined text-[15px] text-[#85f8c4]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        verified
                      </span>
                      <span>{donor.badgeTier}</span>
                    </div>
                  </div>
                </div>

                {/* Central Donor Info */}
                <div className="flex items-end justify-between relative z-10 my-2">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-white/75 font-medium">Verified Life Saver</span>
                    <h2 className="font-display text-[24px] font-bold truncate leading-tight">{donor.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px] font-medium">
                        <span className="material-symbols-outlined text-[13px]">my_location</span>
                        <span>{donor.city}</span>
                      </span>
                      <span className="text-[11px] text-white/85">Active Donor</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center bg-white text-[#b70011] p-2.5 rounded-xl shadow-md flex-shrink-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Group</span>
                    <span className="font-display text-[26px] font-extrabold leading-none">{donor.bloodGroup}</span>
                  </div>
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-3 gap-2 relative z-10 pt-3 mt-2 border-t border-white/15">
                  <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 backdrop-blur-xs p-2 rounded-xl">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">volunteer_activism</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-white/75">Total Given</p>
                      <p className="font-display text-[13px] sm:text-[15px] font-bold truncate">{donor.totalDonations} Times</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 backdrop-blur-xs p-2 rounded-xl">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">favorite</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-white/75">Lives Saved</p>
                      <p className="font-display text-[13px] sm:text-[15px] font-bold truncate">{donor.livesSaved}+ Souls</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-500/20 border border-amber-400/30 backdrop-blur-xs p-2 rounded-xl">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-300">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">local_fire_department</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-amber-200/90 font-medium">Streak</p>
                      <p className="font-display text-[13px] sm:text-[15px] font-bold text-white truncate">🔥 {donor.streak || 3}x</p>
                    </div>
                  </div>
                </div>

                <p className="relative z-10 text-[10px] text-white/70 text-right mt-2 font-mono">
                  Tap to view Full Digital Pass Card →
                </p>
              </section>

              {/* City Leaderboard Callout Card */}
              <div className="bg-gradient-to-r from-amber-500/10 via-red-500/10 to-rose-500/10 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
                    🏆
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-display font-bold text-[14px] text-slate-900">
                        City Lifesaver Leaderboard
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        🔥 {donor.streak || 3}x Streak
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">
                      View top voluntary donors ranked by points in {donor.city} and statewide
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSubTab && onSelectSubTab('leaderboard')}
                  className="px-3.5 py-2 rounded-xl bg-[#b70011] hover:bg-[#96000e] text-white text-[12px] font-bold flex items-center gap-1 transition-colors flex-shrink-0 shadow-sm"
                >
                  <span>Rankings</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>

              {/* Clinical Donation Token & Dynamic QR Section */}
              <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-[#b70011] flex items-center justify-center border border-red-100 flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-[15px] text-slate-900 flex items-center gap-2">
                        <span>Donation Verification Pass</span>
                        {activeDonation.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Pending Scan
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Hospital scans this unique QR token to log blood collection & credit 150 points.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleCheckDonationStatus(true)}
                      disabled={isCheckingDonationStatus}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="Check with server if hospital confirmed your donation"
                    >
                      <span className={`material-symbols-outlined text-[15px] ${isCheckingDonationStatus ? 'animate-spin' : ''}`}>
                        sync
                      </span>
                      <span>{isCheckingDonationStatus ? 'Checking...' : 'Check Status'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGeneratePendingDonation}
                      disabled={isGeneratingDonation}
                      className="px-3 py-1.5 rounded-lg bg-[#b70011] text-white hover:bg-[#8b0000] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                      title="Generate a fresh pending donation QR token"
                    >
                      <span className={`material-symbols-outlined text-[15px] ${isGeneratingDonation ? 'animate-spin' : ''}`}>
                        add_circle
                      </span>
                      <span>{isGeneratingDonation ? 'Generating...' : 'New QR'}</span>
                    </button>
                  </div>
                </div>

                {/* QR Code Presentation Box */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-5 p-4 rounded-xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/70">
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col items-center">
                    <QRCodeSVG
                      value={activeDonation.qr_code}
                      size={155}
                      level="H"
                      includeMargin={true}
                      className="rounded-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-2.5 text-center sm:text-left flex-1 min-w-0">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Unique Donation Token</span>
                      <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                        <code className="text-[12px] font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 truncate">
                          {activeDonation.qr_code}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(activeDonation.qr_code);
                              showToast('QR Token copied to clipboard!');
                            }
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                          title="Copy QR token string"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[12px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Donor Blood Group</span>
                        <span className="font-bold text-[#b70011]">{donor.bloodGroup}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Pass Status</span>
                        <span className={`font-semibold capitalize ${activeDonation.status === 'confirmed' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {activeDonation.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="material-symbols-outlined text-[15px] text-slate-400 flex-shrink-0">info</span>
                      <span className="truncate">
                        {activeDonation.status === 'confirmed'
                          ? 'Donation verified & recorded. 150 points added to reserve.'
                          : 'Live polling every 6s. Screen updates automatically once scanned.'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Live Points Widget & Fast Actions */}
              <section className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="relative w-11 h-11 rounded-xl bg-red-50 text-[#b70011] flex items-center justify-center border border-red-100 flex-shrink-0">
                    <span className="material-symbols-outlined text-[24px]">toll</span>
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 text-white text-[8px] font-bold items-center justify-center">
                        ✦
                      </span>
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Reward Reserve</p>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-[22px] font-extrabold text-slate-900 tabular-nums">
                        {donor.points.toLocaleString()}
                      </span>
                      <span className="text-[12px] font-bold text-[#b70011]">Pts</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectSubTab && onSelectSubTab('rewards')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-[13px] font-semibold text-slate-800 flex items-center gap-1 border border-slate-200"
                >
                  <span>Redeem</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </section>
            </div>

            {/* Right Column (7 cols on lg): Metallic Lifesaver Badge Card, Referral Box, Matching Requests, Stock Preview */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Dynamic Badge Card: Bronze, Silver, Gold by donation count */}
              <section id="lifesaver-badge-section" className="flex flex-col gap-3.5">
                {/* Main Metallic Badge Card Container */}
                <div
                  className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${currentBadgeTier.bgGradient} text-white p-5 border ${currentBadgeTier.cardBorder} transition-all duration-300`}
                >
                  {/* Ambient metallic sheen & decorative watermarks */}
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/5 blur-xl pointer-events-none" />

                  {/* Top Bar: Tier Banner & Referral Bonus Tag */}
                  <div className="flex items-center justify-between gap-2 relative z-10 mb-4 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider border uppercase ${currentBadgeTier.badgeGlow}`}>
                      {currentBadgeTier.bannerTag}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-300 bg-amber-950/60 border border-amber-700/80 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                        <span>🔥</span>
                        <span>{donor.streak || 3}x Streak</span>
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">card_giftcard</span>
                        <span>+150 Pts / Ref</span>
                      </span>
                    </div>
                  </div>

                  {/* Emblem & Donor Title */}
                  <div className="flex items-center gap-4 relative z-10 mb-4">
                    {/* Metallic 3D Emblem with Tier-Specific Glow */}
                    <div
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentBadgeTier.emblemGradient} p-0.5 shadow-lg flex-shrink-0 flex items-center justify-center`}
                    >
                      <div className="w-full h-full rounded-[14px] bg-slate-950/40 backdrop-blur-xs flex items-center justify-center border border-white/30 text-white">
                        <span className="material-symbols-outlined text-[34px] drop-shadow-md">
                          {currentBadgeTier.emblemIcon}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-display font-extrabold text-[20px] leading-tight ${currentBadgeTier.textColor}`}>
                          {currentBadgeTier.title}
                        </h3>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-white/10 border border-white/15 text-white/90">
                          {donor.bloodGroup}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-300 font-medium truncate mt-0.5">
                        {currentBadgeTier.subtitle}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Donor Code: <span className="text-white font-bold">{donor.donorCode}</span>
                      </p>
                    </div>
                  </div>

                  {/* Metrics Counters Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 relative z-10 mb-4 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Donations</p>
                      <p className="font-display text-[18px] font-extrabold text-white mt-0.5">
                        {donor.totalDonations}
                      </p>
                      <span className="text-[9px] text-slate-400 font-medium">Verified Count</span>
                    </div>
                    <div className="border-l border-white/10">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Lives Saved</p>
                      <p className="font-display text-[18px] font-extrabold text-rose-400 mt-0.5">
                        {donor.totalDonations * 3 || donor.livesSaved}+
                      </p>
                      <span className="text-[9px] text-slate-400 font-medium">Direct Impact</span>
                    </div>
                    <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Honor Points</p>
                      <p className="font-display text-[18px] font-extrabold text-emerald-400 mt-0.5">
                        {donor.points}
                      </p>
                      <span className="text-[9px] text-slate-400 font-medium">Pts Balance</span>
                    </div>
                    <div className="border-t sm:border-t-0 border-l border-white/10 pt-2 sm:pt-0">
                      <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Active Streak</p>
                      <p className="font-display text-[18px] font-extrabold text-amber-300 mt-0.5 flex items-center justify-center gap-1">
                        <span>🔥</span>
                        <span>{donor.streak || 3}x</span>
                      </p>
                      <span className="text-[9px] text-amber-200/80 font-medium">Consecutive</span>
                    </div>
                  </div>

                  {/* Tier Progress Bar to Next Tier */}
                  <div className="p-3 rounded-2xl bg-black/25 border border-white/10 relative z-10 mb-4 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">
                        {currentBadgeTier.nextTier
                          ? `Milestone to ${currentBadgeTier.nextTier}`
                          : 'Maximum Honour Tier Mastered'}
                      </span>
                      <span className={`font-bold ${currentBadgeTier.textColor}`}>
                        {currentBadgeTier.nextTier
                          ? `${donor.totalDonations} / ${currentBadgeTier.targetDonations} Donations (${currentBadgeTier.progressPercent}%)`
                          : 'Top 5% Lifetime Lifesaver'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${currentBadgeTier.emblemGradient} transition-all duration-500 rounded-full`}
                        style={{ width: `${currentBadgeTier.progressPercent}%` }}
                      />
                    </div>
                    {currentBadgeTier.nextTier ? (
                      <p className="text-[10px] text-slate-400 text-right">
                        Only <span className="font-bold text-white">{currentBadgeTier.donationsToNext}</span> more donation{currentBadgeTier.donationsToNext > 1 ? 's' : ''} to unlock <span className="text-white font-bold">{currentBadgeTier.nextTier}</span>!
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-300 text-right font-medium">
                        ★ Gold Level Master: Highest recognition in voluntary blood services.
                      </p>
                    )}
                  </div>

                  {/* Exclusive Tier Privileges List */}
                  <div className="relative z-10 mb-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                      {currentBadgeTier.tier} Tier Privileges
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentBadgeTier.perks.map((perk, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/10 text-[10px] font-medium text-slate-200 flex items-center gap-1"
                        >
                          <span className="text-emerald-400">✓</span> {perk}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions: "Share my badge" & Download High-Res PNG */}
                  <div className="flex gap-2 relative z-10 pt-1">
                    <button
                      type="button"
                      onClick={handleShareBadgeClick}
                      className="flex-1 h-11 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all"
                    >
                      <span className="material-symbols-outlined text-[19px]">share</span>
                      <span>Share my badge</span>
                    </button>

                    <button
                      type="button"
                      onClick={downloadBadgeImage}
                      title="Download High-Res Badge PNG"
                      className="h-11 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 border border-white/15 backdrop-blur-md transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      <span className="hidden sm:inline">Download</span>
                    </button>
                  </div>
                </div>

                {/* Quick Referral Invite Box */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between text-slate-700 text-xs">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#b70011]">link</span>
                      <span>Your Referral Link (Code: {donorReferralCode})</span>
                    </span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                      Earn +150 Pts
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 gap-2">
                    <span className="text-[12px] text-slate-800 font-mono truncate select-all">
                      {donorReferralUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyBadgeShare(donorReferralUrl)}
                      className="flex items-center gap-1 text-[#b70011] text-[12px] font-bold px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {badgeShareCopied ? 'check' : 'content_copy'}
                      </span>
                      <span>{badgeShareCopied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Active Emergency Requests Section Matching Donor's Blood Group */}
              {renderRequestsSection(false)}

              {/* Quick Read-Only Inventory Preview Widget */}
              <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                      <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-[14px] text-slate-900">
                        Hospital Blood Stock (Read-Only)
                      </h3>
                      <p className="text-[11px] text-slate-500">Live units across 20 regional centers</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    Read-Only
                  </span>
                </div>

                <p className="text-[12px] text-slate-600 leading-relaxed">
                  Monitor live public reserves across all 8 blood groups at connected regional blood banks and ICUs.
                </p>

                <button
                  type="button"
                  onClick={() => onSelectSubTab && onSelectSubTab('inventory')}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                >
                  <span className="material-symbols-outlined text-[16px]">table_chart</span>
                  <span>Open Full Inventory Table & Filter</span>
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* PAGE: EMERGENCY REQUESTS TAB */}
      {currentPage === 'requests' && (
        <div className="flex flex-col gap-4">
          {renderRequestsSection(true)}
        </div>
      )}

      {/* PAGE: READ-ONLY HOSPITAL INVENTORY TAB FOR DONORS */}
      {currentPage === 'inventory' && (
        <div className="flex flex-col gap-4">
          {/* Header Card */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                </div>
                <div>
                  <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">
                    Hospital Blood Inventory
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Live Regional Reserves • Read-Only Transparency View
                  </p>
                </div>
              </div>

              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                <span className="material-symbols-outlined text-[13px] text-slate-500">lock</span>
                Read-Only
              </span>
            </div>

            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-start gap-2.5 text-blue-900 text-xs">
              <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0 mt-0.5">
                visibility
              </span>
              <p className="leading-relaxed">
                <span className="font-bold">Voluntary Donor Read-Only Access: </span>
                View verified whole blood reserves across regional hospitals. Units are updated by accredited facilities and cannot be modified by donor accounts.
              </p>
            </div>
          </section>

          {/* Interactive Blood Group Compatibility & Compatible Stock Finder */}
          <BloodCompatibilityFinder
            initialGroup={donor.bloodGroup}
            bloodBanks={liveBloodBanks}
          />

          {/* Search & Blood Group Filter Card */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
            {/* Search Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Search Facility or City
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={inventorySearchQuery}
                  onChange={(e) => setInventorySearchQuery(e.target.value)}
                  placeholder="Search hospital name, city, district..."
                  className="w-full h-11 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-slate-400"
                />
                {inventorySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setInventorySearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Blood Group Filter */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Filter by Blood Group
                </label>
                {inventoryBloodGroupFilter !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setInventoryBloodGroupFilter('All')}
                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setInventoryBloodGroupFilter('All')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    inventoryBloodGroupFilter === 'All'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All Groups
                </button>

                {/* Quick chip for Donor's Own Blood Group */}
                <button
                  type="button"
                  onClick={() => setInventoryBloodGroupFilter(donor.bloodGroup)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1 ${
                    inventoryBloodGroupFilter === donor.bloodGroup
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">bloodtype</span>
                  <span>My Group ({donor.bloodGroup})</span>
                </button>

                {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((group) => {
                  if (group === donor.bloodGroup) return null;
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setInventoryBloodGroupFilter(group)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                        inventoryBloodGroupFilter === group
                          ? 'bg-[#b70011] text-white border-[#b70011] shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {group}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400">Category:</span>
              {['All', 'Govt', 'Private', 'Charitable'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setInventoryCategoryFilter(cat)}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all border ${
                    inventoryCategoryFilter === cat
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{sortedInventoryHospitals.length}</span> hospitals
              {inventoryBloodGroupFilter !== 'All' && (
                <span> for <span className="font-bold text-[#b70011]">{inventoryBloodGroupFilter}</span></span>
              )}
            </span>

            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>&le;3 Critical</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>4-10 Low</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>&gt;10 OK</span>
              </span>
            </div>
          </div>

          {/* Read-Only Table Container */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 min-w-[140px] sticky left-0 bg-slate-100/95 backdrop-blur-xs z-10 border-r border-slate-200">
                      Hospital Facility
                    </th>
                    {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => (
                      <th
                        key={bg}
                        className={`py-3 px-2 text-center min-w-[44px] transition-colors ${
                          inventoryBloodGroupFilter === bg
                            ? 'bg-red-100 text-[#b70011] font-black border-x border-red-300'
                            : ''
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span>{bg}</span>
                          {bg === donor.bloodGroup && (
                            <span className="text-[8px] text-red-600 font-bold">You</span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center min-w-[60px] bg-slate-100/90 border-l border-slate-200">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {sortedInventoryHospitals.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[32px] text-slate-300">search_off</span>
                          <span className="font-semibold text-xs text-slate-600">No hospitals matched your filters</span>
                          <span className="text-[11px] text-slate-400">Try adjusting your search query or reset blood group filters.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedInventoryHospitals.map((hospital) => {
                      const stockMap = hospital.stock || {};
                      const totalUnits = Object.values(stockMap).reduce((sum, u) => sum + (u || 0), 0);

                      return (
                        <tr
                          key={hospital.id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => setSelectedHospitalForDetails(hospital)}
                        >
                          {/* Hospital Name & Info */}
                          <td className="py-2.5 px-3 sticky left-0 bg-white group-hover:bg-slate-50/90 transition-colors z-10 border-r border-slate-200">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-slate-900 truncate max-w-[130px]" title={hospital.name}>
                                  {hospital.name}
                                </span>
                                {hospital.verified && (
                                  <span
                                    className="material-symbols-outlined text-emerald-600 text-[14px] shrink-0"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                    title="Verified Blood Centre"
                                  >
                                    verified
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <span>{hospital.city}</span>
                                {hospital.category && (
                                  <>
                                    <span>•</span>
                                    <span className="px-1 rounded bg-slate-100 text-slate-600 font-medium">
                                      {hospital.category}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Blood Units by Group (Read-Only) */}
                          {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => {
                            const units = (stockMap as Record<string, number>)[bg] || 0;
                            const isFiltered = inventoryBloodGroupFilter === bg;

                            return (
                              <td
                                key={bg}
                                className={`py-2 px-1 text-center font-mono text-xs ${
                                  isFiltered ? 'bg-red-50/60 font-bold border-x border-red-200' : ''
                                }`}
                              >
                                {units === 0 ? (
                                  <span className="text-slate-300">0</span>
                                ) : units <= 3 ? (
                                  <span
                                    className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[11px]"
                                    title={`Critical: Only ${units} units remaining`}
                                  >
                                    {units}
                                  </span>
                                ) : units <= 10 ? (
                                  <span
                                    className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[11px]"
                                    title={`Low: ${units} units remaining`}
                                  >
                                    {units}
                                  </span>
                                ) : (
                                  <span
                                    className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold text-[11px]"
                                    title={`Stable: ${units} units available`}
                                  >
                                    {units}
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          {/* Total Units Column */}
                          <td className="py-2.5 px-3 text-center border-l border-slate-200 bg-slate-50/40">
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {totalUnits}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px]">Tap any hospital row to view direct hotline & address</span>
              <span className="text-[11px] font-semibold text-slate-600">
                {liveBloodBanks?.length || 20} Facilities In Network
              </span>
            </div>
          </section>

          {/* Hospital Details Modal */}
          {selectedHospitalForDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => setSelectedHospitalForDetails(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>

                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-red-50 text-[#b70011] border border-red-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">local_hospital</span>
                  </div>
                  <div className="flex flex-col min-w-0 pr-6">
                    <h3 className="font-display font-bold text-base text-slate-900 leading-snug">
                      {selectedHospitalForDetails.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-slate-500 font-medium">
                        {selectedHospitalForDetails.city}
                      </span>
                      {selectedHospitalForDetails.category && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {selectedHospitalForDetails.category}
                        </span>
                      )}
                      {selectedHospitalForDetails.verified && (
                        <span className="text-emerald-700 font-semibold text-[10px] flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px]">verified</span> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">location_on</span>
                    <span className="text-slate-600 leading-relaxed">
                      {selectedHospitalForDetails.address || `${selectedHospitalForDetails.city}, Chhattisgarh`}
                    </span>
                  </div>
                  {selectedHospitalForDetails.operatingHours && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-[16px]">schedule</span>
                      <span className="text-slate-600">{selectedHospitalForDetails.operatingHours}</span>
                    </div>
                  )}
                  {selectedHospitalForDetails.contactNumber && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-[16px]">call</span>
                      <span className="font-mono font-bold text-slate-800">{selectedHospitalForDetails.contactNumber}</span>
                    </div>
                  )}
                </div>

                {/* Stock Summary for this Hospital */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Live Stock Breakdown
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => {
                      const units = ((selectedHospitalForDetails.stock || {}) as Record<string, number>)[bg] || 0;
                      return (
                        <div
                          key={bg}
                          className={`p-2 rounded-xl border text-center flex flex-col items-center ${
                            bg === donor.bloodGroup
                              ? 'bg-red-50 border-red-300 text-red-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-slate-500">{bg}</span>
                          <span className="font-mono text-sm font-black mt-0.5">{units}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {selectedHospitalForDetails.contactNumber && (
                    <a
                      href={`tel:${selectedHospitalForDetails.contactNumber}`}
                      className="flex-1 py-2.5 bg-[#b70011] hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">call</span>
                      <span>Call Hotline</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedHospitalForDetails(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors border border-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAGE 2: ELIGIBILITY SELF-TEST WIZARD */}
      {currentPage === 'eligibility' && (
      <section id="eligibility-section" className="flex flex-col gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        {/* Wizard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
              isEligible
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className="material-symbols-outlined text-[20px]">
                {isEligible ? 'ecg_heart' : 'health_and_safety'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-[15px] text-slate-900">
                  Eligibility Self-Test Wizard
                </h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isEligible
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isEligible ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {isEligible ? 'Eligible to Donate' : 'Deferral Active'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pre-donation clinical gates: Waiting period, age, weight & hemoglobin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingSelfTest(!isEditingSelfTest)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[15px]">
              {isEditingSelfTest ? 'close' : 'tune'}
            </span>
            <span>{isEditingSelfTest ? 'Cancel Editing' : 'Edit / Recalculate'}</span>
          </button>
        </div>

        {/* Interactive Editor Mode */}
        {isEditingSelfTest ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="font-bold text-slate-800 text-[13px]">Adjust Clinical Parameters</span>
              <span className="text-[11px] text-slate-500">Live validation updates instantly</span>
            </div>

            {/* 1. Waiting Period (Days since last donation) */}
            <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">history</span>
                  <span>1. Waiting Period After Last Donation</span>
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  gapOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {gapOk ? '✓ 90d Gap Cleared' : `✕ ${daysRemainingInGap}d remaining`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clinical requirement: Minimum 90 days recovery gap between whole blood donations.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={gapInput}
                  onChange={(e) => setGapInput(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-28 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800"
                />
                <span className="text-xs text-slate-500 font-medium">days ago</span>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
                <span className="text-slate-400">Presets:</span>
                {[
                  { label: 'First Time (0d)', val: '0' },
                  { label: '30d (Waiting)', val: '30' },
                  { label: '60d (Waiting)', val: '60' },
                  { label: '90d (Cleared)', val: '90' },
                  { label: '120d (Safe)', val: '120' },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setGapInput(p.val)}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      gapInput === p.val
                        ? 'bg-slate-800 text-white border-slate-800 font-bold'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Age */}
            <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-purple-600">badge</span>
                  <span>2. Donor Age</span>
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  ageOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {ageOk ? '✓ Valid (18-65)' : numAge < 18 ? '✕ Under 18' : '✕ Over 65'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clinical requirement: 18 to 65 years old.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="14"
                  max="90"
                  value={ageInput}
                  onChange={(e) => setAgeInput(e.target.value)}
                  className="w-28 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800"
                />
                <span className="text-xs text-slate-500 font-medium">years</span>
              </div>
            </div>

            {/* 3. Weight */}
            <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">monitor_weight</span>
                  <span>3. Body Weight</span>
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  weightOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {weightOk ? '✓ Meets Min 45 kg' : `✕ Underweight (-${(45 - numWeight).toFixed(1)}kg)`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clinical requirement: Minimum 45 kg for safe 350ml blood volume collection.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="30"
                  max="160"
                  step="0.5"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-28 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800"
                />
                <span className="text-xs text-slate-500 font-medium">kg</span>
              </div>
            </div>

            {/* 4. Hemoglobin (Hb) */}
            <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-red-600">bloodtype</span>
                  <span>4. Hemoglobin Level (Hb)</span>
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  hbOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {hbOk ? '✓ Optimal (≥12.5)' : `✕ Low (-${(12.5 - numHb).toFixed(1)} g/dL)`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clinical requirement: Minimum 12.5 g/dL to prevent donor anemia.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="8.0"
                  max="20.0"
                  step="0.1"
                  value={hbInput}
                  onChange={(e) => setHbInput(e.target.value)}
                  className="w-28 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800"
                />
                <span className="text-xs text-slate-500 font-medium">g/dL</span>
              </div>
            </div>

            {/* Health Safety Screening */}
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-700">Health History Conditions</span>
              <label className="flex items-center gap-2.5 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={hasRecentTattoo}
                  onChange={(e) => setHasRecentTattoo(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 accent-red-600"
                />
                <span className="text-slate-700 text-xs">Tattoo or body piercing in last 6 months (infection safety deferral)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={hasColdFever}
                  onChange={(e) => setHasColdFever(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 accent-red-600"
                />
                <span className="text-slate-700 text-xs">Current cold, fever, infection, or ongoing antibiotic course</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleSaveSelfTest}
              className="w-full py-2.5 bg-[#b70011] hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>Save & Update Clinical Evaluation</span>
            </button>
          </div>
        ) : (
          /* View Mode: 4 Dedicated Screening Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Card 1: Waiting Period Gap */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
              gapOk
                ? 'bg-emerald-50/50 border-emerald-200/90'
                : 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/20'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-blue-600">history</span>
                  <span>Waiting Period</span>
                </span>
                <span className={`material-symbols-outlined text-[18px] ${
                  gapOk ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {gapOk ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div>
                <p className="font-display font-black text-[18px] text-slate-900 leading-none">
                  {isFirstTimeDonor ? 'First-Time' : `${evalGap} Days`}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Standard: 90+ days gap between donations
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block w-fit ${
                gapOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {gapOk ? '✓ 90d Recovery Cleared' : `✕ Waiting: ${daysRemainingInGap}d remaining`}
              </span>
            </div>

            {/* Card 2: Age */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
              ageOk
                ? 'bg-emerald-50/50 border-emerald-200/90'
                : 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/20'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-purple-600">badge</span>
                  <span>Donor Age</span>
                </span>
                <span className={`material-symbols-outlined text-[18px] ${
                  ageOk ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {ageOk ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div>
                <p className="font-display font-black text-[18px] text-slate-900 leading-none">
                  {evalAge} <span className="text-[12px] font-normal text-slate-500">years</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Standard: 18 to 65 years old
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block w-fit ${
                ageOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {ageOk ? '✓ In Legal Bracket (18-65)' : evalAge < 18 ? '✕ Under 18' : '✕ Over 65'}
              </span>
            </div>

            {/* Card 3: Weight */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
              weightOk
                ? 'bg-emerald-50/50 border-emerald-200/90'
                : 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/20'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-amber-600">monitor_weight</span>
                  <span>Body Weight</span>
                </span>
                <span className={`material-symbols-outlined text-[18px] ${
                  weightOk ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {weightOk ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div>
                <p className="font-display font-black text-[18px] text-slate-900 leading-none">
                  {evalWeight} <span className="text-[12px] font-normal text-slate-500">kg</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Standard: Minimum 45 kg required
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block w-fit ${
                weightOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {weightOk ? '✓ Meets Min 45 kg Standard' : `✕ Deficit: ${(45 - evalWeight).toFixed(1)} kg`}
              </span>
            </div>

            {/* Card 4: Hemoglobin */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
              hbOk
                ? 'bg-emerald-50/50 border-emerald-200/90'
                : 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/20'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-red-600">bloodtype</span>
                  <span>Hemoglobin (Hb)</span>
                </span>
                <span className={`material-symbols-outlined text-[18px] ${
                  hbOk ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {hbOk ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div>
                <p className="font-display font-black text-[18px] text-slate-900 leading-none">
                  {evalHb} <span className="text-[12px] font-normal text-slate-500">g/dL</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Standard: Minimum 12.5 g/dL required
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block w-fit ${
                hbOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {hbOk ? '✓ Optimal (≥12.5 g/dL)' : `✕ Low: ${(12.5 - evalHb).toFixed(1)} g/dL needed`}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Clinical Verdict Banner */}
        <div
          className={`p-4 rounded-xl flex flex-col gap-3 transition-colors ${
            isEligible
              ? 'bg-emerald-50/90 border border-emerald-200 text-emerald-950 shadow-2xs'
              : 'bg-rose-50 border border-rose-200 text-rose-950 shadow-2xs'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <span className={`material-symbols-outlined text-[24px] shrink-0 mt-0.5 ${
              isEligible ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {isEligible ? 'verified_user' : 'gpp_bad'}
            </span>
            <div className="flex flex-col gap-1">
              <h4 className="font-display font-bold text-[14px]">
                {isEligible
                  ? 'You are Clinically Eligible to Donate Today!'
                  : 'Temporary Clinical Deferral Active'}
              </h4>
              <p className="text-[12px] text-slate-700 leading-relaxed">
                {isEligible
                  ? 'All 4 clinical gates (waiting period after last donation, age, weight, and Hb) are cleared. The "I Will Donate" button is active.'
                  : 'For donor health and recipient safety, the "I Will Donate" button is blocked until the following criteria are met:'}
              </p>

              {/* Ineligible Reasons Breakdown */}
              {!isEligible && (
                <ul className="mt-1 space-y-1 text-[11px] font-medium text-rose-900 bg-white/70 p-2.5 rounded-lg border border-rose-200">
                  {ineligibleReasons.map((reason, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-rose-600 shrink-0">
                        cancel
                      </span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-slate-200/60">
            {isEligible ? (
              <button
                type="button"
                onClick={() => onSelectSubTab && onSelectSubTab('pass')}
                className="w-full sm:w-auto flex-1 h-10 bg-[#b70011] hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[17px]">volunteer_activism</span>
                <span>Proceed to Emergency Requests</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingSelfTest(true)}
                className="w-full sm:w-auto flex-1 h-10 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[17px]">edit_note</span>
                <span>Update / Recalculate Stats</span>
              </button>
            )}

            <a
              href={camps[0]?.googleMapsUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-4 h-10 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              <span>Find Nearest Blood Camp</span>
            </a>
          </div>
        </div>
      </section>
      )}

      {/* PAGE 3: WALK-IN BLOOD CENTERS */}
      {currentPage === 'centers' && (
        <section id="centers-section" className="flex flex-col gap-3">
          <HospitalLocationsMap bloodBanks={liveBloodBanks} />
        </section>
      )}

      {/* PAGE 4: LIFESAVER REWARD STORE */}
      {currentPage === 'rewards' && (
        <>
          <section className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl bg-red-50 text-[#b70011] flex items-center justify-center border border-red-100 flex-shrink-0">
                <span className="material-symbols-outlined text-[24px]">toll</span>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 text-white text-[8px] font-bold items-center justify-center">
                    ✦
                  </span>
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Available Balance</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[22px] font-extrabold text-slate-900 tabular-nums">
                    {donor.points.toLocaleString()}
                  </span>
                  <span className="text-[12px] font-bold text-[#b70011]">Pts</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadCouponsAndRedemptions}
                title="Refresh Coupons from Database"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center"
              >
                <span className={`material-symbols-outlined text-[18px] ${isLoadingCoupons ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                {donor.badgeTier}
              </span>
            </div>
          </section>

          <section id="reward-store-section" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-[16px] text-slate-900">LifeSaver Reward Store</h3>
                <p className="text-[11px] text-slate-500">Live coupons loaded from database • Deducts points on server</p>
              </div>
              <span className="material-symbols-outlined text-slate-400">storefront</span>
            </div>

            {isLoadingCoupons && coupons.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-3xl animate-spin">progress_activity</span>
                <p className="text-sm font-semibold text-slate-700">Loading coupons from database...</p>
                <p className="text-xs text-slate-500">Fetching partner healthcare vouchers & active redemptions</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(coupons.length > 0 ? coupons : (rewards as any)).map((coupon: any) => {
                  const cost = Number(coupon.cost_points ?? coupon.pointsCost ?? 0);
                  const isRedeemed = Boolean(redeemedMap[coupon.id] || coupon.redeemed);
                  const redeemedInfo = redeemedMap[coupon.id];
                  const codeToShow = redeemedInfo?.code || coupon.code;
                  const hasEnoughPoints = donor.points >= cost;
                  const deficit = cost - donor.points;
                  const isRedeeming = redeemingCouponId === coupon.id;

                  return (
                    <div
                      key={coupon.id}
                      className={`p-4 rounded-2xl bg-white border transition-all ${
                        isRedeemed
                          ? 'border-emerald-200 bg-emerald-50/20 shadow-xs'
                          : !hasEnoughPoints
                          ? 'border-slate-200/80 opacity-90'
                          : 'border-slate-200/90 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isRedeemed
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-red-50 text-[#b70011] border border-red-100'
                          }`}>
                            <span className="material-symbols-outlined text-[24px]">
                              {coupon.icon || (isRedeemed ? 'verified' : 'local_activity')}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                                {coupon.category || 'Healthcare'}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {coupon.partner}
                              </span>
                            </div>

                            <h4 className="font-display font-bold text-[14px] text-slate-900 mt-0.5">
                              {coupon.title}
                            </h4>

                            {coupon.description && (
                              <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                                {coupon.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[#b70011] font-bold text-[13px]">
                                <span className="material-symbols-outlined text-[15px]">toll</span>
                                <span>{cost} Pts</span>
                              </span>

                              {/* Revealed Coupon Code Badge */}
                              {isRedeemed && codeToShow && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Code:</span>
                                  <span className="font-mono text-[12px] font-extrabold select-all">
                                    {codeToShow}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCouponCode(codeToShow)}
                                    className="p-0.5 hover:bg-emerald-200 rounded text-emerald-800 transition-colors"
                                    title="Copy coupon code"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">
                                      {copiedCouponCode === codeToShow ? 'check' : 'content_copy'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Area: Blocked when insufficient points vs Active vs Redeemed */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          {isRedeemed ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[12px] font-bold shadow-xs">
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                              <span>Redeemed</span>
                            </div>
                          ) : !hasEnoughPoints ? (
                            <button
                              type="button"
                              disabled={true}
                              title={`Requires ${cost} Pts. You currently have ${donor.points} Pts (Deficit: ${deficit} Pts).`}
                              className="px-3.5 py-2 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center gap-1.5 select-none"
                            >
                              <span className="material-symbols-outlined text-[14px]">lock</span>
                              <span>Need {deficit} more pts</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRedeemCoupon(coupon)}
                              disabled={isRedeeming}
                              className="px-4 py-2 rounded-xl text-[12px] font-bold bg-[#b70011] hover:bg-red-700 active:scale-95 text-white shadow-sm transition-all flex items-center gap-1.5"
                            >
                              {isRedeeming ? (
                                <>
                                  <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                                  <span>Deducting...</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[15px]">redeem</span>
                                  <span>Redeem</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}



      {/* PAGE: CITY LEADERBOARD */}
      {currentPage === 'leaderboard' && (
        <Leaderboard
          liveDonors={liveDonors}
          currentDonor={donor}
          onSelectSubTab={onSelectSubTab}
        />
      )}

      {/* Modal: Share My Life Saver Badge */}
      {showShareBadgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${currentBadgeTier.emblemGradient} text-white flex items-center justify-center shadow-xs`}>
                  <span className="material-symbols-outlined text-[20px]">
                    {currentBadgeTier.emblemIcon}
                  </span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-[16px] text-slate-900">
                    Share {currentBadgeTier.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Invite new voluntary donors & save lives together
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareBadgeModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Badge Mini Preview Card */}
            <div className={`p-4 rounded-2xl bg-gradient-to-br ${currentBadgeTier.bgGradient} text-white border ${currentBadgeTier.cardBorder} flex items-center justify-between gap-3 shadow-md`}>
              <div className="min-w-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${currentBadgeTier.textColor}`}>
                  {currentBadgeTier.bannerTag}
                </span>
                <p className="font-display font-extrabold text-[16px] truncate">{donor.name}</p>
                <p className="text-[11px] text-slate-300">
                  {donor.bloodGroup} • {donor.totalDonations} Donations • Code: <span className="font-mono text-white font-bold">{donorReferralCode}</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                <span className="material-symbols-outlined text-[28px]">
                  {currentBadgeTier.emblemIcon}
                </span>
              </div>
            </div>

            {/* Share Message text area */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Invitation Message
              </label>
              <textarea
                readOnly
                value={donorShareMessage}
                rows={4}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-[12px] leading-relaxed resize-none focus:outline-none"
              />
            </div>

            {/* Share Channels */}
            <div className="grid grid-cols-2 gap-2">
              {/* WhatsApp Share */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(donorShareMessage)}`}
                target="_blank"
                rel="noreferrer"
                className="h-11 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                <span>WhatsApp</span>
              </a>

              {/* Telegram Share */}
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(donorReferralUrl)}&text=${encodeURIComponent(donorShareMessage)}`}
                target="_blank"
                rel="noreferrer"
                className="h-11 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>Telegram</span>
              </a>
            </div>

            {/* Copy & Native Share */}
            <div className="flex gap-2">
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.share({
                      title: `${currentBadgeTier.title} - Blood-Connect`,
                      text: donorShareMessage,
                      url: donorReferralUrl,
                    }).catch(() => {});
                  }}
                  className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[12px] font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">devices</span>
                  <span>Device Share</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCopyBadgeShare(donorShareMessage)}
                className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {badgeShareCopied ? 'check' : 'content_copy'}
                </span>
                <span>{badgeShareCopied ? 'Copied!' : 'Copy Invite Message'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Digital Pass & QR Code */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display font-bold text-[16px] text-slate-900">National e-Donor Pass</h3>
              <button
                onClick={() => setShowPassModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Active Donation QR code */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center">
              <div className="bg-white p-2 rounded-xl shadow-xs border border-slate-200">
                <QRCodeSVG
                  value={activeDonation.qr_code}
                  size={150}
                  level="H"
                  includeMargin={true}
                  className="rounded-lg"
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-700 mt-2.5 bg-slate-200/80 px-2 py-0.5 rounded">
                {activeDonation.qr_code}
              </span>
              <div className="mt-2">
                {activeDonation.status === 'confirmed' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Pending Scan
                  </span>
                )}
              </div>
            </div>

            <div className="text-center">
              <p className="font-display font-bold text-slate-900 text-base">{donor.name}</p>
              <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-slate-500">
                  Blood Group: <strong className="text-slate-800">{donor.bloodGroup}</strong> • {donor.badgeTier}
                </span>
                <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-amber-700 text-[11px] font-bold">
                  <span>🔥</span>
                  <span>{donor.streak || 3}x Donation Streak</span>
                </span>
              </div>
            </div>

            <button
              onClick={downloadBadgeImage}
              className="w-full py-2.5 bg-[#b70011] text-white font-semibold text-xs rounded-xl"
            >
              Download Verified Pass Card (PNG)
            </button>
          </div>
        </div>
      )}

      {/* Modal: Select Registered Donor from Supabase */}
      {showDonorSelector && onSwitchDonor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-2xl border border-slate-200 flex flex-col gap-3 max-h-[85vh]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#b70011] text-[20px]">group</span>
                <h3 className="font-display font-bold text-[15px] text-slate-900">
                  Switch Active Donor Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDonorSelector(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Select any of the 1,000 registered voluntary donors from Supabase to preview their e-Donor pass, blood group, points, and test results.
            </p>

            {/* Donor List */}
            <div className="space-y-1.5 overflow-y-auto pr-1">
              {liveDonors.slice(0, 30).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onSwitchDonor(d.id);
                    setShowDonorSelector(false);
                    showToast(`Switched active donor profile to ${d.name} (${d.bloodGroup})`);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    donor.id === d.id || donor.name === d.name
                      ? 'bg-red-50/80 border-red-300'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-bold text-[13px] text-slate-900 truncate">
                      {d.name}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">
                      {d.city} • {d.phone}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="bg-red-100 text-[#b70011] text-[11px] font-bold px-2 py-0.5 rounded">
                      {d.bloodGroup}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Select →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending Donation Confirmation Modal */}
      {selectedPledgedDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setSelectedPledgedDonation(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">volunteer_activism</span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Donation Pledge Registered!
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Status: Pending Verification
                </span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Facility:</span>
                <span className="font-bold text-slate-800">
                  {selectedPledgedDonation.hospital_id || selectedPledgedDonation.hospitalId || 'Hospital Blood Bank'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Pledged By:</span>
                <span className="font-medium text-slate-800">
                  {donor.name} ({donor.bloodGroup})
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Points on Confirmation:</span>
                <span className="font-bold text-[#b70011]">+150 LifeSaver Pts</span>
              </div>
            </div>

            {/* QR Code Presentation Box */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center gap-2">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                <QRCodeSVG
                  value={selectedPledgedDonation.qr_code || selectedPledgedDonation.qrCode}
                  size={150}
                  level="H"
                  includeMargin={true}
                  className="rounded-lg bg-white"
                />
              </div>
              <div className="font-mono font-bold text-xs tracking-wider text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 break-all select-all">
                {selectedPledgedDonation.qr_code || selectedPledgedDonation.qrCode}
              </div>
              <p className="text-[11px] text-slate-500 max-w-[240px]">
                Present this QR token or your E-Pass to the blood bank coordinator to confirm your donation.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const token = selectedPledgedDonation.qr_code || selectedPledgedDonation.qrCode;
                  if (token) {
                    navigator.clipboard.writeText(token);
                    showToast('📋 Donation QR token copied to clipboard!');
                  }
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copy Token</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPledgedDonation(null)}
                className="flex-1 py-2.5 bg-[#b70011] hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Unlocked Reward Coupon Code */}
      {unlockedCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[32px]">card_giftcard</span>
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-2">
              🎉 Redemption Confirmed
            </span>

            <h3 className="font-display font-extrabold text-[17px] text-slate-900 leading-snug">
              {unlockedCouponModal.title}
            </h3>
            <p className="text-[12px] text-slate-500 mb-4">
              Partner: {unlockedCouponModal.partner}
            </p>

            {/* Code presentation container */}
            <div className="w-full bg-slate-50 border-2 border-dashed border-emerald-300 rounded-2xl p-4 mb-4 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Your Exclusive Voucher Code
              </span>
              <div className="font-mono text-[22px] font-black text-slate-900 tracking-wider select-all py-1">
                {unlockedCouponModal.code}
              </div>
              <button
                type="button"
                onClick={() => handleCopyCouponCode(unlockedCouponModal.code)}
                className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copiedCouponCode === unlockedCouponModal.code ? 'check' : 'content_copy'}
                </span>
                <span>{copiedCouponCode === unlockedCouponModal.code ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Server-deducted points summary */}
            <div className="w-full flex items-center justify-between text-[11px] text-slate-600 bg-slate-100 px-3 py-2 rounded-xl mb-2">
              <span>Points Deducted (Server):</span>
              <span className="font-bold text-[#b70011]">-{unlockedCouponModal.cost_points} Pts</span>
            </div>

            <div className="w-full flex items-center justify-between text-[11px] text-slate-600 bg-slate-100 px-3 py-2 rounded-xl mb-5">
              <span>Remaining Balance:</span>
              <span className="font-bold text-slate-900">{unlockedCouponModal.remainingPoints} Pts</span>
            </div>

            <button
              type="button"
              onClick={() => setUnlockedCouponModal(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-bold transition-all shadow-sm"
            >
              Done & Save Voucher
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
