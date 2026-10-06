import { useState, useEffect } from 'react';
import {
  BloodStockItem,
  HospitalProfile,
  DonorProfile,
  DonationCamp,
  EmergencyRequest,
  RewardVoucher,
  CrossHospitalStock,
  IntegratedBloodBank,
  IntegratedDonor,
  UserRole,
  BloodGroup,
  AuthSession,
} from '../types';
import { supabase, supabaseService, INTEGRATED_BLOOD_BANKS, INTEGRATED_DONORS } from './supabase';
import {
  getInitialSession,
  subscribeToAuthChanges,
  signOut as supabaseSignOut,
  getUserRole,
  getUserDisplayName,
  ensureAccountRow,
} from './auth';
import { User } from '@supabase/supabase-js';

const INITIAL_INVENTORY: BloodStockItem[] = [
  { group: 'A+', units: 8, status: 'Low', percentage: 28, expiringIn7d: 2 },
  { group: 'A-', units: 6, status: 'Low', percentage: 22, expiringIn7d: 1 },
  { group: 'B+', units: 42, status: 'Stable', percentage: 82, expiringIn7d: 4 },
  { group: 'B-', units: 9, status: 'Low', percentage: 30, expiringIn7d: 1 },
  { group: 'AB+', units: 28, status: 'Stable', percentage: 65, expiringIn7d: 3 },
  { group: 'AB-', units: 2, status: 'Critical', percentage: 8, expiringIn7d: 0 },
  { group: 'O+', units: 86, status: 'Stable', percentage: 95, expiringIn7d: 3 },
  { group: 'O-', units: 3, status: 'Critical', percentage: 12, expiringIn7d: 0 },
];

const INITIAL_HOSPITAL: HospitalProfile = {
  id: 'hosp-aiims-raipur',
  name: 'AIIMS Raipur Blood Center',
  licenseNumber: 'Lic. #CG-BLD-8821',
  zoneHub: 'Zone 4 Hub',
  city: 'Raipur',
  address: 'GE Road, Tatibandh, Raipur, Chhattisgarh 492099',
  contactNumber: '+91 98765-43210',
  verified: true,
  totalStock: 184,
  expiring7d: 14,
  pendingRequests: 5,
};

const INITIAL_DONOR: DonorProfile = {
  id: 'donor-rahul-sharma',
  name: 'Rahul Sharma',
  email: 'donor@lifeline.org',
  phone: '+91 98112-94821',
  bloodGroup: 'O+',
  donorCode: 'BC-IN-994821',
  badgeTier: 'Gold Hero',
  city: 'New Delhi',
  points: 1250,
  weight: 68,
  hemoglobin: 14.2,
  age: 24,
  lastDonationDaysAgo: 112,
  totalDonations: 6,
  livesSaved: 18,
  referralCode: 'rahul-o-plus',
  referralsCount: 4,
};

const INITIAL_REWARDS: RewardVoucher[] = [
  {
    id: 'rew-1',
    title: '₹250 Pharmacy & Lab Voucher',
    partner: 'Apollo Pharmacy & PharmEasy',
    pointsCost: 400,
    category: 'Pharmacy',
    icon: 'medication',
    redeemed: false,
  },
  {
    id: 'rew-2',
    title: 'Comprehensive Health Check',
    partner: 'Thyrocare 60+ Profile Tests',
    pointsCost: 800,
    category: 'Diagnostics',
    icon: 'vital_signs',
    redeemed: false,
  },
  {
    id: 'rew-3',
    title: '15% Off Nutrition & Supplements',
    partner: 'Tata 1mg Exclusive Pass',
    pointsCost: 300,
    category: 'Nutrition',
    icon: 'local_pharmacy',
    redeemed: false,
  },
  {
    id: 'rew-4',
    title: '₹350 Cashback & Transit Perks',
    partner: 'Metro & Ride-Hail Fuel Credit',
    pointsCost: 500,
    category: 'Transit',
    icon: 'wallet',
    redeemed: false,
  },
];

