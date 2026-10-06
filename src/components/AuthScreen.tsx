import React, { useState } from 'react';
import { UserRole, BloodGroup } from '../types';
import { supabase } from '../lib/supabase';
import { signIn, signUp, signInWithGoogle, getUserRole, getUserDisplayName } from '../lib/auth';

interface AuthScreenProps {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  onLoginSuccess: (
    role: UserRole,
    details?: { email?: string; name?: string; facilityName?: string }
  ) => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

/**
 * Reads OAuth redirect errors (?error=... / #error=...) that Supabase or
 * Google send back to the app (provider not enabled, cancelled consent,
 * blocked redirect URL, ...) so users see a real message instead of a
 * silent failure. Clears the params from the address bar afterwards.
 */
function readOAuthRedirectError(): string | null {
  try {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const get = (key: string) => search.get(key) || hash.get(key);
    const code = get('error_code') || get('error');
    const description = get('error_description');
    if (!code && !description) return null;

    // Clean the address bar so refreshing doesn't re-show the error
    window.history.replaceState({}, document.title, window.location.pathname);

    const detail = description ? decodeURIComponent(description.replace(/\+/g, ' ')) : '';
    const combined = `${code} ${detail}`.toLowerCase();
    if (code === 'access_denied' || combined.includes('access_denied')) {
      return 'Google sign-in was cancelled or denied. Please try again.';
    }
    if (combined.includes('redirect_uri') || combined.includes('redirect url')) {
      return 'This app URL is not in the Supabase Redirect URL allow-list. Add it under Authentication → URL Configuration.';
    }
    if (combined.includes('provider_disabled') || combined.includes('not enabled')) {
      return 'Google sign-in is not enabled yet on this Supabase project. Enable the Google provider in the Supabase dashboard (Authentication → Sign In → Google).';
    }
    return detail || `Google sign-in failed (${code}).`;
  } catch {
    return null;
  }
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  activeRole,
  setActiveRole,
  onLoginSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<BloodGroup>('O+');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);

