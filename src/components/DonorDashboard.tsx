import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  DonorProfile,
  RewardVoucher,
  DonationCamp,
  IntegratedBloodBank,
  IntegratedDonor,
} from '../types';

interface DonorDashboardProps {
  donor: DonorProfile;
  rewards: RewardVoucher[];
  onRedeemReward: (id: string) => { success: boolean; message: string; code?: string };
  onUpdateSelfTest: (updates: Partial<DonorProfile>) => void;
  onAwardReferralPoints: () => void;
  camps: DonationCamp[];
  onNavigateToChat: () => void;
  liveBloodBanks?: IntegratedBloodBank[];
  liveDonors?: IntegratedDonor[];
  onSwitchDonor?: (donorId: string) => void;
}

export const DonorDashboard: React.FC<DonorDashboardProps> = ({
  donor,
  rewards,
  onRedeemReward,
  onUpdateSelfTest,
  onAwardReferralPoints,
  camps,
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

  // Referral / Share state
  const [referralCopied, setReferralCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPassModal, setShowPassModal] = useState(false);

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

  // Eligibility evaluation logic
  const numAge = parseInt(ageInput, 10) || 0;
  const numWeight = parseFloat(weightInput) || 0;
  const numHb = parseFloat(hbInput) || 0;
  const numGap = parseInt(gapInput, 10) || 0;

  const ageOk = numAge >= 18 && numAge <= 65;
  const weightOk = numWeight >= 45;
  const hbOk = numHb >= 12.5;
  const gapOk = numGap >= 90;
  const healthOk = !hasRecentTattoo && !hasColdFever;
  const isEligible = ageOk && weightOk && hbOk && gapOk && healthOk;

  const handleSaveSelfTest = () => {
    onUpdateSelfTest({
      age: numAge,
      weight: numWeight,
      hemoglobin: numHb,
      lastDonationDaysAgo: numGap,
    });
    setIsEditingSelfTest(false);
    showToast(isEligible ? '✅ Verified: You are eligible to donate!' : '⚠️ Eligibility criteria updated.');
  };

  const handleRedeem = (id: string) => {
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
          text: 'Thank you for asking! Remember to drink plenty of fluids and maintain high-protein, iron-rich meals before your donation.\n\n⚠️ Disclaimer: Not professional medical diagnosis.',
        },
      ]);
    } finally {
      setIsBotLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 py-4 pb-28 gap-4">
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
                {liveDonors.length} registered donors loaded from Supabase
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
        <div className="grid grid-cols-2 gap-2 relative z-10 pt-3 mt-2 border-t border-white/15">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs p-2 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
            </div>
            <div>
              <p className="text-[10px] text-white/75">Total Given</p>
              <p className="font-display text-[15px] font-bold">{donor.totalDonations} Times</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs p-2 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">favorite</span>
            </div>
            <div>
              <p className="text-[10px] text-white/75">Lives Saved</p>
              <p className="font-display text-[15px] font-bold">{donor.livesSaved}+ Souls</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-[10px] text-white/70 text-right mt-2 font-mono">
          Tap to view QR & Pass Details →
        </p>
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

        <a
          href="#reward-store-section"
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-[13px] font-semibold text-slate-800 flex items-center gap-1 border border-slate-200"
        >
          <span>Redeem</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </a>
      </section>

      {/* Eligibility Self-Test Wizard (Pre-Donation Medical Screen) */}
      <section id="eligibility-section" className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <span className="material-symbols-outlined text-[20px]">ecg_heart</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-[15px] text-slate-900">Self-Test Eligibility</h3>
              <p className="text-[11px] text-slate-500">Pre-Donation Medical Screen</p>
            </div>
          </div>

          <button
            onClick={() => setIsEditingSelfTest(!isEditingSelfTest)}
            className="text-[11px] font-semibold text-blue-700 hover:underline"
          >
            {isEditingSelfTest ? 'Cancel' : 'Edit Stats'}
          </button>
        </div>

        {/* Stepper Matrix or Edit Mode */}
        {isEditingSelfTest ? (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700">Age (18-65)</label>
                <input
                  type="number"
                  value={ageInput}
                  onChange={(e) => setAgeInput(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-white border border-slate-200 mt-1"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Weight (min 45 kg)</label>
                <input
                  type="number"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-white border border-slate-200 mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700">Hb (min 12.5 g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={hbInput}
                  onChange={(e) => setHbInput(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-white border border-slate-200 mt-1"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Days Since Last (90+)</label>
                <input
                  type="number"
                  value={gapInput}
                  onChange={(e) => setGapInput(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-white border border-slate-200 mt-1"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasRecentTattoo}
                  onChange={(e) => setHasRecentTattoo(e.target.checked)}
                  className="rounded text-red-600 accent-red-600"
                />
                <span className="text-slate-700">Tattoo or piercing in last 6 months</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasColdFever}
                  onChange={(e) => setHasColdFever(e.target.checked)}
                  className="rounded text-red-600 accent-red-600"
                />
                <span className="text-slate-700">Current cold, fever, or antibiotic course</span>
              </label>
            </div>

            <button
              onClick={handleSaveSelfTest}
              className="w-full py-2 bg-[#b70011] text-white font-semibold rounded-lg"
            >
              Evaluate & Save
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {/* Step 1: Age */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Age</span>
                <span
                  className={`material-symbols-outlined text-[17px] ${
                    ageOk ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {ageOk ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <p className="font-display font-bold text-[16px] text-slate-900 mt-1">
                {donor.age} <span className="text-[11px] font-normal text-slate-500">yrs</span>
              </p>
              <p className="text-[10px] text-emerald-700 font-medium">Range 18-65 OK</p>
            </div>

            {/* Step 2: Weight */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Weight</span>
                <span
                  className={`material-symbols-outlined text-[17px] ${
                    weightOk ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {weightOk ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <p className="font-display font-bold text-[16px] text-slate-900 mt-1">
                {donor.weight} <span className="text-[11px] font-normal text-slate-500">kg</span>
              </p>
              <p className="text-[10px] text-emerald-700 font-medium">Min 45 kg OK</p>
            </div>

            {/* Step 3: Hb */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Hb Est.</span>
                <span
                  className={`material-symbols-outlined text-[17px] ${
                    hbOk ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {hbOk ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <p className="font-display font-bold text-[16px] text-slate-900 mt-1">
                {donor.hemoglobin} <span className="text-[11px] font-normal text-slate-500">g/dL</span>
              </p>
              <p className="text-[10px] text-emerald-700 font-medium">Optimal (≥12.5)</p>
            </div>

            {/* Step 4: Gap */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Gap</span>
                <span
                  className={`material-symbols-outlined text-[17px] ${
                    gapOk ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {gapOk ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <p className="font-display font-bold text-[16px] text-slate-900 mt-1">
                {donor.lastDonationDaysAgo} <span className="text-[11px] font-normal text-slate-500">days</span>
              </p>
              <p className="text-[10px] text-emerald-700 font-medium">&gt;90 days cleared</p>
            </div>
          </div>
        )}

        {/* Eligibility Verdict Banner */}
        <div
          className={`p-3 rounded-xl flex flex-col gap-2.5 ${
            isEligible
              ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-900'
              : 'bg-red-50/80 border border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">
              {isEligible ? 'health_and_safety' : 'warning'}
            </span>
            <span className="text-[13px] font-bold">
              {isEligible
                ? 'You are Eligible to Donate Today!'
                : 'Temporary Deferral: Please check criteria before donation.'}
            </span>
          </div>

          <a
            href={camps[0]?.googleMapsUrl || '#'}
            target="_blank"
            rel="noreferrer"
            className="w-full h-11 bg-[#b70011] hover:bg-red-700 text-white rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            <span>Book Appointment at Nearest Camp</span>
          </a>
        </div>
      </section>

      {/* Connected Walk-in Blood Centers (20 Facilities from Supabase) */}
      <section id="centers-section" className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[20px]">pin_drop</span>
            <h3 className="font-display font-bold text-[16px] text-[#0b1c30]">
              Walk-In Blood Centers ({liveBloodBanks.length})
            </h3>
          </div>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Open For Donors
          </span>
        </div>
        <p className="text-[12px] text-slate-500">
          Find authorized blood banks in Chhattisgarh where you can walk in and donate today.
        </p>

        {/* District Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {['All', 'Raipur', 'Bilaspur', 'Durg', 'Korba'].map((dist) => (
            <button
              key={dist}
              type="button"
              onClick={() => setCenterDistrict(dist)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                centerDistrict === dist
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {dist}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {liveBloodBanks
            .filter((b) =>
              centerDistrict === 'All'
                ? true
                : (b.district || b.city || '').toLowerCase().includes(centerDistrict.toLowerCase())
            )
            .map((b) => (
              <div
                key={b.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-[13px] text-slate-900 truncate">
                      {b.name}
                    </span>
                    {b.category && (
                      <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.2 rounded">
                        {b.category}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate">{b.address}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a
                    href={`tel:${b.contactNumber}`}
                    className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-colors"
                    title="Call Blood Center"
                  >
                    <span className="material-symbols-outlined text-[15px]">call</span>
                  </a>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(b.name + ' ' + b.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors"
                    title="Get Directions"
                  >
                    <span className="material-symbols-outlined text-[15px]">directions</span>
                  </a>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* LifeSaver Reward Store (Handwritten note requirement 5) */}
      <section id="reward-store-section" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-[16px] text-slate-900">LifeSaver Reward Store</h3>
            <p className="text-[11px] text-slate-500">Redeem points for healthcare vouchers & partner perks</p>
          </div>
          <span className="material-symbols-outlined text-slate-400">storefront</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0">
                  <span className="material-symbols-outlined text-[22px]">{reward.icon}</span>
                </div>
                <div className="min-w-0">
                  <h4 className="font-display font-bold text-[13px] text-slate-900 truncate">
                    {reward.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">{reward.partner}</p>
                  <div className="flex items-center gap-1 text-[#b70011] font-bold text-[12px] mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">toll</span>
                    <span>{reward.pointsCost} Pts</span>
                    {reward.code && (
                      <span className="ml-2 font-mono text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                        {reward.code}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleRedeem(reward.id)}
                disabled={reward.redeemed}
                className={`px-3 py-2 rounded-xl text-[12px] font-semibold flex-shrink-0 transition-all active:scale-95 ${
                  reward.redeemed
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {reward.redeemed ? 'Redeemed' : 'Redeem'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Social Donor Badge Generator & Referral System (Handwritten note 7) */}
      <section className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-[#b70011] flex items-center justify-center border border-red-100">
              <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
            </div>
            <h3 className="font-display font-bold text-[15px] text-slate-900">Share Life Saver Badge</h3>
          </div>
          <span className="text-[11px] text-[#b70011] font-bold">+150 Pts / Ref</span>
        </div>

        {/* Graphic Badge Card Preview */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-4 shadow-md border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-red-500 shadow-sm">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCiY7Jiu_Br9wXA5vUIOP-zqg8dbBramnHJbbL8mAoDvzwFiE-SVS0AJawDg9Fwe8prEZGLPWSUuUf_ixyp9-G8vsrK-2Ex_6C4xOgoLNFraEtifM1TyyAAQW3qNYfVNpn3E-vqpz7luhjR8xfmdarOG9rs4n4DuApH_xyIKqer7rtuS09LMkuHmnymu5I8n_VXXMFF976K-Lz21zfzrqixWv7ljZq_RFoTB69tQyG1OTH53GpyyW4M"
                  alt="Rahul Sharma portrait"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-red-400 font-bold tracking-wider uppercase">
                  Blood-Connect Hero
                </span>
                <p className="font-display font-bold text-[15px] truncate">{donor.name}</p>
                <p className="text-[11px] text-slate-300">Proud {donor.bloodGroup} Life Saver</p>
              </div>
            </div>

            {/* QR Code Sim */}
            <div className="w-12 h-12 bg-white p-1 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-full h-full text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h-2v2h2v-2zm-4 0h2v2h-2v-2zm4 4h-2v2h2v-2zm2-2h2v4h-2v-4zm0-4h2v2h-2v-2zm-6 4h2v2h-2v-2z"></path>
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-1 flex gap-2">
            <button
              onClick={shareToSocial}
              className="flex-1 h-10 rounded-xl bg-[#b70011] hover:bg-red-700 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[17px]">share</span>
              <span>Share to Social</span>
            </button>

            <button
              onClick={downloadBadgeImage}
              title="Download High-Res Badge PNG"
              className="h-10 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[12px] font-semibold flex items-center justify-center gap-1 border border-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[17px]">download</span>
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>

        {/* Referral Link Box */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-slate-600 text-[11px]">
            <span>Your Personal Referral URL</span>
            <span className="text-emerald-700 font-bold">Earn 150 Pts</span>
          </div>

          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200">
            <span className="text-[12px] text-slate-800 font-mono truncate">
              bloodconnect.in/ref/{donor.referralCode}
            </span>
            <button
              onClick={copyReferralUrl}
              className="flex items-center gap-1 text-[#b70011] text-[12px] font-bold px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">
                {referralCopied ? 'check' : 'content_copy'}
              </span>
              <span>{referralCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Multilingual AI Health Assistant Widget (BloodBot) */}
      <section id="bot-section" className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-[15px] text-slate-900">BloodBot AI</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                  ⚡ Free Model
                </span>
                <select
                  value={freeModel}
                  onChange={(e) => setFreeModel(e.target.value)}
                  className="text-[10px] text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none"
                >
                  <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Free)</option>
                  <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Free)</option>
                  <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
                  <option value="qwen/qwen-2.5-72b-instruct:free">Qwen 2.5 72B (Free)</option>
                  <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                  <option value="zero-cost-clinical-engine">Offline Free Engine</option>
                </select>
              </div>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200/60">
            {(['en', 'hi', 'hinglish'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setQuickBotLang(lang)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                  quickBotLang === lang
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'Hinglish'}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Stream Dialog Card */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col gap-2 max-h-56 overflow-y-auto">
          {botMessages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.role === 'bot' && (
                <div className="w-6 h-6 rounded-full bg-[#b70011] text-white flex items-center justify-center flex-shrink-0 text-[11px]">
                  🤖
                </div>
              )}
              <div
                className={`p-2.5 rounded-xl text-[12px] leading-relaxed max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-[#b70011] text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          ))}
          {isBotLoading && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 pl-8">
              <span className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
              <span>BloodBot is typing medical guidance...</span>
            </div>
          )}
        </div>

        {/* Suggested Quick Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            'Can I donate after tattoo?',
            'Hemoglobin kaise badhaye?',
            'Next blood camp nearby',
            'Pre-donation food guide',
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setQuickInput(chip);
              }}
              className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium whitespace-nowrap transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Chat Input Box */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickSend()}
              placeholder="Ask BloodBot medical question..."
              className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-[13px] focus:outline-none"
            />
            <button
              type="button"
              onClick={onNavigateToChat}
              title="Open Full Screen Health Bot"
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <span className="material-symbols-outlined text-[19px]">open_in_full</span>
            </button>
          </div>

          <button
            onClick={handleQuickSend}
            disabled={isBotLoading}
            className="w-10 h-10 bg-[#b70011] hover:bg-red-700 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[19px]">send</span>
          </button>
        </div>
      </section>

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

            {/* Sim QR code */}
            <div className="w-48 h-48 bg-slate-50 border-2 border-dashed border-red-300 rounded-2xl p-3 flex flex-col items-center justify-center">
              <svg className="w-36 h-36 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h-2v2h2v-2zm-4 0h2v2h-2v-2zm4 4h-2v2h2v-2zm2-2h2v4h-2v-4zm0-4h2v2h-2v-2zm-6 4h2v2h-2v-2z"></path>
              </svg>
              <span className="text-[10px] font-mono text-slate-500 mt-1">{donor.donorCode}</span>
            </div>

            <div className="text-center">
              <p className="font-display font-bold text-slate-900 text-base">{donor.name}</p>
              <p className="text-xs text-slate-500">Blood Group: {donor.bloodGroup} • {donor.badgeTier}</p>
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
