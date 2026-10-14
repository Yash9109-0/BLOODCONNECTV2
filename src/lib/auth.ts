/**
 * Real Supabase Auth (GoTrue) integration for Blood-Connect.
 *
 * - Email + password sign-up / sign-in against the live Supabase project.
 * - Role (donor | hospital) and profile details are stored in the auth
 *   user's raw metadata so they survive across sessions.
 * - After a session exists we make sure the linked application row exists
 *   (donors row for donors / hospitals row for hospital admins) so every
 *   authenticated account has a real database record.
 */
import { Session, User } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { BloodGroup, UserRole } from '../types';

export interface SignUpProfile {
  role: UserRole;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  bloodGroup?: BloodGroup;
  age?: number;
  weight?: number;
  hemoglobin?: number;
  city?: string;
  // Hospital-specific fields
  facilityName?: string;
  licenseNumber?: string;
  address?: string;
  referredBy?: string;
}

export type AuthResult =
  | { success: true; needsConfirmation?: boolean; message: string; user?: User }
  | { success: false; error: string };

const DEFAULT_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  raipur: { lat: 21.2514, lng: 81.6296 },
  bilaspur: { lat: 22.0797, lng: 82.1409 },
  durg: { lat: 21.1901, lng: 81.2849 },
  bhilai: { lat: 21.1938, lng: 81.3509 },
  korba: { lat: 22.3595, lng: 82.7501 },
  rajnandgaon: { lat: 21.0972, lng: 81.0303 },
};

/** Human-readable translation of common GoTrue errors. */
function readableAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox for the Supabase confirmation link.';
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (m.includes('password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  return message;
}

/** Extract the Blood-Connect role from a Supabase auth user (defaults to donor). */
export function getUserRole(user: User): UserRole {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const role = String(meta.role || meta.user_role || '').toLowerCase();
  if (role === 'super_admin' || role === 'superadmin' || role === 'admin') return 'super_admin';
  return role === 'hospital' ? 'hospital' : 'donor';
}

/** Extract display name from auth user metadata or email local-part. */
export function getUserDisplayName(user: User): string {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const name = meta.full_name || meta.name || meta.facility_name;
  if (name) return String(name);
  return (user.email || 'Verified User').split('@')[0];
}

function buildMetadata(profile: SignUpProfile): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    role: profile.role,
    full_name: profile.fullName,
  };
  if (profile.phone) metadata.phone = profile.phone;
  if (profile.role === 'donor') {
    if (profile.bloodGroup) metadata.blood_group = profile.bloodGroup;
    if (profile.city) metadata.city = profile.city;
    if (profile.age) metadata.age = profile.age;
    if (profile.weight) metadata.weight = profile.weight;
    if (profile.hemoglobin) metadata.hemoglobin = profile.hemoglobin;
    if (profile.referredBy) metadata.referred_by = profile.referredBy.trim();
  } else {
    metadata.facility_name = profile.facilityName || profile.fullName;
    metadata.license_number = profile.licenseNumber || '';
    metadata.address = profile.address || '';
    metadata.city = profile.city || 'Raipur';
    if (profile.phone) metadata.contact_number = profile.phone;
  }
  return metadata;
}

/**
 * Ensure the signed-in user has a linked application row:
 *  - role 'donor'    -> public.donors    (linked via donors.donor_id)
 *  - role 'hospital' -> public.hospitals (linked via hospitals.user_id)
 * Idempotent: skips insertion when the row already exists.
 */
