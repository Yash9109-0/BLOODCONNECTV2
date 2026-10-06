export type UserRole = 'hospital' | 'donor';

export interface AuthSession {
  isAuthenticated: boolean;
  role: UserRole | null;
  userEmail?: string;
  userName?: string;
  facilityName?: string;
  token?: string;
  loginTime?: string;
}

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type UrgencyLevel = 'Routine' | 'Urgent' | 'CRITICAL (Golden Hour)';

export interface BloodStockItem {
  group: BloodGroup;
  units: number;
  status: 'Critical' | 'Low' | 'Stable';
  percentage: number;
  expiringIn7d: number;
}

export interface HospitalProfile {
  id: string;
  name: string;
  licenseNumber: string;
  zoneHub: string;
  city: string;
  address: string;
  contactNumber: string;
  verified: boolean;
  totalStock: number;
  expiring7d: number;
  pendingRequests: number;
}

export interface DonorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: BloodGroup;
  donorCode: string;
  badgeTier: 'Bronze Lifesaver' | 'Silver Guardian' | 'Gold Hero' | 'Platinum Legend';
  city: string;
  points: number;
  weight: number;
  hemoglobin: number;
  age: number;
  lastDonationDaysAgo: number;
  totalDonations: number;
  livesSaved: number;
  referralCode: string;
  referralsCount: number;
}

export interface DonationCamp {
  id: string;
  title: string;
  description: string;
  venue: string;
  city: string;
  dateStr: string;
  timeStr: string;
  pledgedCount: number;
  active: boolean;
  googleMapsUrl: string;
}

export interface EmergencyRequest {
  id: string;
  hospitalName: string;
  city: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  urgencyLevel: UrgencyLevel;
  department: string;
  patientRef: string;
  contactNumber: string;
  formattedMessage: string;
  createdAt: string;
  status: 'Open' | 'Fulfilled';
}

export interface RewardVoucher {
  id: string;
  title: string;
  partner: string;
  pointsCost: number;
  category: 'Pharmacy' | 'Diagnostics' | 'Nutrition' | 'Transit';
  icon: string;
  code?: string;
  redeemed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: string;
  language?: 'en' | 'hi' | 'hinglish';
}

export interface CrossHospitalStock {
  hospitalId: string;
  hospitalName: string;
  city: string;
  distanceKm: number;
  group: BloodGroup;
  units: number;
  contactNumber: string;
  status: 'Critical' | 'Low' | 'Stable';
}

export interface IntegratedBloodBank {
  id: string;
  name: string;
  category?: 'Govt' | 'Private' | 'Charitable' | string;
  licenseNumber: string;
  city: string;
  district?: string;
  state?: string;
  address: string;
  contactNumber: string;
  verified: boolean;
  distanceKm?: number;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  operatingHours?: string;
  emergencyHotline?: string;
  stock?: Partial<Record<BloodGroup, number>>;
}

export interface IntegratedDonor {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  city: string;
  district?: string;
  state?: string;
  locality?: string;
  pincode?: string;
  phone: string;
  email?: string;
  age: number;
  weight: number;
  hemoglobin?: number;
  lastDonated?: string;
  status: 'Ready' | 'Eligible' | 'Deferred';
  is_available?: boolean;
  points?: number;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  totalDonations?: number;
}