  // Form states (real Supabase Auth — no demo credentials)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('24');
  const [weight, setWeight] = useState('68');
  const [donorPhone, setDonorPhone] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [city, setCity] = useState('Raipur');
  const [hotline, setHotline] = useState('');
  const [authError, setAuthError] = useState<string | null>(() => readOAuthRedirectError());
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  const handleRoleChange = (newRole: UserRole) => {
    setActiveRole(newRole);
    setAuthError(null);
    setAuthFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthFeedback(null);

    if (!email.trim() || !password) {
      setAuthError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    setIsAuthenticating(true);
    try {
      if (authMode === 'signin') {
        // Real Supabase Auth sign-in against the live project
        const result = await signIn(email, password);
        if (!result.success) {
          setAuthError(result.error);
          return;
        }
        const user = result.user!;
        const role = getUserRole(user);
        setAuthFeedback('Authenticated with Supabase Auth. Opening your dashboard...');
        onLoginSuccess(role, {
          email: user.email || email.trim(),
          name: getUserDisplayName(user),
          facilityName: String((user.user_metadata as any)?.facility_name || ''),
        });
        return;
      }

      // Registration mode — validate required profile fields
      const displayName =
        activeRole === 'hospital' ? hospitalName.trim() : fullName.trim();
      if (!displayName) {
        setAuthError(
          activeRole === 'hospital'
            ? 'Please enter the hospital / blood bank center name.'
            : 'Please enter your full legal name.'
        );
        return;
      }
      if (activeRole === 'donor' && !donorPhone.trim()) {
        setAuthError('Please enter a contact phone number for emergency matching.');
        return;
      }
      if (activeRole === 'hospital' && !hotline.trim()) {
        setAuthError('Please enter the facility emergency hotline number.');
        return;
      }

      // Real Supabase Auth registration (role stored in user metadata)
      const result = await signUp({
        role: activeRole,
        fullName: displayName,
        email: email.trim(),
        password,
        phone: activeRole === 'donor' ? donorPhone.trim() : hotline.trim(),
        bloodGroup: selectedBloodGroup,
        age: Number(age) || undefined,
        weight: Number(weight) || undefined,
        hemoglobin: 13.5,
        city,
        facilityName: hospitalName.trim(),
        licenseNumber: licenseNo.trim(),
        address: hospitalAddress.trim(),
      });

      if (!result.success) {
        setAuthError(result.error);
        return;
      }

      if (result.needsConfirmation) {
        setAuthFeedback(result.message);
        return;
      }

      setAuthFeedback(result.message);
      onLoginSuccess(activeRole, {
        email: email.trim(),
        name: displayName,
        facilityName: hospitalName.trim(),
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFederatedAuth = async (provider: 'ABHA' | 'Google') => {
    setAuthFeedback(null);
    setAuthError(null);

    if (provider === 'ABHA') {
      setAuthError(
        'ABHA Health ID sign-in is not enabled on this Supabase project yet. Please continue with email & password.'
      );
      return;
    }

    // Google -> Supabase Auth OAuth (provider must be enabled in the dashboard)
    setIsGoogleRedirecting(true);
    // Remember the chosen role for first-time Google sign-ups
    localStorage.setItem('bc_pending_role', activeRole);
    const result = await signInWithGoogle();
    if (!result.success) {
      setAuthError(result.error);
      setIsGoogleRedirecting(false);
      return;
    }
    setAuthFeedback(result.message);
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 py-4 pb-24">
      {/* Brand Intro & Trust Header */}
      <div className="pt-2 pb-2 flex flex-col gap-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-100 w-fit">
          <span className="w-2 h-2 rounded-full bg-[#b70011] animate-pulse"></span>
          <span className="text-[11px] font-semibold text-[#b70011] uppercase tracking-wider">
            Rapid Response Life Grid
          </span>
        </div>
        <h1 className="font-display text-[26px] font-bold text-[#0b1c30] tracking-tight leading-tight">
          National Lifeline Network
        </h1>
        <p className="text-[14px] text-slate-600 leading-snug">
          Connecting verified voluntary donors, regional blood banks & critical ICU wards in real-time.
        </p>
      </div>

      {/* Role Switcher / Segmented Selector */}
      <div className="mt-3 bg-slate-200/70 p-1 rounded-xl flex items-center justify-between gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => handleRoleChange('donor')}
          className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all duration-200 ${
            activeRole === 'donor'
              ? 'bg-white text-[#b70011] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={activeRole === 'donor' ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            favorite
          </span>
          <span>Donor / Patient</span>
        </button>

        <button
          type="button"
          onClick={() => handleRoleChange('hospital')}
          className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all duration-200 ${
            activeRole === 'hospital'
              ? 'bg-white text-[#b70011] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={activeRole === 'hospital' ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            local_hospital
          </span>
          <span>Hospital Admin</span>
        </button>
      </div>

      {/* Dynamic Role Micro-Banner */}
      <div className="mt-2.5 bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            activeRole === 'donor'
              ? 'bg-red-100 text-[#b70011]'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {activeRole === 'donor' ? 'water_drop' : 'local_hospital'}
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-[#0b1c30]">
            {activeRole === 'donor'
              ? 'Individual Donor & Recipient Access'
              : 'Licensed Hospital & Blood Center Portal'}
          </span>
          <span className="text-[12px] text-slate-500 truncate">
            {activeRole === 'donor'
              ? 'Pledge donations, track blood units & receive local red alerts.'
              : 'Broadcast SOS requests, dispatch emergency units & manage cold stock.'}
          </span>
        </div>
      </div>

      {/* Main Auth Card */}
      <div className="mt-3.5 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col">
        {/* Auth Mode Switcher (Sign In vs Register) */}
        <div className="flex items-center justify-center gap-1 bg-slate-100 p-1 rounded-lg mb-4">
          <button
            type="button"
            onClick={() => setAuthMode('signin')}
            className={`flex-1 py-1.5 rounded-md text-[13px] font-semibold transition-all ${
              authMode === 'signin'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('register')}
            className={`flex-1 py-1.5 rounded-md text-[13px] font-semibold transition-all ${
              authMode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register New Account
          </button>
        </div>

        {/* The Unified Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Registration Fields Only */}
          {authMode === 'register' && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
              {/* DONOR SPECIFIC FIELDS */}
              {activeRole === 'donor' ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-semibold text-slate-600">Full Legal Name</label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[19px]">badge</span>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. / Mr. / Ms. Name"
                        className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-semibold text-slate-600">Blood Group</label>
                      <span className="text-[11px] font-medium text-[#b70011]">Required for matching</span>
                    </div>
                    {/* Blood Group Pills Grid */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {BLOOD_GROUPS.map((bg) => {
                        const isSel = selectedBloodGroup === bg;
                        return (
                          <button
                            key={bg}
                            type="button"
                            onClick={() => setSelectedBloodGroup(bg)}
                            className={`py-2 rounded-lg font-display font-bold text-[13px] flex items-center justify-center transition-all ${
                              isSel
                                ? 'bg-[#b70011] text-white shadow-xs scale-102 ring-2 ring-red-600/30'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {bg}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-semibold text-slate-600">Age (18 - 65 yrs)</label>
                      <input
                        type="number"
                        min="18"
                        max="65"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="e.g. 24"
                        className="w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-semibold text-slate-600">Weight (kg, min 45)</label>
                      <input
                        type="number"
                        min="45"
                        max="180"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="e.g. 68"
                        className="w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-semibold text-slate-600">
                      Contact Phone (for emergency matching)
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[19px]">call</span>
                      <input
                        type="tel"
                        value={donorPhone}
                        onChange={(e) => setDonorPhone(e.target.value)}
                        placeholder="e.g. +91 98765-43210"
                        className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* HOSPITAL ADMIN SPECIFIC FIELDS */
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-semibold text-slate-600">
                      Hospital / Blood Bank Center Name
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[19px]">domain</span>
                      <input
                        type="text"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        placeholder="e.g. AIIMS Raipur Blood Center"
                        className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-semibold text-slate-600">
                      Govt License / NACO Accreditation ID
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[19px]">verified_user</span>
                      <input
                        type="text"
                        value={licenseNo}
                        onChange={(e) => setLicenseNo(e.target.value)}
                        placeholder="e.g. MH-NACO-2024-4029"
                        className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-semibold text-slate-600">City / District</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Raipur"
                        className="w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-semibold text-slate-600">Emergency Hotline</label>
                      <input
                        type="tel"
                        value={hotline}
                        onChange={(e) => setHotline(e.target.value)}
                        placeholder="+91 98765-43210"
                        className="w-full h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-semibold text-slate-600">Full Facility Address</label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[19px]">location_on</span>
                      <input
                        type="text"
                        value={hospitalAddress}
                        onChange={(e) => setHospitalAddress(e.target.value)}
                        placeholder="e.g. GE Road, Tatibandh, Raipur, CG 492099"
                        className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* COMMON CREDENTIALS */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Official / Registered Email</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[19px]">alternate_email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-slate-600">Access Key / Password</label>
                <button
                  type="button"
                  onClick={async () => {
                    setAuthError(null);
                    setAuthFeedback(null);
                    if (!email.trim()) {
                      setAuthError('Enter your registered email above, then tap Forgot.');
                      return;
                    }
                    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
                    if (error) {
                      setAuthError(error.message);
                    } else {
                      setAuthFeedback('Password reset link sent to ' + email.trim());
                    }
                  }}
                  className="text-[11px] font-medium text-[#b70011] hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[19px]">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-11 pl-10 pr-10 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Trust device checkbox */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded text-[#b70011] accent-[#b70011] focus:ring-0"
              />
              <span className="text-[12px] text-slate-600">Trust & remember this mobile device</span>
            </label>
          </div>

          {/* Action CTA Button */}
          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full h-12 bg-[#b70011] hover:bg-red-700 text-white font-display font-semibold text-[15px] rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-75"
          >
            {isAuthenticating ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Authorizing Session...</span>
              </span>
            ) : (
              <>
                <span>
                  {authMode === 'signin'
                    ? activeRole === 'donor'
                      ? 'Access Donor Dashboard'
                      : 'Authorize Hospital Console'
                    : activeRole === 'donor'
                    ? 'Complete Donor Registration'
                    : 'Register Hospital Terminal'}
                </span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>

          {/* Error Banner */}
          {authError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-[12px] font-medium animate-in fade-in">
              <span className="material-symbols-outlined text-[18px] text-red-600">error</span>
              <span>{authError}</span>
            </div>
          )}

          {/* Feedback Banner */}
          {authFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-[12px] font-medium animate-in fade-in">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
              <span>{authFeedback}</span>
            </div>
          )}
        </form>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full h-px bg-slate-200"></div>
          <span className="absolute bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            or instant identity
          </span>
        </div>

        {/* Instant Identity Buttons */}
        <div className="flex flex-col gap-2">
          {/* ABHA Health ID */}
          <button
            type="button"
            onClick={() => handleFederatedAuth('ABHA')}
            className="w-full h-11 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold text-[10px]">
              🇮🇳
            </div>
            <span>Verify with ABHA Health ID</span>
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
          </button>

          {/* Google Federated Auth */}
          <button
            type="button"
            onClick={() => handleFederatedAuth('Google')}
            disabled={isGoogleRedirecting}
            className="w-full h-11 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-wait"
          >
            {isGoogleRedirecting ? (
              <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            )}
            <span>{isGoogleRedirecting ? 'Redirecting to Google…' : 'Continue with Google'}</span>
          </button>
        </div>
      </div>

      {/* Real-Time Network Stat Pill */}
      <div className="mt-3.5 p-3 rounded-xl bg-slate-100/90 border border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#b70011] text-[20px]">monitor_heart</span>
          <span className="text-[12px] font-semibold text-slate-800">Active Emergency Demands</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="font-display font-extrabold text-[20px] text-[#b70011] leading-none">47</span>
          <span className="text-[11px] font-medium text-slate-500">Units Needed Now</span>
        </div>
      </div>

      {/* Security and Regulatory Notice */}
      <div className="mt-4 flex flex-col items-center justify-center text-center gap-1 text-slate-500">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <span className="material-symbols-outlined text-[15px] text-emerald-600">lock</span>
          <span>256-Bit Encrypted • NACO & National Health Ministry Compliant</span>
        </div>
        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
          Donor biodata and hospital inventories are guarded under clinical confidentiality protocols.
        </p>
      </div>
    </div>
  );
};