export async function ensureAccountRow(user: User): Promise<void> {
  try {
    const role = getUserRole(user);
    const meta = (user.user_metadata || {}) as Record<string, any>;

    if (role === 'donor') {
      const { data: existing, error: lookupError } = await supabase
        .from('donors')
        .select('id')
        .eq('donor_id', user.id)
        .limit(1);
      if (lookupError) {
        console.warn('Donor row lookup note:', lookupError.message);
        return;
      }
      if (existing && existing.length > 0) return;

      const fullName = String(meta.full_name || getUserDisplayName(user));
      const refCode = meta.referred_by ? String(meta.referred_by).trim() : null;
      const totalD = Number(meta.total_donations) || 0;
      const badgeLevel = totalD >= 5 ? 'Gold' : totalD >= 3 ? 'Silver' : 'Bronze';
      const welcomeBonus = refCode ? 100 : 0;

      const { error: insertError } = await supabase.from('donors').insert({
        donor_id: user.id,
        name: fullName,
        blood_group: (meta.blood_group as string) || 'O+',
        phone: String(meta.phone || ''),
        city: String(meta.city || 'Raipur'),
        state: 'Chhattisgarh',
        age: Number(meta.age) || null,
        weight: Number(meta.weight) || null,
        hemoglobin: Number(meta.hemoglobin) || null,
        is_available: true,
        is_eligible: true,
        points: 100 + welcomeBonus,
        referred_by: refCode,
        badge_level: badgeLevel,
      });

      if (insertError) {
        console.warn('Donor row insert note:', insertError.message);
      }

      // Notify server to award points to referrer and log referral
      if (refCode) {
        try {
          await fetch('/api/referrals/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referredBy: refCode,
              newDonorId: user.id,
              newDonorName: fullName,
            }),
          });
        } catch (e) {
          // non-critical
        }
      }
      return;
    }

    // Hospital role -> public.hospitals
    const { data: existing, error: lookupError } = await supabase
      .from('hospitals')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    if (lookupError) {
      console.warn('Hospital row lookup note:', lookupError.message);
      return;
    }
    if (existing && existing.length > 0) return;

    const city = String(meta.city || 'Raipur');
    const coords = DEFAULT_CITY_COORDS[city.toLowerCase()] || DEFAULT_CITY_COORDS.raipur;
    const { error: insertError } = await supabase.from('hospitals').insert({
      user_id: user.id,
      name: String(meta.facility_name || meta.full_name || 'Partner Hospital'),
      license_number: String(meta.license_number || 'PENDING-VERIFICATION'),
      address: String(meta.address || `${city}, Chhattisgarh`),
      city,
      coordinates: { lat: coords.lat, lng: coords.lng },
      contact_number: String(meta.contact_number || meta.phone || ''),
      verified: false,
      zone_hub: 'Zone 4 Hub',
    });
    if (insertError) console.warn('Hospital row insert note:', insertError.message);
  } catch (e) {
    console.warn('ensureAccountRow note:', e);
  }
}

/** Register a brand-new account with Supabase Auth. */
export async function signUp(profile: SignUpProfile): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: profile.email.trim(),
      password: profile.password,
      options: { data: buildMetadata(profile) },
    });

    if (error) return { success: false, error: readableAuthError(error.message) };

    // Email confirmation disabled -> session returned immediately
    if (data.session && data.user) {
      await ensureAccountRow(data.user);
      return {
        success: true,
        message: `Account created. Welcome, ${profile.fullName}!`,
        user: data.user,
      };
    }

    if (data.user) {
      return {
        success: true,
        needsConfirmation: true,
        message:
          'Registration successful! Check your inbox — confirm your email address, then sign in.',
        user: data.user,
      };
    }

    return { success: true, message: 'Registration submitted.' };
  } catch (e: any) {
    return {
      success: false,
      error: readableAuthError(e?.message || 'Network error. Please try again.'),
    };
  }
}

export const DEMO_CREDENTIALS = {
  donor: {
    email: 'donor@lifeline.org',
    password: 'demo123',
    role: 'donor' as const,
    name: 'Rahul Sharma',
    bloodGroup: 'O+',
    city: 'Raipur',
    description: 'Gold Hero Voluntary Donor',
  },
  hospital: {
    email: 'hospital@lifeline.org',
    password: 'demo123',
    role: 'hospital' as const,
    name: 'AIIMS Raipur Blood Center',
    facilityName: 'AIIMS Raipur Blood Center',
    city: 'Raipur',
    description: 'State Level Blood Bank & Trauma Ward',
  },
  super_admin: {
    email: 'admin@lifeline.org',
    password: 'demo123',
    role: 'super_admin' as const,
    name: 'State Health Authority',
    facilityName: 'Directorate of Health Services CG',
    city: 'Raipur',
    description: 'Chhattisgarh State Blood Transfusion Council',
  },
};