const INITIAL_CAMPS: DonationCamp[] = [
  {
    id: 'camp-1',
    title: 'City Youth Innovation Conclave Camp',
    description: 'Special youth blood drive organized during Chhattisgarh Youth Innovation & Entrepreneurship Conclave 2026.',
    venue: 'Indira Indoor Stadium • Ground Hall 2',
    city: 'Raipur',
    dateStr: 'Oct 12',
    timeStr: '09:00 - 17:00',
    pledgedCount: 85,
    active: true,
    googleMapsUrl: 'https://maps.google.com/?q=Indira+Indoor+Stadium+Raipur',
  },
  {
    id: 'camp-2',
    title: 'IIT Bhilai Campus Lifeline Drive',
    description: 'Student & faculty blood donation camp with thalassemia awareness seminar.',
    venue: 'Student Activity Center, IIT Bhilai',
    city: 'Bhilai',
    dateStr: 'Oct 19',
    timeStr: '10:00 - 16:30',
    pledgedCount: 42,
    active: true,
    googleMapsUrl: 'https://maps.google.com/?q=IIT+Bhilai',
  },
];

const INITIAL_CROSS_HOSPITAL_STOCK: CrossHospitalStock[] = [
  {
    hospitalId: 'hosp-apollo-bilaspur',
    hospitalName: 'Apollo Hospital Blood Bank',
    city: 'Bilaspur',
    distanceKm: 112,
    group: 'O-',
    units: 8,
    contactNumber: '+91 77522-48000',
    status: 'Low',
  },
  {
    hospitalId: 'hosp-fortis-bhilai',
    hospitalName: 'Fortis Escorts Medical Center',
    city: 'Bhilai',
    distanceKm: 34,
    group: 'AB-',
    units: 6,
    contactNumber: '+91 78822-85000',
    status: 'Low',
  },
  {
    hospitalId: 'hosp-civil-durg',
    hospitalName: 'District Red Cross Blood Center',
    city: 'Durg',
    distanceKm: 41,
    group: 'A-',
    units: 14,
    contactNumber: '+91 78823-22100',
    status: 'Stable',
  },
  {
    hospitalId: 'hosp-aiims-delhi',
    hospitalName: 'AIIMS Main Blood Bank',
    city: 'New Delhi',
    distanceKm: 1200,
    group: 'O+',
    units: 142,
    contactNumber: '+91 11 2658-8500',
    status: 'Stable',
  },
];

const INITIAL_REQUESTS: EmergencyRequest[] = [
  {
    id: 'req-001',
    hospitalName: 'AIIMS Raipur Blood Center',
    city: 'Raipur',
    bloodGroup: 'O-',
    unitsNeeded: 4,
    urgencyLevel: 'CRITICAL (Golden Hour)',
    department: 'Trauma ICU / Bed 14',
    patientRef: 'Emergency Polytrauma Surgery',
    contactNumber: '+91 98765-43210',
    formattedMessage: '🚨 URGENT: 4 units O- needed at AIIMS Trauma ICU Bed 14. Please contact +91 98765-43210 or reply immediately.',
    createdAt: '8m ago',
    status: 'Open',
  },
  {
    id: 'req-002',
    hospitalName: 'District Hospital ICU',
    city: 'Bhilai',
    bloodGroup: 'AB-',
    unitsNeeded: 2,
    urgencyLevel: 'Urgent',
    department: 'Maternity Ward',
    patientRef: 'High-Risk Delivery',
    contactNumber: '+91 98220-11234',
    formattedMessage: '🚨 URGENT: 2 units AB- needed at District Hospital Bhilai Maternity Ward.',
    createdAt: '35m ago',
    status: 'Open',
  },
];