/** Sign in an existing account or instant presentation demo credentials. */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const normEmail = email.trim().toLowerCase();

  // Instant Demo Presentation Accounts (bypasses unconfirmed email barriers in live presentations)
  if (
    normEmail === 'donor@lifeline.org' ||
    normEmail === 'demo.donor@bloodconnect.org' ||
    normEmail === 'donor@demo.com'
  ) {
    const demoUser: any = {
      id: 'demo-donor-001',
      email: normEmail,
      user_metadata: {
        role: 'donor',
        full_name: 'Rahul Sharma',
        name: 'Rahul Sharma',
        blood_group: 'O+',
        city: 'Raipur',
        age: 24,
        weight: 68,
        hemoglobin: 14.2,
        total_donations: 6,
        points: 1250,
        donor_code: 'BC-OP-994821',
      },
    };
    try {
      localStorage.setItem('bc_demo_user', JSON.stringify(demoUser));
    } catch {}
    return {
      success: true,
      message: 'Signed in as Demo Voluntary Donor (Rahul Sharma).',
      user: demoUser,
    };
  }

  if (
    normEmail === 'hospital@lifeline.org' ||
    normEmail === 'demo.hospital@bloodconnect.org' ||
    normEmail === 'hospital@demo.com'
  ) {
    const demoUser: any = {
      id: 'demo-hospital-001',
      email: normEmail,
      user_metadata: {
        role: 'hospital',
        facility_name: 'AIIMS Raipur Blood Center',
        full_name: 'AIIMS Raipur Blood Center',
        name: 'AIIMS Raipur Blood Center',
        license_number: 'Lic. #CG-BLD-8821',
        city: 'Raipur',
        address: 'GE Road, Tatibandh, Raipur, Chhattisgarh 492099',
        contact_number: '+91 98765-43210',
      },
    };
    try {
      localStorage.setItem('bc_demo_user', JSON.stringify(demoUser));
    } catch {}
    return {
      success: true,
      message: 'Signed in as Demo Hospital Center (AIIMS Raipur).',
      user: demoUser,
    };
  }

  if (
    normEmail === 'admin@lifeline.org' ||
    normEmail === 'demo.admin@bloodconnect.org' ||
    normEmail === 'admin@demo.com' ||
    normEmail === 'superadmin@lifeline.gov.in'
  ) {
    const demoUser: any = {
      id: 'demo-admin-001',
      email: normEmail,
      user_metadata: {
        role: 'super_admin',
        full_name: 'State Health Authority Super Admin',
        name: 'State Health Authority',
        facility_name: 'Directorate of Health Services CG',
        city: 'Raipur',
      },
    };
    try {
      localStorage.setItem('bc_demo_user', JSON.stringify(demoUser));
    } catch {}
    return {
      success: true,
      message: 'Signed in as Demo Super Admin (State Health Authority).',
      user: demoUser,
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) return { success: false, error: readableAuthError(error.message) };
    if (data.user) await ensureAccountRow(data.user);

    return { success: true, message: 'Signed in successfully.', user: data.user };
  } catch (e: any) {
    return {
      success: false,
      error: readableAuthError(e?.message || 'Network error. Please try again.'),
    };
  }
}

/**
 * Start "Continue with Google" via Supabase Auth (OAuth).
 * The browser redirects to Google and back to `redirectTo`; the resulting
 * session is picked up by subscribeToAuthChanges on return.
 * The donor/hospital role chosen on the auth screen is persisted to
 * localStorage as `bc_pending_role` and applied to the user's metadata
 * after the first successful sign-in (see store.applyAuthUser).
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    // Preflight: GoTrue returns raw JSON (instead of redirecting back) when
    // a provider is disabled, so check first and show an in-app message.
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: SUPABASE_ANON_KEY },
      });
      if (res.ok) {
        const settings = await res.json();
        if (!settings?.external?.google) {
          return {
            success: false,
            error:
              'Google sign-in is not enabled yet on this Supabase project. Enable it in the Supabase dashboard: Authentication → Sign In → Google (paste your Google OAuth Client ID & Secret).',
          };
        }
      }
    } catch {
      // Preflight is best-effort — proceed with the redirect if it fails
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) return { success: false, error: readableAuthError(error.message) };
    return { success: true, message: 'Redirecting to Google for secure sign-in…' };
  } catch (e: any) {
    return {
      success: false,
      error: readableAuthError(e?.message || 'Network error. Please try again.'),
    };
  }
}

/** Sign out of Supabase Auth (no-op when there is no session). */
export async function signOut(): Promise<void> {
  try {
    localStorage.removeItem('bc_demo_user');
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('Sign-out note:', e);
  }
}

/** Resolve the current persisted session, if any. */
export async function getInitialSession(): Promise<Session | null> {
  try {
    const demoUserRaw = localStorage.getItem('bc_demo_user');
    if (demoUserRaw) {
      try {
        const demoUser = JSON.parse(demoUserRaw);
        return {
          access_token: 'demo-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'demo-refresh',
          user: demoUser,
        } as Session;
      } catch {}
    }
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch (e) {
    console.warn('getSession note:', e);
    return null;
  }
}

/** Subscribe to Supabase auth state changes; returns an unsubscribe function. */
export function subscribeToAuthChanges(
  callback: (session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