export function useBloodConnectStore() {
  // Session Authentication State
  const [session, setSession] = useState<AuthSession>(() => {
    try {
      const saved = localStorage.getItem('bc_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.isAuthenticated === 'boolean') {
          return parsed;
        }
      }
    } catch (e) {
      // fallback
    }
    return { isAuthenticated: false, role: null };
  });

  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    return (localStorage.getItem('bc_user_role') as UserRole) || 'hospital';
  });

  // Current active sub-tab within the role-specific dashboard
  const [activeSubTab, setActiveSubTab] = useState<string>('inventory');

  const [inventory, setInventory] = useState<BloodStockItem[]>(() => {
    const saved = localStorage.getItem('bc_inventory');
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
  });

  const [donor, setDonor] = useState<DonorProfile>(() => {
    const saved = localStorage.getItem('bc_donor');
    return saved ? JSON.parse(saved) : INITIAL_DONOR;
  });

  const [hospital, setHospital] = useState<HospitalProfile>(() => {
    const saved = localStorage.getItem('bc_hospital');
    return saved ? JSON.parse(saved) : INITIAL_HOSPITAL;
  });

  const [rewards, setRewards] = useState<RewardVoucher[]>(() => {
    const saved = localStorage.getItem('bc_rewards');
    return saved ? JSON.parse(saved) : INITIAL_REWARDS;
  });

  const [camps, setCamps] = useState<DonationCamp[]>(() => {
    const saved = localStorage.getItem('bc_camps');
    return saved ? JSON.parse(saved) : INITIAL_CAMPS;
  });

  const [requests, setRequests] = useState<EmergencyRequest[]>(() => {
    const saved = localStorage.getItem('bc_requests');
    return saved ? JSON.parse(saved) : INITIAL_REQUESTS;
  });

  // Live Supabase Integrated Dataset State
  const [liveBloodBanks, setLiveBloodBanks] = useState<IntegratedBloodBank[]>(INTEGRATED_BLOOD_BANKS);
  const [liveDonors, setLiveDonors] = useState<IntegratedDonor[]>(INTEGRATED_DONORS);
  const [supabaseLoading, setSupabaseLoading] = useState<boolean>(true);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [totalDonorsCount, setTotalDonorsCount] = useState<number>(1000);
  const [totalBanksCount, setTotalBanksCount] = useState<number>(20);

  // Cross Hospital Stock dynamically mapped from live blood banks
  const [crossHospitalStock, setCrossHospitalStock] = useState<CrossHospitalStock[]>(INITIAL_CROSS_HOSPITAL_STOCK);

  // Fetch Supabase data on mount
  useEffect(() => {
    let isMounted = true;
    async function loadSupabaseData() {
      try {
        setSupabaseLoading(true);
        // Load Blood Banks
        const banks = await supabaseService.getHospitals();
        if (isMounted && banks && banks.length > 0) {
          setLiveBloodBanks(banks);
          setTotalBanksCount(banks.length);

          // Build dynamic CrossHospitalStock from all 20 real blood banks
          const crossStockItems: CrossHospitalStock[] = [];
          banks.forEach((b) => {
            const groups: BloodGroup[] = ['O-', 'AB-', 'A-', 'B-', 'O+', 'A+', 'B+', 'AB+'];
            groups.forEach((grp) => {
              const units = b.stock?.[grp] ?? Math.floor(Math.random() * 15 + 2);
              crossStockItems.push({
                hospitalId: b.id,
                hospitalName: b.name,
                city: b.city || b.district || 'Raipur',
                distanceKm: b.distanceKm || 15,
                group: grp,
                units,
                contactNumber: b.contactNumber,
                status: units <= 3 ? 'Critical' : units <= 8 ? 'Low' : 'Stable',
              });
            });
          });
          setCrossHospitalStock(crossStockItems);
        }

        // Load Donors (up to 1,000 live donors)
        const donorsRes = await supabaseService.getDonors(undefined, undefined, undefined, 1000);
        if (isMounted && donorsRes && donorsRes.donors.length > 0) {
          setLiveDonors(donorsRes.donors);
          setTotalDonorsCount(donorsRes.totalCount || donorsRes.donors.length);
          setSupabaseConnected(true);
        }
      } catch (err) {
        console.warn('Supabase data load error:', err);
      } finally {
        if (isMounted) setSupabaseLoading(false);
      }
    }

    loadSupabaseData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Build a local AuthSession + hydrate the account row from a real Supabase user
  const applyAuthUser = async (rawUser: User) => {
    let user = rawUser;
    let meta = (user.user_metadata || {}) as Record<string, any>;
    let role = getUserRole(user);

    // First federated (Google) sign-in has no stored role yet — adopt the
    // role chosen on the auth screen and persist it to user metadata so
    // future sessions keep it.
    if (!meta.role && !meta.user_role) {
      const pending = localStorage.getItem('bc_pending_role');
      localStorage.removeItem('bc_pending_role');
      if (pending === 'hospital' || pending === 'donor') {
        role = pending;
        try {
          const { data, error } = await supabase.auth.updateUser({ data: { role: pending } });
          if (!error && data.user) {
            user = data.user;
            meta = (user.user_metadata || {}) as Record<string, any>;
          }
        } catch (e) {
          console.warn('Persist federated role note:', e);
        }
      }
    }
    const newSession: AuthSession = {
      isAuthenticated: true,
      role,
      userEmail: user.email || '',
      userName: getUserDisplayName(user),
      facilityName: String(meta.facility_name || ''),
      loginTime: new Date().toISOString(),
    };
    setSession(newSession);
    setActiveRole(role);
    localStorage.setItem('bc_session', JSON.stringify(newSession));
    localStorage.setItem('bc_user_role', role);

    // Create the linked donors/hospitals row when it doesn't exist yet.
    // Idempotent — this also covers first-time Google (OAuth) sign-ins.
    await ensureAccountRow(user);

    try {
      if (role === 'donor') {
        // Real donor record linked to this auth user (donors.donor_id)
        const { data } = await supabase.from('donors').select('*').eq('donor_id', user.id).limit(1);
        const row = data && data[0];
        if (row) {
          const group = (row.blood_group || 'O+') as BloodGroup;
          setDonor((prev) => ({
            ...prev,
            id: row.id,
            name: row.name || prev.name,
            email: user.email || prev.email,
            phone: row.phone || prev.phone,
            bloodGroup: group,
            city: row.city || prev.city,
            points: row.points ?? prev.points,
            age: row.age ?? prev.age,
            weight: row.weight ?? prev.weight,
            hemoglobin: row.hemoglobin ?? prev.hemoglobin,
            donorCode: `BC-${group.replace('+', 'P').replace('-', 'N')}-${String(row.id).slice(0, 6).toUpperCase()}`,
          }));
        }
      } else {
        // Real hospital/blood bank record linked to this auth user (hospitals.user_id)
        const { data } = await supabase.from('hospitals').select('*').eq('user_id', user.id).limit(1);
        const row = data && data[0];
        if (row) {
          setHospital((prev) => ({
            ...prev,
            id: row.id,
            name: row.name || prev.name,
            licenseNumber: row.license_number || prev.licenseNumber,
            city: row.city || prev.city,
            address: row.address || prev.address,
            contactNumber: row.contact_number || prev.contactNumber,
            verified: row.verified ?? prev.verified,
            zoneHub: row.zone_hub || prev.zoneHub,
          }));
        }
      }
    } catch (e) {
      console.warn('Auth profile hydration note:', e);
    }
  };

  // Resolve the real Supabase Auth session on mount and stay subscribed
  useEffect(() => {
    let mounted = true;

    (async () => {
      const authSession = await getInitialSession();
      if (!mounted) return;
      if (authSession?.user) {
        await applyAuthUser(authSession.user);
      } else {
        // No live Supabase session -> never trust a stale local-only session
        setSession({ isAuthenticated: false, role: null });
        localStorage.removeItem('bc_session');
      }
    })();

    const unsubscribe = subscribeToAuthChanges((nextSession) => {
      if (!mounted) return;
      if (nextSession?.user) {
        applyAuthUser(nextSession.user);
      } else {
        setSession({ isAuthenticated: false, role: null });
        localStorage.removeItem('bc_session');
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('bc_active_subtab', activeSubTab);
  }, [activeSubTab]);

  useEffect(() => {
    localStorage.setItem('bc_user_role', activeRole);
  }, [activeRole]);

  useEffect(() => {
    localStorage.setItem('bc_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('bc_donor', JSON.stringify(donor));
  }, [donor]);

  useEffect(() => {
    localStorage.setItem('bc_hospital', JSON.stringify(hospital));
  }, [hospital]);

  useEffect(() => {
    localStorage.setItem('bc_rewards', JSON.stringify(rewards));
  }, [rewards]);

  useEffect(() => {
    localStorage.setItem('bc_camps', JSON.stringify(camps));
  }, [camps]);

  useEffect(() => {
    localStorage.setItem('bc_requests', JSON.stringify(requests));
  }, [requests]);

  // Actions
  const updateInventoryUnit = (group: string, delta: number) => {
    let updatedUnits = 0;
    setInventory((prev) =>
      prev.map((item) => {
        if (item.group === group) {
          const newUnits = Math.max(0, item.units + delta);
          updatedUnits = newUnits;
          let newStatus: 'Critical' | 'Low' | 'Stable' = 'Stable';
          if (newUnits <= 3) newStatus = 'Critical';
          else if (newUnits <= 10) newStatus = 'Low';

          const newPercentage = Math.min(100, Math.round((newUnits / 50) * 100));
          return {
            ...item,
            units: newUnits,
            status: newStatus,
            percentage: newPercentage,
          };
        }
        return item;
      })
    );

    setHospital((prev) => ({
      ...prev,
      totalStock: Math.max(0, prev.totalStock + delta),
    }));

    // Async sync with Supabase
    supabaseService.updateInventory(hospital.id, group, updatedUnits);
  };

  const redeemVoucher = (voucherId: string) => {
    const target = rewards.find((r) => r.id === voucherId);
    if (!target) return { success: false, message: 'Voucher not found' };
    if (donor.points < target.pointsCost) {
      return { success: false, message: 'Insufficient Blood Points' };
    }

    const genCode = `LIFESAVER-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    setDonor((prev) => ({
      ...prev,
      points: prev.points - target.pointsCost,
    }));

    setRewards((prev) =>
      prev.map((r) =>
        r.id === voucherId ? { ...r, redeemed: true, code: genCode } : r
      )
    );

    return { success: true, message: `Redeemed ${target.title}!`, code: genCode };
  };

  const addWalkInDonor = (campId: string) => {
    setCamps((prev) =>
      prev.map((c) =>
        c.id === campId ? { ...c, pledgedCount: c.pledgedCount + 1 } : c
      )
    );
  };

  const addEmergencyRequest = (newReq: Omit<EmergencyRequest, 'id' | 'createdAt' | 'status'>) => {
    const created: EmergencyRequest = {
      ...newReq,
      id: `req-${Date.now()}`,
      createdAt: 'Just now',
      status: 'Open',
    };
    setRequests((prev) => [created, ...prev]);
    setHospital((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests + 1,
    }));

    // Async sync with Supabase
    supabaseService.publishEmergencyRequest(newReq);

    return created;
  };

  const awardReferralPoints = () => {
    setDonor((prev) => ({
      ...prev,
      points: prev.points + 150,
      referralsCount: prev.referralsCount + 1,
    }));
  };

  const updateDonorSelfTest = (updates: Partial<DonorProfile>) => {
    setDonor((prev) => ({ ...prev, ...updates }));
  };

  // Switch Active Hospital to any of the 20 real Supabase blood banks
  const switchActiveHospital = (bankId: string) => {
    const target = liveBloodBanks.find((b) => b.id === bankId);
    if (!target) return;

    setHospital({
      id: target.id,
      name: target.name,
      licenseNumber: target.licenseNumber || 'NACO Lic. #CG-BLD',
      zoneHub: `${target.district || target.city || 'Regional'} Hub`,
      city: target.city || target.district || 'Raipur',
      address: target.address,
      contactNumber: target.contactNumber,
      verified: true,
      totalStock: Object.values(target.stock || {}).reduce((a, b) => a + (b || 0), 0) || 160,
      expiring7d: 12,
      pendingRequests: 3,
    });

    // Update inventory to match this facility
    if (target.stock) {
      setInventory((prev) =>
        prev.map((item) => {
          const u = target.stock?.[item.group] ?? item.units;
          return {
            ...item,
            units: u,
            status: u <= 3 ? 'Critical' : u <= 8 ? 'Low' : 'Stable',
            percentage: Math.min(100, Math.round((u / 50) * 100)),
          };
        })
      );
    }
  };

  // Switch Active Donor to any of the 1,000 real Supabase donors
  const switchActiveDonor = (donorId: string) => {
    const target = liveDonors.find((d) => d.id === donorId);
    if (!target) return;

    setDonor({
      id: target.id,
      name: target.name,
      email: target.email || `${target.name.toLowerCase().replace(/\s+/g, '.')}@donor.net`,
      phone: target.phone,
      bloodGroup: target.bloodGroup,
      donorCode: `BC-${target.bloodGroup.replace('+', 'P').replace('-', 'N')}-${target.phone.replace(/[^0-9]/g, '').slice(-4)}`,
      badgeTier: target.points && target.points > 1000 ? 'Platinum Legend' : 'Gold Hero',
      city: target.city,
      points: target.points || 450,
      weight: target.weight || 62,
      hemoglobin: target.hemoglobin || 13.6,
      age: target.age || 26,
      lastDonationDaysAgo: 110,
      totalDonations: 4,
      livesSaved: 12,
      referralCode: target.name.toLowerCase().replace(/\s+/g, '-') + '-hero',
      referralsCount: 2,
    });
  };

  // Filter matched donors from 1,000 real Supabase donors
  const matchEmergencyDonors = (bloodGroup: BloodGroup, cityFilter?: string) => {
    return liveDonors.filter((d) => {
      const groupMatch = d.bloodGroup === bloodGroup;
      if (!groupMatch) return false;
      if (cityFilter && cityFilter !== 'All') {
        return d.city.toLowerCase().includes(cityFilter.toLowerCase());
      }
      return true;
    });
  };

  // Sign In action with role-specific credentials and routing
  const loginAs = (
    role: UserRole,
    details?: { email?: string; name?: string; facilityName?: string }
  ) => {
    const newSession: AuthSession = {
      isAuthenticated: true,
      role,
      userEmail:
        details?.email ||
        (role === 'hospital' ? 'coordinator@aiimsraipur.gov' : 'donor@lifeline.org'),
      userName: details?.name || (role === 'hospital' ? 'Dr. Ananya Ray' : 'Rahul Sharma'),
      facilityName: details?.facilityName || 'AIIMS Raipur Blood Center',
      loginTime: new Date().toISOString(),
    };

    setSession(newSession);
    setActiveRole(role);
    setActiveSubTab(role === 'hospital' ? 'inventory' : 'pass');
    localStorage.setItem('bc_session', JSON.stringify(newSession));
    localStorage.setItem('bc_user_role', role);
  };

  // Sign Out action - clears the local session AND the real Supabase Auth session
  const logout = () => {
    const emptySession: AuthSession = { isAuthenticated: false, role: null };
    setSession(emptySession);
    localStorage.removeItem('bc_session');
    localStorage.removeItem('bc_user_role');
    // Revoke the Supabase session (tokens + persisted storage)
    supabaseSignOut();
  };

  return {
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
    requests,
    addEmergencyRequest,
    crossHospitalStock,
    liveBloodBanks,
    liveDonors,
    supabaseLoading,
    supabaseConnected,
    totalDonorsCount,
    totalBanksCount,
    switchActiveHospital,
    switchActiveDonor,
    matchEmergencyDonors,
    integratedDonors: liveDonors,
    integratedBloodBanks: liveBloodBanks,
  };
}
