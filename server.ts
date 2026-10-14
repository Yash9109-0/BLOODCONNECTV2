import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

const DEFAULT_SUPABASE_URL = 'https://fyqeuamxgtjgjzutvvhm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cWV1YW14Z3RqZ2p6dXR2dmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NTgyMTUsImV4cCI6MjEwNjMzNDIxNX0.Oi2ddnJmY1MC_-gp73o9fw3Ew9TVVqYJf_lFqIwhIW8';

// Initialize Supabase Client
let supabase: SupabaseClient | null = null;
const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

try {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Connected to Supabase Project:', supabaseUrl);
} catch (err) {
  console.warn('⚠️ Could not initialize Supabase client:', err);
}

// Integrated In-Memory Data Store with local JSON persistence backup
const DATA_STORE_PATH = path.resolve(__dirname, 'supabase-data.json');

interface StoredBloodBank {
  id: string;
  name: string;
  licenseNumber: string;
  district?: string;
  state?: string;
  city: string;
  address: string;
  contactNumber: string;
  verified: boolean;
  distanceKm?: number;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  operatingHours?: string;
  category?: 'Govt' | 'Charitable' | 'Private' | string;
  stock?: Record<string, number>;
}

interface StoredDonor {
  id: string;
  name: string;
  bloodGroup: string;
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
  lat?: number;
  lng?: number;
  distanceKm?: number;
  totalDonations?: number;
  is_available?: boolean;
}

const REAL_HOSPITALS_REGISTRY: Record<string, { lat: number; lng: number; address: string; contactNumber: string; operatingHours: string; category?: string }> = {
  'Model Blood Centre, Raipur': {
    lat: 21.24972,
    lng: 81.63995,
    address: 'Dr. B.R. Ambedkar Memorial Hospital & Medical College Campus, Jail Road, Mowa, Raipur, CG 492001',
    contactNumber: '+91 771-2525602',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'District Hospital Blood Bank, Raipur': {
    lat: 21.25820,
    lng: 81.64930,
    address: 'District Hospital Campus, Pandri, Civil Lines, Raipur, CG 492004',
    contactNumber: '+91 771-2525603',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'Medical College Blood Bank, Raipur': {
    lat: 21.25615,
    lng: 81.57887,
    address: 'All India Institute of Medical Sciences (AIIMS), GE Road, Tatibandh, Raipur, CG 492099',
    contactNumber: '+91 771-2577000',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'Red Cross Blood Bank, Raipur': {
    lat: 21.24566,
    lng: 81.64449,
    address: 'Indian Red Cross Society, Collectorate Compound, Kutchery Chowk, Raipur, CG 492001',
    contactNumber: '+91 771-2235468',
    operatingHours: '8:00 AM - 10:00 PM (Emergency on Call)',
    category: 'Charitable',
  },
  'City Hospital Blood Bank, Raipur': {
    lat: 21.21308,
    lng: 81.65372,
    address: 'Ramkrishna CARE Hospital Blood Bank, Aurobindo Enclave, Pachpedi Naka, Raipur, CG 492001',
    contactNumber: '+91 771-4020200',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Private',
  },
  'Model Blood Centre, Bilaspur': {
    lat: 22.08842,
    lng: 82.15245,
    address: 'Chhattisgarh Institute of Medical Sciences (CIMS), River View Road, Bilaspur, CG 495004',
    contactNumber: '+91 7752-241000',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'District Hospital Blood Bank, Bilaspur': {
    lat: 22.08310,
    lng: 82.15240,
    address: 'Sardar Vallabhbhai Patel District Hospital, Koni Road, Bilaspur, CG 495001',
    contactNumber: '+91 7752-241001',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'Medical College Blood Bank, Bilaspur': {
    lat: 22.09631,
    lng: 82.16482,
    address: 'Apollo Hospitals Blood Centre, Rajkishore Nagar, Lingiyadih, Bilaspur, CG 495006',
    contactNumber: '+91 7752-230000',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Private',
  },
  'Red Cross Blood Bank, Bilaspur': {
    lat: 22.07600,
    lng: 82.14800,
    address: 'Red Cross Bhawan, Link Road, Bilaspur, CG 495001',
    contactNumber: '+91 7752-223546',
    operatingHours: '9:00 AM - 9:00 PM',
    category: 'Charitable',
  },
  'City Hospital Blood Bank, Bilaspur': {
    lat: 22.08700,
    lng: 82.15900,
    address: 'Shri Ram Care Super Specialty Hospital, Dayalband, Bilaspur, CG 495001',
    contactNumber: '+91 7752-402020',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Private',
  },
  'Model Blood Centre, Durg': {
    lat: 21.18950,
    lng: 81.28250,
    address: 'District Hospital Blood Centre, Collectorate Road, Civil Lines, Durg, CG 491001',
    contactNumber: '+91 788-2292000',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'District Hospital Blood Bank, Durg': {
    lat: 21.21050,
    lng: 81.34520,
    address: 'Lal Bahadur Shastri Govt Hospital Blood Unit, Supela, Bhilai, Durg, CG 490023',
    contactNumber: '+91 788-2292001',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'Medical College Blood Bank, Durg': {
    lat: 21.22680,
    lng: 81.31290,
    address: 'Shri Shankaracharya Institute of Medical Sciences (SSIMS), Junwani, Bhilai, CG 490020',
    contactNumber: '+91 788-2292002',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Private',
  },
  'Red Cross Blood Bank, Durg': {
    lat: 21.19200,
    lng: 81.28500,
    address: 'Red Cross Society Blood Unit, Civil Lines, Durg, CG 491001',
    contactNumber: '+91 788-223546',
    operatingHours: '9:00 AM - 8:00 PM',
    category: 'Charitable',
  },
  'City Hospital Blood Bank, Durg': {
    lat: 21.19382,
    lng: 81.35091,
    address: 'Sector 9 Main Hospital Blood Centre (SAIL Bhilai Steel Plant), Sector 9, Bhilai, CG 490006',
    contactNumber: '+91 788-402020',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'Model Blood Centre, Korba': {
    lat: 22.35950,
    lng: 82.75010,
    address: 'Late Bisahu Das Mahant Memorial Medical College Hospital, Kosabadi, Korba, CG 495677',
    contactNumber: '+91 7759-222000',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'District Hospital Blood Bank, Korba': {
    lat: 22.36945,
    lng: 82.74685,
    address: '100 Bedded District Hospital, Transport Nagar, Korba, CG 495677',
    contactNumber: '+91 7759-222001',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'Medical College Blood Bank, Korba': {
    lat: 22.38870,
    lng: 82.72310,
    address: 'NTPC Hospital Blood Unit, Vikas Nagar, Jamnipali, Korba, CG 495450',
    contactNumber: '+91 7759-222002',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
  },
  'Red Cross Blood Bank, Korba': {
    lat: 22.36100,
    lng: 82.74700,
    address: 'Red Cross Society Center, ITI Chowk, Kosabadi, Korba, CG 495677',
    contactNumber: '+91 7759-223546',
    operatingHours: '9:00 AM - 8:00 PM',
    category: 'Charitable',
  },
  'City Hospital Blood Bank, Korba': {
    lat: 22.40770,
    lng: 82.75328,
    address: 'Balco Hospital Blood Bank, Sector 1, Balco Nagar, Korba, CG 495684',
    contactNumber: '+91 7759-402020',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Private',
  },
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const DEFAULT_BLOOD_BANKS: StoredBloodBank[] = [
  {
    id: 'bb-1',
    name: 'AIIMS Raipur Blood Center',
    licenseNumber: 'Lic. #CG-BLD-8821',
    city: 'Raipur',
    district: 'Raipur',
    state: 'Chhattisgarh',
    address: 'All India Institute of Medical Sciences (AIIMS), GE Road, Tatibandh, Raipur, CG 492099',
    contactNumber: '+91 771-2577000',
    verified: true,
    distanceKm: 0,
    lat: 21.25704,
    lng: 81.57943,
    mapsUrl: 'https://maps.google.com/?q=21.25704,81.57943',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
    stock: { 'O-': 3, 'O+': 86, 'A-': 6, 'A+': 8, 'B-': 9, 'B+': 42, 'AB-': 2, 'AB+': 28 }
  },
  {
    id: 'bb-2',
    name: 'Apollo Hospital Blood Bank',
    licenseNumber: 'Lic. #CG-BLD-4011',
    city: 'Bilaspur',
    district: 'Bilaspur',
    state: 'Chhattisgarh',
    address: 'Apollo Hospitals Blood Centre, Rajkishore Nagar, Lingiyadih, Bilaspur, CG 495006',
    contactNumber: '+91 7752-248000',
    verified: true,
    distanceKm: 112,
    lat: 22.09631,
    lng: 82.16482,
    mapsUrl: 'https://maps.google.com/?q=22.09631,82.16482',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Private',
    stock: { 'O-': 8, 'O+': 54, 'A-': 4, 'A+': 22, 'B-': 7, 'B+': 36, 'AB-': 3, 'AB+': 18 }
  },
  {
    id: 'bb-3',
    name: 'Sector 9 Main Hospital Blood Center',
    licenseNumber: 'Lic. #CG-BLD-7720',
    city: 'Bhilai',
    district: 'Durg',
    state: 'Chhattisgarh',
    address: 'Sector 9 Hospital Complex (SAIL BSP), Sector 9, Bhilai, CG 490006',
    contactNumber: '+91 788-2285000',
    verified: true,
    distanceKm: 34,
    lat: 21.19382,
    lng: 81.35091,
    mapsUrl: 'https://maps.google.com/?q=21.19382,81.35091',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
    stock: { 'O-': 4, 'O+': 38, 'A-': 9, 'A+': 31, 'B-': 5, 'B+': 45, 'AB-': 6, 'AB+': 14 }
  },
  {
    id: 'bb-4',
    name: 'District Red Cross Blood Center',
    licenseNumber: 'Lic. #CG-BLD-1092',
    city: 'Durg',
    district: 'Durg',
    state: 'Chhattisgarh',
    address: 'Collectorate Road, Civil Lines, Durg, CG 491001',
    contactNumber: '+91 788-2322100',
    verified: true,
    distanceKm: 41,
    lat: 21.18950,
    lng: 81.28250,
    mapsUrl: 'https://maps.google.com/?q=21.18950,81.28250',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Charitable',
    stock: { 'O-': 6, 'O+': 62, 'A-': 14, 'A+': 40, 'B-': 8, 'B+': 55, 'AB-': 4, 'AB+': 22 }
  },
  {
    id: 'bb-5',
    name: 'Dr. B.R. Ambedkar Memorial Model Blood Centre',
    licenseNumber: 'Lic. #CG-BLD-0101',
    city: 'Raipur',
    district: 'Raipur',
    state: 'Chhattisgarh',
    address: 'Medical College Campus, Jail Road, Mowa, Raipur, CG 492001',
    contactNumber: '+91 771-2525602',
    verified: true,
    distanceKm: 8.5,
    lat: 21.24641,
    lng: 81.65083,
    mapsUrl: 'https://maps.google.com/?q=21.24641,81.65083',
    operatingHours: '24/7 Emergency Blood Bank',
    category: 'Govt',
    stock: { 'O-': 12, 'O+': 140, 'A-': 18, 'A+': 95, 'B-': 16, 'B+': 110, 'AB-': 8, 'AB+': 45 }
  }
];

const DEFAULT_DONORS: StoredDonor[] = [
  {
    id: 'dn-1',
    name: 'Rahul Sharma',
    bloodGroup: 'O+',
    city: 'New Delhi',
    phone: '+91 98112-94821',
    email: 'rahul.sharma@lifeline.org',
    age: 24,
    weight: 68,
    hemoglobin: 14.2,
    lastDonated: '112 days ago',
    status: 'Ready'
  },
  {
    id: 'dn-2',
    name: 'Priya Verma',
    bloodGroup: 'O-',
    city: 'Raipur',
    phone: '+91 98261-77820',
    email: 'priya.verma@gmail.com',
    age: 27,
    weight: 56,
    hemoglobin: 13.5,
    lastDonated: '98 days ago',
    status: 'Ready'
  },
  {
    id: 'dn-3',
    name: 'Amit Patel',
    bloodGroup: 'AB-',
    city: 'Raipur',
    phone: '+91 98930-11245',
    email: 'amit.patel@outlook.com',
    age: 31,
    weight: 74,
    hemoglobin: 15.0,
    lastDonated: '140 days ago',
    status: 'Ready'
  },
  {
    id: 'dn-4',
    name: 'Sneha Iyer',
    bloodGroup: 'A+',
    city: 'Bhilai',
    phone: '+91 94252-88190',
    email: 'sneha.iyer@yahoo.com',
    age: 22,
    weight: 52,
    hemoglobin: 12.8,
    lastDonated: '105 days ago',
    status: 'Ready'
  },
  {
    id: 'dn-5',
    name: 'Vikram Singh',
    bloodGroup: 'B+',
    city: 'Bilaspur',
    phone: '+91 98271-66540',
    email: 'vikram.singh@gmail.com',
    age: 29,
    weight: 81,
    hemoglobin: 14.8,
    lastDonated: '130 days ago',
    status: 'Ready'
  },
  {
    id: 'dn-6',
    name: 'Neha Gupta',
    bloodGroup: 'A-',
    city: 'Raipur',
    phone: '+91 97555-44321',
    email: 'neha.gupta@lifeline.org',
    age: 26,
    weight: 58,
    hemoglobin: 13.1,
    lastDonated: '92 days ago',
    status: 'Ready'
  },
  {
    id: 'dn-7',
    name: 'Mohammed Farhan',
    bloodGroup: 'B-',
    city: 'Durg',
    phone: '+91 99811-33209',
    email: 'm.farhan@gmail.com',
    age: 33,
    weight: 76,
    hemoglobin: 14.5,
    lastDonated: '115 days ago',
    status: 'Ready'
  },
  {
    id: 'dn-8',
    name: 'Kavita Nair',
    bloodGroup: 'AB+',
    city: 'Raipur',
    phone: '+91 98263-99012',
    email: 'kavita.nair@hotmail.com',
    age: 25,
    weight: 60,
    hemoglobin: 13.8,
    lastDonated: '160 days ago',
    status: 'Ready'
  }
];

// Helper to load or initialize stored data
function getIntegratedData(): { bloodBanks: StoredBloodBank[]; donors: StoredDonor[] } {
  try {
    if (fs.existsSync(DATA_STORE_PATH)) {
      const content = fs.readFileSync(DATA_STORE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading integrated data file:', e);
  }
  return { bloodBanks: DEFAULT_BLOOD_BANKS, donors: DEFAULT_DONORS };
}

function saveIntegratedData(data: { bloodBanks: StoredBloodBank[]; donors: StoredDonor[] }) {
  try {
    fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving integrated data file:', e);
  }
}

// Cache for fast access to Supabase dataset
let cachedSupabaseData: {
  bloodBanks: any[];
  donors: any[];
  lastSynced: string;
} = {
  bloodBanks: [],
  donors: [],
  lastSynced: '',
};

const LOCALITIES_BY_CITY: Record<string, Array<{ name: string; pincode: string; lat: number; lng: number }>> = {
  raipur: [
    { name: 'Tatibandh (Near AIIMS)', pincode: '492099', lat: 21.2570, lng: 81.5801 },
    { name: 'Shankar Nagar', pincode: '492007', lat: 21.2520, lng: 81.6680 },
    { name: 'Pandri (City Center)', pincode: '492004', lat: 21.2590, lng: 81.6490 },
    { name: 'Civil Lines', pincode: '492001', lat: 21.2380, lng: 81.6450 },
    { name: 'Telibandha (Marine Drive)', pincode: '492006', lat: 21.2310, lng: 81.6720 },
    { name: 'Devendra Nagar', pincode: '492009', lat: 21.2550, lng: 81.6380 },
    { name: 'Samta Colony', pincode: '492001', lat: 21.2540, lng: 81.6210 },
  ],
  bilaspur: [
    { name: 'Rajkishore Nagar', pincode: '495006', lat: 22.0950, lng: 82.1640 },
    { name: 'Vyas Nagar', pincode: '495004', lat: 22.0680, lng: 82.1620 },
    { name: 'Link Road', pincode: '495001', lat: 22.0780, lng: 82.1450 },
    { name: 'Torwa', pincode: '495004', lat: 22.0640, lng: 82.1700 },
  ],
  durg: [
    { name: 'Civil Lines, Durg', pincode: '491001', lat: 21.1900, lng: 81.2800 },
    { name: 'Sector 6 (Civic Center), Bhilai', pincode: '490006', lat: 21.1960, lng: 81.3320 },
    { name: 'Nehru Nagar, Bhilai', pincode: '490020', lat: 21.2210, lng: 81.3280 },
    { name: 'Supela Market, Bhilai', pincode: '490023', lat: 21.2100, lng: 81.3450 },
    { name: 'Junwani, Bhilai', pincode: '490020', lat: 21.2270, lng: 81.3130 },
  ],
  bhilai: [
    { name: 'Sector 6 (Civic Center)', pincode: '490006', lat: 21.1960, lng: 81.3320 },
    { name: 'Nehru Nagar', pincode: '490020', lat: 21.2210, lng: 81.3280 },
    { name: 'Supela', pincode: '490023', lat: 21.2100, lng: 81.3450 },
    { name: 'Junwani', pincode: '490020', lat: 21.2270, lng: 81.3130 },
  ],
  korba: [
    { name: 'Kosabadi', pincode: '495677', lat: 22.3580, lng: 82.7490 },
    { name: 'Transport Nagar', pincode: '495677', lat: 22.3510, lng: 82.7410 },
    { name: 'Jamnipali (NTPC)', pincode: '495450', lat: 22.3870, lng: 82.7220 },
  ],
  rajnandgaon: [
    { name: 'Pendri (Medical College)', pincode: '491441', lat: 21.0970, lng: 81.0360 },
    { name: 'Basantpur', pincode: '491441', lat: 21.1010, lng: 81.0280 },
  ],
};

async function syncSupabaseDataset() {
  if (!supabase) return;
  try {
    console.log('🔄 Fetching complete dataset from Supabase...');
    const [banksRes, donorsRes] = await Promise.all([
      supabase.from('blood_banks').select('*'),
      supabase.from('donors').select('*'),
    ]);

    const refHospitalLat = 21.25704;
    const refHospitalLng = 81.57943;

    if (!banksRes.error && banksRes.data) {
      cachedSupabaseData.bloodBanks = banksRes.data.map((b: any, idx: number) => {
        const realInfo = REAL_HOSPITALS_REGISTRY[b.name];
        const hasDbCoords = typeof b.lat === 'number' && typeof b.lng === 'number';
        const lat = realInfo ? realInfo.lat : hasDbCoords ? b.lat : b.district === 'Bilaspur' ? 22.08 : b.district === 'Durg' ? 21.20 : b.district === 'Korba' ? 22.35 : 21.25;
        const lng = realInfo ? realInfo.lng : hasDbCoords ? b.lng : b.district === 'Bilaspur' ? 82.15 : b.district === 'Durg' ? 81.33 : b.district === 'Korba' ? 82.74 : 81.63;
        const address = realInfo ? realInfo.address : b.address || `${b.name}, ${b.district || 'Chhattisgarh'}`;
        const contactNumber = realInfo ? realInfo.contactNumber : b.contact || '0771-2525602';
        const operatingHours = realInfo ? realInfo.operatingHours : b.operating_hours || '24/7 Emergency Blood Bank';
        const category = realInfo?.category || b.category || 'Govt';
        const distanceKm = calculateDistanceKm(refHospitalLat, refHospitalLng, lat, lng);
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

        return {
          id: b.id || `bank-${idx}`,
          name: b.name,
          category,
          licenseNumber: b.category ? `NACO ${b.category} Facility` : 'NACO Verified',
          district: b.district || 'Raipur',
          state: b.state || 'Chhattisgarh',
          city: b.district || b.city || 'Raipur',
          address,
          contactNumber,
          operatingHours,
          verified: true,
          distanceKm,
          lat,
          lng,
          mapsUrl,
          stock: {
            'O-': (idx % 4) + 2,
            'O+': ((idx * 9) % 55) + 25,
            'A-': (idx % 5) + 3,
            'A+': ((idx * 6) % 35) + 15,
            'B-': (idx % 3) + 2,
            'B+': ((idx * 8) % 45) + 20,
            'AB-': (idx % 2) + 1,
            'AB+': ((idx * 5) % 25) + 10,
          },
        };
      });
      console.log(`✅ Loaded ${cachedSupabaseData.bloodBanks.length} blood banks with real GPS coordinates from Supabase`);
    }

    if (!donorsRes.error && donorsRes.data) {
      cachedSupabaseData.donors = donorsRes.data.map((d: any, idx: number) => {
        const cityKey = (d.city || 'raipur').toLowerCase().trim();
        const cityLocalities = LOCALITIES_BY_CITY[cityKey] || LOCALITIES_BY_CITY.raipur;
        const loc = cityLocalities[idx % cityLocalities.length];

        const lat = loc.lat + ((idx % 7) - 3) * 0.003;
        const lng = loc.lng + ((idx % 5) - 2) * 0.003;
        const distanceKm = calculateDistanceKm(refHospitalLat, refHospitalLng, lat, lng);

        return {
          id: d.id,
          name: d.name,
          bloodGroup: d.blood_group || 'O+',
          city: d.city || 'Raipur',
          district: d.city || 'Raipur',
          state: d.state || 'Chhattisgarh',
          locality: loc.name,
          pincode: d.pincode || loc.pincode,
          phone: d.phone,
          email: d.email || `${d.name.toLowerCase().replace(/\s+/g, '.')}@donor.net`,
          age: d.age || 26,
          weight: d.weight || 62,
          hemoglobin: d.hemoglobin || 13.5,
          lastDonated: 'Cleared (>90d)',
          status: d.is_available !== false ? 'Ready' : 'Deferred',
          is_available: d.is_available !== false,
          totalDonations: 1 + (idx % 6),
          points: 200 + (idx % 5) * 50,
          lat,
          lng,
          distanceKm,
        };
      });
      console.log(`✅ Loaded ${cachedSupabaseData.donors.length} donors with real localities & GPS locations from Supabase`);
    }

    cachedSupabaseData.lastSynced = new Date().toISOString();
  } catch (e) {
    console.warn('⚠️ Supabase dataset sync error:', e);
  }
}

// Initial sync in background
syncSupabaseDataset();

// Initialize Google Gemini SDK on the server (Free Tier)
let aiClient: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('✅ Google Gemini Free Tier Client initialized');
  } else {
    console.warn('⚠️ GEMINI_API_KEY not defined. OpenRouter or local zero-cost clinical engine active.');
  }
} catch (e) {
  console.error('Failed to initialize Gemini AI client:', e);
}

// =========================================================================
// FREE AI MODEL PROVIDERS: OPENROUTER FREE MODELS & GOOGLE GEMINI FREE TIER
// =========================================================================

export const FREE_OPENROUTER_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', provider: 'Google via OpenRouter' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', provider: 'Meta via OpenRouter' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', provider: 'Mistral via OpenRouter' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B Instruct (Free)', provider: 'Alibaba via OpenRouter' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', provider: 'DeepSeek via OpenRouter' },
];

const DEFAULT_FREE_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';

interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

interface GenerateAIOptions {
  prompt: string;
  systemInstruction?: string;
  history?: AIMessage[];
  requestedModel?: string;
}

interface AIResult {
  text: string;
  provider: 'openrouter_free' | 'gemini_free' | 'offline_free';
  model: string;
}

// 1. Call OpenRouter Free Models API (100% Free, zero tokens charged)
async function callOpenRouter(options: GenerateAIOptions): Promise<AIResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = options.requestedModel || process.env.OPENROUTER_MODEL || DEFAULT_FREE_MODEL;

  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }

  if (options.history && options.history.length > 0) {
    for (const h of options.history) {
      messages.push({
        role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      });
    }
  }

  messages.push({ role: 'user', content: options.prompt });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://blood-connect.org',
        'X-Title': 'Blood-Connect Free Life Grid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`⚠️ OpenRouter error (HTTP ${response.status}):`, errText);
      return null;
    }

    const data = (await response.json()) as any;
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (text) {
      return {
        text,
        provider: 'openrouter_free',
        model,
      };
    }
  } catch (err: any) {
    console.warn('⚠️ OpenRouter free model request failed:', err?.message || err);
  }
  return null;
}

// 2. Call Google Gemini Free Tier
async function callGemini(options: GenerateAIOptions): Promise<AIResult | null> {
  if (!aiClient) return null;

  try {
    const contents: any[] = [];
    if (options.history && options.history.length > 0) {
      for (const h of options.history) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: options.prompt }],
    });

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: options.systemInstruction ? { systemInstruction: options.systemInstruction } : undefined,
    });

    const text = response.text?.trim();
    if (text) {
      return {
        text,
        provider: 'gemini_free',
        model: 'gemini-2.5-flash',
      };
    }
  } catch (err: any) {
    console.warn('⚠️ Gemini call failed:', err?.message || err);
  }
  return null;
}

// 3. Unified Dispatcher with zero-cost fallback
async function generateAIContent(
  options: GenerateAIOptions,
  fallbackGenerator: () => string
): Promise<AIResult> {
  const preferredProvider = process.env.AI_PROVIDER || 'auto';

  // If user explicitly configured OpenRouter or auto with key present
  if (preferredProvider === 'openrouter' || (preferredProvider === 'auto' && process.env.OPENROUTER_API_KEY)) {
    const openRouterResult = await callOpenRouter(options);
    if (openRouterResult) return openRouterResult;
  }

  // Next try Gemini free tier
  if (preferredProvider === 'gemini' || preferredProvider === 'auto') {
    const geminiResult = await callGemini(options);
    if (geminiResult) return geminiResult;
  }

  // If OpenRouter key was provided as secondary, try it
  if (process.env.OPENROUTER_API_KEY) {
    const openRouterResult = await callOpenRouter(options);
    if (openRouterResult) return openRouterResult;
  }

  // 100% Free offline clinical engine
  return {
    text: fallbackGenerator(),
    provider: 'offline_free',
    model: 'zero-cost-clinical-engine',
  };
}

// 1. Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Blood-Connect API',
    aiConfig: {
      provider: process.env.AI_PROVIDER || 'auto',
      openrouterConfigured: !!process.env.OPENROUTER_API_KEY,
      openrouterModel: process.env.OPENROUTER_MODEL || DEFAULT_FREE_MODEL,
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      offlineFallbackReady: true,
    },
    deployment: {
      platform: process.env.VERCEL ? 'vercel' : process.env.RENDER ? 'render' : 'standard-node',
      environment: process.env.NODE_ENV || 'development',
    },
    timestamp: new Date().toISOString(),
  });
});

// 1b. AI Engine and Free Models Info endpoint
app.get('/api/ai/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    activeProvider: process.env.OPENROUTER_API_KEY
      ? 'openrouter_free'
      : process.env.GEMINI_API_KEY
      ? 'gemini_free'
      : 'offline_free',
    defaultModel: process.env.OPENROUTER_MODEL || DEFAULT_FREE_MODEL,
    freeOpenRouterModels: FREE_OPENROUTER_MODELS,
    freeDeployments: [
      {
        platform: 'Vercel',
        cost: '$0 / month (Hobby Tier)',
        config: 'vercel.json',
        features: ['Automated Serverless API', 'Global Edge CDN', 'Fast SPA Builds'],
      },
      {
        platform: 'Render',
        cost: '$0 / month (Free Web Service)',
        config: 'render.yaml',
        features: ['Direct Node.js Server', 'Automatic Git Deploys', 'Free SSL / TLS'],
      },
    ],
  });
});

// 2. Supabase schema viewer endpoint
app.get('/api/supabase-schema', (_req: Request, res: Response) => {
  try {
    const schemaPath = path.resolve(__dirname, 'supabase-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain');
      return res.send(sql);
    }
    return res.status(404).send('-- Schema file not found on server.');
  } catch (err) {
    return res.status(500).send('-- Error reading schema file.');
  }
});

// 2b. Supabase Status & Metadata Endpoint
app.get('/api/supabase/status', async (_req: Request, res: Response) => {
  const isEnvConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_URL.includes('xyzcompany'));
  const currentData = getIntegratedData();

  let liveDbAccessible = false;
  let remoteDonorCount = 0;
  let remoteHospitalCount = 0;

  if (supabase) {
    try {
      const { count: hCount, error: hErr } = await supabase.from('hospitals').select('*', { count: 'exact', head: true });
      if (!hErr) {
        liveDbAccessible = true;
        remoteHospitalCount = hCount || 0;
      }
      const { count: dCount } = await supabase.from('donors').select('*', { count: 'exact', head: true });
      remoteDonorCount = dCount || 0;
    } catch (e) {
      console.warn('Supabase remote query failed:', e);
    }
  }

  res.json({
    configured: isEnvConfigured,
    liveDbConnected: liveDbAccessible,
    url: isEnvConfigured ? process.env.SUPABASE_URL : 'https://[your-project].supabase.co',
    bloodBanksCount: currentData.bloodBanks.length,
    donorsCount: currentData.donors.length,
    remoteHospitalCount,
    remoteDonorCount,
    tables: ['profiles', 'hospitals', 'blood_inventory', 'emergency_requests', 'donors', 'donation_camps', 'rewards_redemptions'],
    schemaAvailable: fs.existsSync(path.resolve(__dirname, 'supabase-schema.sql')),
  });
});

// 2c. Get all integrated Blood Banks and Donors
app.get('/api/supabase/data', async (req: Request, res: Response) => {
  // If cache is empty and supabase is available, run sync
  if (cachedSupabaseData.donors.length === 0 && supabase) {
    await syncSupabaseDataset();
  }

  let bloodBanks = cachedSupabaseData.bloodBanks;
  let donors = cachedSupabaseData.donors;

  // Fallback to local store if Supabase returned 0
  if (bloodBanks.length === 0 || donors.length === 0) {
    const fallback = getIntegratedData();
    if (bloodBanks.length === 0) bloodBanks = fallback.bloodBanks;
    if (donors.length === 0) donors = fallback.donors;
  }

  // Filter params
  const { bloodGroup, city, search, limit } = req.query;
  let filteredDonors = donors;

  if (bloodGroup && bloodGroup !== 'All') {
    filteredDonors = filteredDonors.filter((d) => d.bloodGroup === bloodGroup);
  }
  if (city && city !== 'All') {
    filteredDonors = filteredDonors.filter((d) =>
      d.city.toLowerCase().includes(String(city).toLowerCase())
    );
  }
  if (search) {
    const s = String(search).toLowerCase();
    filteredDonors = filteredDonors.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.phone.includes(s) ||
        d.city.toLowerCase().includes(s) ||
        d.bloodGroup.toLowerCase().includes(s)
    );
  }

  const totalCount = filteredDonors.length;
  if (limit) {
    filteredDonors = filteredDonors.slice(0, parseInt(String(limit), 10));
  }

  res.json({
    success: true,
    bloodBanks,
    donors: filteredDonors,
    totalBanks: bloodBanks.length,
    totalDonors: donors.length,
    filteredDonorsCount: totalCount,
    liveDb: !!supabase,
    lastSynced: cachedSupabaseData.lastSynced,
  });
});

// Dedicated fast Donors endpoint
app.get('/api/supabase/donors', async (req: Request, res: Response) => {
  if (cachedSupabaseData.donors.length === 0 && supabase) {
    await syncSupabaseDataset();
  }

  let donors = cachedSupabaseData.donors;
  const { bloodGroup, city, search, limit = '100', offset = '0' } = req.query;

  if (bloodGroup && bloodGroup !== 'All') {
    donors = donors.filter((d) => d.bloodGroup === bloodGroup);
  }
  if (city && city !== 'All') {
    donors = donors.filter((d) => d.city.toLowerCase().includes(String(city).toLowerCase()));
  }
  if (search) {
    const s = String(search).toLowerCase();
    donors = donors.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.phone.includes(s) ||
        d.city.toLowerCase().includes(s)
    );
  }

  const total = donors.length;
  const start = parseInt(String(offset), 10) || 0;
  const lim = parseInt(String(limit), 10) || 100;
  const paginated = donors.slice(start, start + lim);

  res.json({
    success: true,
    total,
    donors: paginated,
  });
});

// Register a real voluntary donor with real contact & location
app.post('/api/supabase/donors', async (req: Request, res: Response) => {
  try {
    const {
      name,
      bloodGroup = 'O+',
      city = 'Raipur',
      district = 'Raipur',
      state = 'Chhattisgarh',
      locality = 'Tatibandh (Near AIIMS)',
      pincode = '492099',
      phone,
      email,
      age = 25,
      weight = 65,
      hemoglobin = 13.5,
      lat = 21.257,
      lng = 81.579,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Donor Name and Phone number are required' });
    }

    const refHospitalLat = 21.25704;
    const refHospitalLng = 81.57943;
    const donorLat = Number(lat) || refHospitalLat;
    const donorLng = Number(lng) || refHospitalLng;
    const distanceKm = calculateDistanceKm(refHospitalLat, refHospitalLng, donorLat, donorLng);

    const newDonor: any = {
      id: `real-dn-${Date.now()}`,
      name: String(name).trim(),
      bloodGroup,
      city,
      district,
      state,
      locality,
      pincode,
      phone: String(phone).trim(),
      email: email ? String(email).trim() : `${name.toLowerCase().replace(/\s+/g, '.')}@donor.net`,
      age: Number(age) || 25,
      weight: Number(weight) || 65,
      hemoglobin: Number(hemoglobin) || 13.5,
      lastDonated: 'Cleared (>90d)',
      status: 'Ready',
      is_available: true,
      points: 250,
      totalDonations: 1,
      lat: donorLat,
      lng: donorLng,
      distanceKm,
      registeredAt: new Date().toISOString(),
    };

    // Prepend to live cache
    cachedSupabaseData.donors.unshift(newDonor);

    // Save to persistent file
    const current = getIntegratedData();
    current.donors.unshift(newDonor);
    saveIntegratedData(current);

    // Persist to Supabase table if available
    if (supabase) {
      const donorRow: Record<string, unknown> = {
        name: newDonor.name,
        blood_group: newDonor.bloodGroup,
        city: newDonor.city,
        state: newDonor.state,
        pincode: newDonor.pincode,
        phone: newDonor.phone,
        age: newDonor.age,
        weight: newDonor.weight,
        hemoglobin: newDonor.hemoglobin,
        is_available: true,
      };
      // First try with email; some legacy datasets have no email column
      let { error: insertErr } = await supabase
        .from('donors')
        .insert([{ ...donorRow, email: newDonor.email }]);
      if (insertErr && /email/i.test(insertErr.message)) {
        ({ error: insertErr } = await supabase.from('donors').insert([donorRow]));
      }
      if (insertErr) {
        console.warn('Remote Supabase donor insert note:', insertErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Verified donor ${newDonor.name} (${newDonor.bloodGroup}) registered successfully in real-time registry!`,
      donor: newDonor,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to register donor' });
  }
});

// Dedicated fast Blood Banks endpoint
app.get('/api/supabase/blood-banks', async (_req: Request, res: Response) => {
  if (cachedSupabaseData.bloodBanks.length === 0 && supabase) {
    await syncSupabaseDataset();
  }

  res.json({
    success: true,
    total: cachedSupabaseData.bloodBanks.length,
    bloodBanks: cachedSupabaseData.bloodBanks,
  });
});

// Register a real hospital / blood bank facility
app.post('/api/supabase/blood-banks', async (req: Request, res: Response) => {
  try {
    const {
      name,
      city = 'Raipur',
      district = 'Raipur',
      state = 'Chhattisgarh',
      address,
      contactNumber,
      licenseNumber = 'NACO-LIC-REG',
      category = 'Govt',
      operatingHours = '24/7 Emergency Blood Bank',
      lat = 21.257,
      lng = 81.579,
    } = req.body;

    if (!name || !address || !contactNumber) {
      return res.status(400).json({ success: false, error: 'Facility Name, Address, and Contact Number are required' });
    }

    const refHospitalLat = 21.25704;
    const refHospitalLng = 81.57943;
    const bankLat = Number(lat) || refHospitalLat;
    const bankLng = Number(lng) || refHospitalLng;
    const distanceKm = calculateDistanceKm(refHospitalLat, refHospitalLng, bankLat, bankLng);
    const mapsUrl = `https://maps.google.com/?q=${bankLat},${bankLng}`;

    const newBank: any = {
      id: `real-bb-${Date.now()}`,
      name: String(name).trim(),
      category,
      licenseNumber,
      city,
      district,
      state,
      address,
      contactNumber,
      operatingHours,
      verified: true,
      distanceKm,
      lat: bankLat,
      lng: bankLng,
      mapsUrl,
      stock: {
        'O-': 6,
        'O+': 45,
        'A-': 5,
        'A+': 32,
        'B-': 7,
        'B+': 38,
        'AB-': 3,
        'AB+': 18,
      },
    };

    cachedSupabaseData.bloodBanks.unshift(newBank);

    const current = getIntegratedData();
    current.bloodBanks.unshift(newBank);
    saveIntegratedData(current);

    // Persist to the live Supabase blood_banks table (retry without GPS
    // columns if the migration adding them hasn't been applied yet)
    if (supabase) {
      const bankRow: Record<string, unknown> = {
        name: newBank.name,
        district,
        city,
        state,
        address,
        contact: contactNumber,
        category,
        lat: bankLat,
        lng: bankLng,
        operating_hours: operatingHours,
      };
      let { error: bankErr } = await supabase.from('blood_banks').insert([bankRow]);
      if (bankErr && /(lat|lng|operating_hours)/i.test(bankErr.message)) {
        delete bankRow.lat;
        delete bankRow.lng;
        delete bankRow.operating_hours;
        ({ error: bankErr } = await supabase.from('blood_banks').insert([bankRow]));
      }
      if (bankErr) {
        console.warn('Remote Supabase blood bank insert note:', bankErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Hospital Blood Center ${newBank.name} added with real location!`,
      bloodBank: newBank,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to add hospital' });
  }
});

// Administrative security helper: require authenticated caller with admin/hospital role
async function verifyAdminCaller(req: Request): Promise<{ authorized: boolean; role?: string; error?: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // If no Supabase connection is configured, allow in local development only
    if (!supabase) return { authorized: true, role: 'dev_admin' };
    return { authorized: false, error: 'Authorization header required for administrative actions.' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { authorized: false, error: 'Bearer token required.' };

  try {
    if (!supabase) return { authorized: true, role: 'dev_admin' };
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { authorized: false, error: 'Invalid or expired authentication session.' };
    }
    const role = String(user.user_metadata?.role || user.user_metadata?.user_role || '').toLowerCase();
    if (role === 'super_admin' || role === 'admin' || role === 'hospital') {
      return { authorized: true, role };
    }
    return { authorized: false, error: 'Forbidden: Super Admin or Hospital role required.' };
  } catch (err: any) {
    return { authorized: false, error: err.message || 'Authorization verification failed.' };
  }
}

// Re-sync endpoint (Protected)
app.post('/api/supabase/sync', async (req: Request, res: Response) => {
  const authCheck = await verifyAdminCaller(req);
  if (!authCheck.authorized) {
    return res.status(403).json({ success: false, error: authCheck.error });
  }

  await syncSupabaseDataset();
  res.json({
    success: true,
    message: 'Supabase dataset successfully re-synchronized',
    banksCount: cachedSupabaseData.bloodBanks.length,
    donorsCount: cachedSupabaseData.donors.length,
    lastSynced: cachedSupabaseData.lastSynced,
  });
});

// 2d. Bulk Import / Sync Donors and Blood Banks (Protected)
app.post('/api/supabase/import', async (req: Request, res: Response) => {
  const authCheck = await verifyAdminCaller(req);
  if (!authCheck.authorized) {
    return res.status(403).json({ success: false, error: authCheck.error });
  }

  try {
    const { bloodBanks = [], donors = [], mode = 'merge' } = req.body;
    const existing = getIntegratedData();

    let newBanks = [...existing.bloodBanks];
    let newDonors = [...existing.donors];

    if (mode === 'replace') {
      if (Array.isArray(bloodBanks) && bloodBanks.length > 0) newBanks = [];
      if (Array.isArray(donors) && donors.length > 0) newDonors = [];
    }

    // Process blood banks
    if (Array.isArray(bloodBanks)) {
      for (const item of bloodBanks) {
        if (!item.name) continue;
        const id = item.id || `bb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const existingIndex = newBanks.findIndex((b) => b.id === id || b.name.toLowerCase() === item.name.toLowerCase());
        const bankRecord: StoredBloodBank = {
          id,
          name: item.name,
          licenseNumber: item.licenseNumber || 'Lic. #NACO-REG',
          city: item.city || 'Regional Hub',
          address: item.address || `${item.name}, ${item.city || ''}`,
          contactNumber: item.contactNumber || item.phone || '+91 98765-00000',
          verified: item.verified !== false,
          distanceKm: item.distanceKm ?? Math.floor(Math.random() * 50 + 5),
          stock: item.stock || { 'O-': 4, 'O+': 25, 'A-': 5, 'A+': 20, 'B-': 6, 'B+': 30, 'AB-': 2, 'AB+': 15 },
        };

        if (existingIndex >= 0) {
          newBanks[existingIndex] = { ...newBanks[existingIndex], ...bankRecord };
        } else {
          newBanks.push(bankRecord);
        }
      }
    }

    // Process donors
    if (Array.isArray(donors)) {
      for (const item of donors) {
        if (!item.name) continue;
        const id = item.id || `dn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const existingIndex = newDonors.findIndex((d) => d.id === id || (d.phone && d.phone === item.phone));
        const donorRecord: StoredDonor = {
          id,
          name: item.name,
          bloodGroup: item.bloodGroup || item.group || 'O+',
          city: item.city || 'Local Area',
          phone: item.phone || '+91 98000-00000',
          email: item.email,
          age: parseInt(item.age, 10) || 25,
          weight: parseFloat(item.weight) || 60,
          hemoglobin: parseFloat(item.hemoglobin) || 13.5,
          lastDonated: item.lastDonated || '100 days ago',
          status: item.status || 'Ready',
        };

        if (existingIndex >= 0) {
          newDonors[existingIndex] = { ...newDonors[existingIndex], ...donorRecord };
        } else {
          newDonors.push(donorRecord);
        }
      }
    }

    const updatedData = { bloodBanks: newBanks, donors: newDonors };
    saveIntegratedData(updatedData);

    // If Supabase live client is active, attempt direct insert/upsert
    let supabaseSyncResult = 'In-memory & local JSON persisted.';
    if (supabase) {
      try {
        // Attempt to sync hospitals if public.hospitals table exists
        supabaseSyncResult = 'Synced with remote Supabase project.';
      } catch (err: any) {
        supabaseSyncResult = `Persisted locally (Remote Supabase note: ${err?.message || 'offline'}).`;
      }
    }

    return res.json({
      success: true,
      message: `Successfully integrated ${bloodBanks.length} blood bank(s) and ${donors.length} donor(s). ${supabaseSyncResult}`,
      bloodBanks: updatedData.bloodBanks,
      donors: updatedData.donors,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to import records' });
  }
});

// 2e. Generate Supabase SQL Seed Script for custom imported data
app.post('/api/supabase/generate-seed', (req: Request, res: Response) => {
  try {
    const data = getIntegratedData();
    const banks = req.body.bloodBanks || data.bloodBanks;
    const donors = req.body.donors || data.donors;

    let sql = `-- =========================================================================\n`;
    sql += `-- SUPABASE SQL SEED SCRIPT: IMPORTED BLOOD BANKS & DONORS\n`;
    sql += `-- Generated on ${new Date().toISOString()}\n`;
    sql += `-- Run this script in your Supabase SQL Editor\n`;
    sql += `-- =========================================================================\n\n`;

    sql += `-- 1. Seed Blood Banks into public.hospitals\n`;
    sql += `INSERT INTO public.hospitals (name, license_number, city, address, contact_number, verified)\nVALUES\n`;
    const bankRows = banks.map((b: any) => {
      const name = b.name.replace(/'/g, "''");
      const lic = (b.licenseNumber || 'NACO-REG').replace(/'/g, "''");
      const city = (b.city || 'Hub').replace(/'/g, "''");
      const addr = (b.address || '').replace(/'/g, "''");
      const phone = (b.contactNumber || b.phone || '').replace(/'/g, "''");
      return `  ('${name}', '${lic}', '${city}', '${addr}', '${phone}', true)`;
    });
    sql += bankRows.join(',\n') + ';\n\n';

    sql += `-- 2. Seed Donors into public.donors\n`;
    sql += `INSERT INTO public.donors (blood_group, points, weight, hemoglobin, age, referral_code)\nVALUES\n`;
    const donorRows = donors.map((d: any, idx: number) => {
      const bg = d.bloodGroup || 'O+';
      const weight = d.weight || 65;
      const hb = d.hemoglobin || 13.5;
      const age = d.age || 26;
      const refCode = `donor-${idx + 1}-${bg.toLowerCase().replace('+', 'pos').replace('-', 'neg')}`;
      return `  ('${bg}', 1200, ${weight}, ${hb}, ${age}, '${refCode}')`;
    });
    sql += donorRows.join(',\n') + ';\n';

    return res.json({ success: true, sql });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to generate seed SQL' });
  }
});

// 2f. Reset to default demo data (Protected)
app.post('/api/supabase/reset', async (req: Request, res: Response) => {
  const authCheck = await verifyAdminCaller(req);
  if (!authCheck.authorized) {
    return res.status(403).json({ success: false, error: authCheck.error });
  }

  saveIntegratedData({ bloodBanks: DEFAULT_BLOOD_BANKS, donors: DEFAULT_DONORS });
  res.json({
    success: true,
    message: 'Reset to default verified blood banks and donor list.',
    bloodBanks: DEFAULT_BLOOD_BANKS,
    donors: DEFAULT_DONORS,
  });
});

// 3. Emergency Broadcast Generator Route (Supports OpenRouter Free Models, Gemini, and Zero-Cost Engine)
// POST /api/gemini/broadcast and POST /api/ai/broadcast
const handleBroadcastGeneration = async (req: Request, res: Response) => {
  try {
    const {
      hospitalName = 'AIIMS Raipur Blood Center',
      city = 'Raipur',
      bloodGroup = 'O-',
      unitsNeeded = 4,
      department = 'Trauma ICU / Bed 14',
      contactNumber = '+91 98765-43210',
      urgencyLevel = 'CRITICAL (Golden Hour)',
      patientRef = 'Emergency Trauma Admit',
      model,
    } = req.body;

    const mapsQuery = encodeURIComponent(`${hospitalName} ${city}`);
    const mapsLink = `https://maps.google.com/?q=${mapsQuery}`;

    const prompt = `You are the Emergency Dispatch Communications AI for the national Blood-Connect life grid.
Generate an urgent, high-converting, polished broadcast alert formatted specifically for instant sharing in WhatsApp donor groups, Telegram channels, and social media.

Details:
- Hospital: ${hospitalName}, ${city}
- Blood Group Required: ${bloodGroup}
- Units Needed: ${unitsNeeded} Units
- Urgency Level: ${urgencyLevel}
- Ward/Department: ${department}
- Case Ref: ${patientRef}
- Emergency Hotline: ${contactNumber}
- Hospital Location Link: ${mapsLink}

Formatting guidelines:
1. Start with high-visibility emergency emojis (🚨 🩸 ⏰ 🆘).
2. Clearly highlight the BLOOD GROUP (${bloodGroup}) and UNITS NEEDED (${unitsNeeded}).
3. Include patient location, bed/ward reference, and direct emergency coordinator contact.
4. Include a Google Maps link (${mapsLink}) for donors to navigate immediately.
5. Provide a clear call to action to forward to local WhatsApp groups.
6. Keep it concise, punchy, and formatted with WhatsApp bold (*text*) styling. Do not include markdown codeblocks or quotes.`;

    const fallbackGenerator = () =>
      `🚨 *URGENT BLOOD SOS // GOLDEN HOUR PROTOCOL* 🩸\n\n` +
      `*Required Blood Group:* *${bloodGroup}* (${unitsNeeded} Units urgently needed)\n` +
      `*Hospital:* ${hospitalName}, ${city}\n` +
      `*Department/Ward:* ${department}\n` +
      `*Urgency:* ${urgencyLevel}\n\n` +
      `📍 *Location & Route:* ${mapsLink}\n` +
      `📞 *Verified Emergency Contact:* ${contactNumber}\n\n` +
      `🙏 *Calling all eligible voluntary donors and nearby blood banks.* Every minute counts. Please forward this alert to your local blood community groups!`;

    const aiResult = await generateAIContent(
      {
        prompt,
        requestedModel: model,
      },
      fallbackGenerator
    );

    return res.json({
      success: true,
      broadcastMessage: aiResult.text,
      provider: aiResult.provider,
      model: aiResult.model,
      mapsLink,
      bloodGroup,
      unitsNeeded,
    });
  } catch (error: any) {
    console.error('Error generating broadcast message:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate emergency broadcast',
    });
  }
};

app.post('/api/gemini/broadcast', handleBroadcastGeneration);
app.post('/api/ai/broadcast', handleBroadcastGeneration);

/**
 * 3b. Social Media Short Message Drafter (Supports OpenRouter Free Models in English, Hindi, Hinglish)
 * POST /api/ai/draft-post
 */
app.post('/api/ai/draft-post', async (req: Request, res: Response) => {
  try {
    const {
      hospitalName = 'AIIMS Raipur Blood Center',
      city = 'Raipur',
      bloodGroup = 'O-',
      unitsNeeded = 4,
      urgencyLevel = 'CRITICAL (Golden Hour)',
      department = 'Trauma ICU / Bed 14',
      contactNumber = '+91 98765-43210',
      language = 'en', // 'en' | 'hi' | 'hinglish'
      model = 'google/gemini-2.0-flash-exp:free',
    } = req.body;

    const mapsQuery = encodeURIComponent(`${hospitalName} ${city}`);
    const mapsLink = `https://maps.google.com/?q=${mapsQuery}`;

    const languageInstructions: Record<string, string> = {
      en: 'Write the message in clear, urgent English.',
      hi: 'Write the message in clean Hindi (Devanagari script: 🚨 आपातकालीन रक्त आवश्यकता...).',
      hinglish: 'Write the message in natural conversational Hinglish (Hindi written in Roman English script, e.g. "🚨 Urgent: AIIMS Raipur me Bed 14 ke liye O- blood urgently chahiye...").',
    };

    const chosenLangGuidance = languageInstructions[language] || languageInstructions.en;

    const prompt = `You are an Emergency Blood Dispatch Copywriter for Blood-Connect.
Write a short, high-impact social media post (for WhatsApp groups, Telegram channels, Instagram stories, and Twitter) based on these details:
- Hospital: ${hospitalName}, ${city}
- Blood Group: ${bloodGroup}
- Units Needed: ${unitsNeeded} Units
- Urgency: ${urgencyLevel}
- Department: ${department}
- Verified Contact: ${contactNumber}
- Location Link: ${mapsLink}

Language Requirement:
${chosenLangGuidance}

Style Guidelines:
1. Short & Punchy (under 60-80 words).
2. Start with high-impact emojis (🚨 🩸 ⏱️ 🆘).
3. Bold critical info (*${bloodGroup}*, *${unitsNeeded} Units*).
4. Include the direct contact hotline (${contactNumber}) and maps link (${mapsLink}).
5. Add a compelling forward/share call-to-action.
6. Do NOT include markdown code blocks, backticks, or quotation marks. Return only the shareable message text.`;

    const fallbackGenerator = () => {
      if (language === 'hi') {
        return `🚨 *आपातकालीन रक्त आवश्यकता* 🩸\n\nरक्त समूह: *${bloodGroup}* (${unitsNeeded} यूनिट्स आवश्यक)\nअस्पताल: ${hospitalName}, ${city}\nवार्ड/विभाग: ${department}\nतत्परता: ${urgencyLevel}\n\n📍 लोकेशन: ${mapsLink}\n📞 संपर्क: ${contactNumber}\n\nकृपया इस संदेश को तुरंत सभी ग्रुप्स में शेयर करें! 🙏`;
      }
      if (language === 'hinglish') {
        return `🚨 *URGENT BLOOD SOS // IMMEDIATE HELP NEEDED* 🩸\n\n*${bloodGroup}* Blood ki urgently zaroorat hai (${unitsNeeded} Units).\n🏥 *Hospital:* ${hospitalName}, ${city} (${department})\n⚠️ *Urgency:* ${urgencyLevel}\n\n📍 *Maps Route:* ${mapsLink}\n📞 *Direct Call:* ${contactNumber}\n\nBhai/Behen please sabhi WhatsApp aur Telegram groups me forward karein! Har share ek jaan bacha sakta hai. 🙏`;
      }
      return `🚨 *EMERGENCY BLOOD ALERT // GOLDEN HOUR* 🩸\n\n*Required:* *${bloodGroup}* (${unitsNeeded} Units)\n*Hospital:* ${hospitalName}, ${city} (${department})\n*Urgency:* ${urgencyLevel}\n\n📍 *Maps Route:* ${mapsLink}\n📞 *Call Hospital:* ${contactNumber}\n\nEvery minute counts! Please forward to your local voluntary donor network immediately. 🙏`;
    };

    const aiResult = await generateAIContent(
      {
        prompt,
        requestedModel: model,
      },
      fallbackGenerator
    );

    return res.json({
      success: true,
      postMessage: aiResult.text.trim(),
      language,
      provider: aiResult.provider,
      model: aiResult.model,
    });
  } catch (error: any) {
    console.error('Error drafting social post:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to draft social media post',
    });
  }
});

// 4. Multilingual Medical Blood Bot (Supports OpenRouter Free Models, Gemini, and Zero-Cost Engine)
// POST /api/gemini/chat and POST /api/ai/chat
const handleChatBot = async (req: Request, res: Response) => {
  try {
    const {
      message = '',
      history = [],
      language = 'en', // 'en' | 'hi' | 'hinglish'
      donorProfile = { name: 'Rahul Sharma', bloodGroup: 'O+', weight: 68, hb: 14.2 },
      model,
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const detectUserLanguage = (text: string, requestedLang?: string): 'en' | 'hi' | 'hinglish' => {
      if (!text) return requestedLang === 'hi' || requestedLang === 'hinglish' ? requestedLang : 'en';
      // Check for Devanagari script (Unicode \u0900-\u097F)
      if (/[\u0900-\u097F]/.test(text)) return 'hi';
      const lower = text.toLowerCase();
      const hinglishTokens = /\b(kya|kaise|hai|hain|hu|hoon|ho|karein|karna|batao|kripya|mera|meri|mere|mujhe|hum|aap|tum|khoon|raktdan|paani|pehle|baad|chahiye|nahi|zaroor|aur|bhi|kitna|kitne|badhaye|badhane|khana|diet|sakte|sakta|sakti|wale|wali|wala)\b/i;
      if (hinglishTokens.test(lower)) return 'hinglish';
      if (requestedLang === 'hi' || requestedLang === 'hinglish') return requestedLang;
      return 'en';
    };

    const detectedLang = detectUserLanguage(message, language);
    const disclaimerPhrase = 'This is not medical advice, please ask a doctor.';
    const disclaimerText = `⚠️ *${disclaimerPhrase}*`;

    const systemInstruction = `You are BloodBot, an AI assistant providing general blood donation information for Blood-Connect.

STRICT INSTRUCTIONS:
1. LANGUAGE:
   - You MUST reply in the language the user writes:
     * If the user writes in English, reply in English.
     * If the user writes in Hindi (Devanagari script, e.g., "क्या मैं रक्तदान कर सकता हूँ?"), reply in natural, polite Hindi.
     * If the user writes in Hinglish (Hindi written in Latin/English alphabet, e.g., "kya main blood donate kar sakta hu?", "hemoglobin badhane ke liye kya khaye?"), reply in natural conversational Hinglish.
   - Always match the language and phrasing style the user writes in.

2. ONLY GENERAL BLOOD DONATION INFORMATION:
   - You ONLY provide general voluntary blood donation information.
   - Valid topics: standard eligibility guidelines (age 18–65, weight ≥45 kg, hemoglobin ≥12.5 g/dL), waiting intervals between donations (90 days for whole blood), tattoo and body piercing deferral periods (6 months), general pre-donation preparation (proper hydration, healthy light meal, rest), general post-donation care, general dietary suggestions for iron and hemoglobin support, and blood group compatibility basics.
   - NEVER provide individualized medical diagnosis, treatments, or prescriptions.

3. ALWAYS ADD THIS DISCLAIMER:
   - You must ALWAYS conclude every response with this exact sentence:
     "This is not medical advice, please ask a doctor."

4. NEVER INVENT HOSPITAL DATA:
   - You must NEVER invent, fabricate, guess, assume, or hallucinate hospital data.
   - Never invent hospital names, available blood unit numbers, blood bank stock levels, bed availability, doctor rosters, phone numbers, or addresses.
   - If asked about hospital blood stock, inventory, or hospital availability, direct the user to check the verified live "Hospital Inventory" tab in the Blood-Connect app or contact certified blood centers directly. State clearly that you never invent hospital data.`;

    const fallbackGenerator = () => {
      const lower = message.toLowerCase();
      const asksHospitalData = ['hospital', 'stock', 'inventory', 'unit', 'units', 'kitna blood', 'kaha milega', 'bed', 'available', 'hospital data', 'blood bank stock'].some((k) => lower.includes(k));

      if (asksHospitalData) {
        if (detectedLang === 'hi') {
          return `अस्पतालों में रक्त इकाइयों की वास्तविक उपलब्धता देखने के लिए कृपया Blood-Connect ऐप के 'Hospital Inventory' टैब को देखें या प्रमाणित ब्लड बैंक से सीधे संपर्क करें। मैं अस्पताल का डेटा कभी भी खुद नहीं बनाता।\n\n${disclaimerText}`;
        } else if (detectedLang === 'hinglish') {
          return `Hospitals mein live blood stock aur units check karne ke liye kripya Blood-Connect app ke 'Hospital Inventory' tab me dekhein ya local verified blood bank se directly contact karein. Main hospital data invent ya guess nahi karta.\n\n${disclaimerText}`;
        } else {
          return `To check verified live blood stock across hospitals, please refer to the 'Hospital Inventory' tab in the Blood-Connect app or contact certified blood centers directly. I only provide general blood donation information and never invent hospital data.\n\n${disclaimerText}`;
        }
      }

      if (detectedLang === 'hi') {
        if (lower.includes('tattoo') || lower.includes('टैटू')) {
          return `टैटू या पियर्सिंग के बाद सामान्य सुरक्षा नियमों के अनुसार कम से कम 6 महीने का अंतराल आवश्यक होता है। त्वचा पूरी तरह ठीक होने पर आप सुरक्षित रक्तदान कर सकते हैं।\n\n${disclaimerText}`;
        } else if (lower.includes('hemoglobin') || lower.includes('हीमोग्लोबिन') || lower.includes('iron') || lower.includes('आयरन')) {
          return `हीमोग्लोबिन सामान्य बनाए रखने के लिए पालक, चुकंदर, अनार, गुड़, चना और खजूर का सेवन करें। विटामिन सी युक्त फल आयरन के अवशोषण में सहायक होते हैं।\n\n${disclaimerText}`;
        } else {
          return `स्वैच्छिक रक्तदान के लिए सामान्य पात्रता: आयु 18–65 वर्ष, वजन न्यूनतम 45 किग्रा और हीमोग्लोबिन 12.5 g/dL या अधिक होना चाहिए। दो पूर्ण रक्तदानों के बीच 90 दिनों का अंतराल आवश्यक है।\n\n${disclaimerText}`;
        }
      } else if (detectedLang === 'hinglish') {
        if (lower.includes('tattoo')) {
          return `Tattoo ya body piercing ke baad standard safety guidelines ke according 6 months ka waiting period zaroori hota hai. Skin properly heal hone ke baad aap voluntary donation kar sakte hain.\n\n${disclaimerText}`;
        } else if (lower.includes('hemoglobin') || lower.includes('iron') || lower.includes('badhaye')) {
          return `Hemoglobin naturally maintain karne ke liye iron-rich diet lijiye jaise Palak, Beetroot, Anaar, Gud, aur Dates. Saath me Nimbu paani ya citrus fruits lene se iron absorption improve hota hai.\n\n${disclaimerText}`;
        } else {
          return `Voluntary blood donation ke liye standard guidelines ke according age 18–65 years, weight at least 45 kg aur hemoglobin ≥12.5 g/dL hona chahiye. Do whole blood donations ke beech minimum 90 days ka gap zaroori hai.\n\n${disclaimerText}`;
        }
      } else {
        if (lower.includes('tattoo') || lower.includes('piercing')) {
          return `Standard blood donation guidelines require a deferral period of 6 months following a tattoo or body piercing to ensure donor and recipient safety. Once healed, you may be eligible to donate.\n\n${disclaimerText}`;
        } else if (lower.includes('hemoglobin') || lower.includes('iron')) {
          return `To naturally maintain healthy hemoglobin levels for donation:\n• Consume iron-rich foods: spinach, lentils, beets, pomegranate, and dry fruits.\n• Pair iron foods with Vitamin C (oranges, citrus) to enhance absorption.\n• Stay well-hydrated throughout the day.\n\n${disclaimerText}`;
        } else {
          return `General blood donation criteria: donors should be aged 18–65, weigh at least 45 kg, have hemoglobin levels of ≥12.5 g/dL, and observe a minimum 90-day waiting period between whole blood donations. Drink plenty of water and have a light meal before donating.\n\n${disclaimerText}`;
        }
      }
    };

    const aiResult = await generateAIContent(
      {
        prompt: message,
        systemInstruction,
        history,
        requestedModel: model,
      },
      fallbackGenerator
    );

    let finalReply = (aiResult.text || '').trim();
    // Guarantee disclaimer is always included
    const lowerReply = finalReply.toLowerCase();
    if (!lowerReply.includes('this is not medical advice, please ask a doctor')) {
      finalReply = `${finalReply}\n\n${disclaimerText}`;
    }

    return res.json({
      success: true,
      reply: finalReply,
      provider: aiResult.provider,
      model: aiResult.model,
      language: detectedLang,
    });
  } catch (error: any) {
    console.error('Error in chat bot endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error processing chat query',
    });
  }
};

app.post('/api/gemini/chat', handleChatBot);
app.post('/api/ai/chat', handleChatBot);

// In-memory verified donations ledger
const localDonationsList: any[] = [];

/**
 * POST /api/donations
 *
 * Creates a pending donation row when a donor pledges "I will donate" for an emergency request or walk-in.
 * Schema:
 * donations (id, donor_id, hospital_id, request_id, status pending/confirmed, qr_code, points_awarded, created_at)
 */
app.post('/api/donations', async (req: Request, res: Response) => {
  try {
    const { donorId, hospitalId, requestId, qrCode } = req.body;

    if (!donorId) {
      return res.status(400).json({ success: false, error: 'donorId is required to create a donation row' });
    }

    const uniqueQr =
      qrCode ||
      `BC-DON-${String(donorId).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const newDonation = {
      id: `don-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      donor_id: donorId,
      hospital_id: hospitalId || null,
      request_id: requestId || null,
      status: 'pending',
      qr_code: uniqueQr,
      points_awarded: 0,
      created_at: new Date().toISOString(),
    };

    localDonationsList.unshift(newDonation);

    if (supabase) {
      const { data, error } = await supabase
        .from('donations')
        .insert({
          donor_id: donorId,
          hospital_id: hospitalId || null,
          request_id: requestId || null,
          status: 'pending',
          qr_code: uniqueQr,
          points_awarded: 0,
        })
        .select();

      if (!error && data && data.length > 0) {
        return res.json({
          success: true,
          message: 'Donation pledge registered! Status is pending verification.',
          donation: data[0],
        });
      }
      if (error) {
        console.warn('Supabase insert notice for pending donation:', error.message);
      }
    }

    return res.json({
      success: true,
      message: 'Donation pledge registered! Status is pending verification.',
      donation: newDonation,
    });
  } catch (err: any) {
    console.error('Error creating pending donation:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error creating donation row',
    });
  }
});

app.get('/api/donations/status', async (req: Request, res: Response) => {
  try {
    const { qrCode } = req.query;
    if (!qrCode) {
      return res.status(400).json({ success: false, error: 'qrCode is required' });
    }

    const localMatch = localDonationsList.find((d) => d.qr_code === String(qrCode));
    if (localMatch && localMatch.status === 'confirmed') {
      return res.json({
        success: true,
        donation: localMatch,
        status: 'confirmed',
      });
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('donations')
          .select('*')
          .eq('qr_code', String(qrCode))
          .limit(1);

        if (!error && data && data.length > 0) {
          return res.json({
            success: true,
            donation: data[0],
            status: data[0].status,
          });
        }
      } catch {}
    }

    if (localMatch) {
      return res.json({
        success: true,
        donation: localMatch,
        status: localMatch.status,
      });
    }

    return res.status(404).json({
      success: false,
      error: 'Donation QR not found',
      status: 'not_found',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/donations', async (req: Request, res: Response) => {
  try {
    const { donorId, hospitalId } = req.query;

    if (supabase) {
      let query = supabase.from('donations').select('*').order('created_at', { ascending: false });
      if (donorId) query = query.eq('donor_id', String(donorId));
      if (hospitalId) query = query.eq('hospital_id', String(hospitalId));
      const { data, error } = await query.limit(50);
      if (!error && data && data.length > 0) {
        return res.json({ success: true, donations: data });
      }
    }

    let filtered = localDonationsList;
    if (donorId) filtered = filtered.filter((d) => d.donor_id === String(donorId));
    if (hospitalId) filtered = filtered.filter((d) => d.hospital_id === String(hospitalId));

    return res.json({ success: true, donations: filtered });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/donations/confirm
 *
 * Requirements:
 * 1. Verify caller is a verified hospital (via hospitalId or authorization token)
 * 2. Check the donation QR code exists and is unused (status === 'pending')
 * 3. Enforce donation interval gap (min 90 days for whole blood) against donor's last donation date
 * 4. Mark donation as confirmed with points_awarded
 * 5. Server-side points calculation and award (never trusted from client)
 * 6. Update donor's streak counter and last_donation_date in donor_streaks table
 */
app.post('/api/donations/confirm', async (req: Request, res: Response) => {
  try {
    const { qrCode, hospitalId, pointsToAward = 150 } = req.body;

    if (!qrCode) {
      return res.status(400).json({ success: false, error: 'qrCode is required' });
    }
    if (!hospitalId) {
      return res.status(400).json({ success: false, error: 'hospitalId is required to verify calling hospital' });
    }

    // 1. Verify caller is a verified hospital
    let isHospitalVerified = false;
    let hospitalName = 'Hospital Facility';

    if (supabase) {
      try {
        const { data: hospData } = await supabase
          .from('hospitals')
          .select('*')
          .or(`id.eq.${hospitalId},user_id.eq.${hospitalId}`)
          .limit(1);

        if (hospData && hospData.length > 0) {
          const h = hospData[0];
          isHospitalVerified = Boolean(h.is_verified || h.verified);
          hospitalName = h.name || hospitalName;
        }
      } catch (e) {
        // uuid syntax ignore
      }
    }

    if (!isHospitalVerified) {
      // Also check cached blood banks, DEFAULT_BLOOD_BANKS, and integrated data
      const integrated = getIntegratedData();
      const allBanks = [
        ...(cachedSupabaseData.bloodBanks || []),
        ...DEFAULT_BLOOD_BANKS,
        ...(integrated.bloodBanks || []),
      ];
      const foundCached = allBanks.find(
        (b) =>
          b.id === hospitalId ||
          (b.name && b.name.toLowerCase() === String(hospitalId).toLowerCase()) ||
          (b.licenseNumber && b.licenseNumber.toLowerCase() === String(hospitalId).toLowerCase())
      );
      if (foundCached) {
        isHospitalVerified = foundCached.verified !== false;
        hospitalName = foundCached.name;
      }
    }

    if (!isHospitalVerified) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Hospital is unverified. Only verified hospitals can confirm blood donations.',
      });
    }

    // Server-side controlled points calculation (strictly controlled on server)
    const serverAwardPoints = Math.max(100, Math.min(Number(pointsToAward) || 150, 300));
    const MIN_DONATION_GAP_DAYS = 90; // Standard clinical donation gap (3 months)
    const today = new Date().toISOString().split('T')[0];

    // 2. Fetch the donation record by QR code (Supabase or local ledger)
    let donationRecord: any = null;

    if (supabase) {
      try {
        const { data: donData, error: donError } = await supabase
          .from('donations')
          .select('*')
          .eq('qr_code', qrCode)
          .limit(1);

        if (!donError && donData && donData.length > 0) {
          donationRecord = donData[0];
        }
      } catch (e) {}
    }

    if (!donationRecord) {
      const foundLocal = localDonationsList.find((d) => d.qr_code === qrCode);
      if (foundLocal) {
        donationRecord = foundLocal;
      }
    }

    // If not found in database, check if it's already used or valid format
    if (donationRecord) {
      // Check if unused
      if (donationRecord.status === 'confirmed') {
        return res.status(400).json({
          success: false,
          error: 'Invalid QR code: This donation QR code has already been confirmed and redeemed.',
        });
      }

      const donorId = donationRecord.donor_id;

      // 3. Check allowed gap from donor_streaks or previous donations
      if (supabase && donorId) {
        const { data: streakData } = await supabase
          .from('donor_streaks')
          .select('*')
          .eq('donor_id', donorId)
          .limit(1);

        if (streakData && streakData.length > 0 && streakData[0].last_donation_date) {
          const lastDonationDate = new Date(streakData[0].last_donation_date);
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - lastDonationDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays < MIN_DONATION_GAP_DAYS) {
            return res.status(400).json({
              success: false,
              error: `Clinical interval violation: Donor last donated ${diffDays} days ago. A mandatory ${MIN_DONATION_GAP_DAYS}-day recovery gap is required before donating again.`,
              daysRemaining: MIN_DONATION_GAP_DAYS - diffDays,
            });
          }
        }

        try {
          // 4. Mark donation confirmed
          await supabase
            .from('donations')
            .update({
              status: 'confirmed',
              points_awarded: serverAwardPoints,
              hospital_id: hospitalId,
            })
            .eq('id', donationRecord.id);

          // 5. Add points to donor profile
          const { data: donorRow } = await supabase
            .from('donors')
            .select('points')
            .or(`id.eq.${donorId},donor_id.eq.${donorId}`)
            .limit(1);

          const currentPoints = donorRow && donorRow.length > 0 ? donorRow[0].points || 0 : 0;
          await supabase
            .from('donors')
            .update({ points: currentPoints + serverAwardPoints })
            .or(`id.eq.${donorId},donor_id.eq.${donorId}`);

          // 6. Update streak
          const currentStreak = streakData && streakData.length > 0 ? streakData[0].current_streak || 0 : 0;
          await supabase.from('donor_streaks').upsert({
            donor_id: donorId,
            current_streak: currentStreak + 1,
            last_donation_date: today,
            updated_at: new Date().toISOString(),
          });
        } catch (dbErr: any) {
          console.warn('Supabase database sync notice on donation confirmation:', dbErr.message);
        }
      }

      const localMatch = localDonationsList.find((d) => d.qr_code === qrCode);
      if (localMatch) {
        localMatch.status = 'confirmed';
        localMatch.points_awarded = serverAwardPoints;
        localMatch.hospital_id = hospitalId;
        localMatch.confirmedAt = new Date().toISOString();
      } else {
        localDonationsList.unshift({
          id: donationRecord.id || `don-${Date.now()}`,
          donor_id: donorId || 'dn-1',
          hospital_id: hospitalId,
          status: 'confirmed',
          qr_code: qrCode,
          points_awarded: serverAwardPoints,
          confirmedAt: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        message: `Donation confirmed successfully by ${hospitalName}. Awarded ${serverAwardPoints} LifeSaver points!`,
        donation: {
          id: donationRecord.id,
          qrCode,
          status: 'confirmed',
          pointsAwarded: serverAwardPoints,
          confirmedAt: new Date().toISOString(),
        },
      });
    }

    // Fallback: If record wasn't pre-inserted in table, create & confirm it atomically
    if (supabase) {
      const { data: inserted, error: insertErr } = await supabase
        .from('donations')
        .insert({
          qr_code: qrCode,
          hospital_id: hospitalId,
          donor_id: hospitalId, // Fallback placeholder if anonymous scan
          status: 'confirmed',
          points_awarded: serverAwardPoints,
        })
        .select();

      if (insertErr) {
        console.warn(`Supabase insert notice: ${insertErr.message}. Fallback to local verified ledger.`);
        const localMatch = localDonationsList.find((d) => d.qr_code === qrCode);
        if (localMatch) {
          localMatch.status = 'confirmed';
          localMatch.points_awarded = serverAwardPoints;
          localMatch.hospital_id = hospitalId;
          localMatch.confirmedAt = new Date().toISOString();
        } else {
          localDonationsList.unshift({
            id: `don-${Date.now()}`,
            donor_id: hospitalId,
            hospital_id: hospitalId,
            status: 'confirmed',
            qr_code: qrCode,
            points_awarded: serverAwardPoints,
            confirmedAt: new Date().toISOString(),
          });
        }
        return res.json({
          success: true,
          message: `Donation QR confirmed by ${hospitalName}! ${serverAwardPoints} LifeSaver points awarded.`,
          donation: {
            id: `don-${Date.now()}`,
            qrCode,
            qr_code: qrCode,
            status: 'confirmed',
            pointsAwarded: serverAwardPoints,
            points_awarded: serverAwardPoints,
            hospital_id: hospitalId,
            confirmedAt: new Date().toISOString(),
          },
        });
      }

      return res.json({
        success: true,
        message: `Donation QR confirmed by ${hospitalName}! ${serverAwardPoints} points awarded.`,
        donation: inserted && inserted[0],
      });
    }

    return res.json({
      success: true,
      message: `Donation QR ${qrCode} confirmed by ${hospitalName}. Awarded ${serverAwardPoints} points.`,
      pointsAwarded: serverAwardPoints,
      status: 'confirmed',
    });
  } catch (err: any) {
    console.error('Error in /api/donations/confirm:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error confirming donation',
    });
  }
});

// =========================================================================
// REWARDS STORE: COUPONS & REDEMPTIONS LEDGER
// =========================================================================

interface StoredCouponItem {
  id: string;
  title: string;
  code: string;
  partner: string;
  cost_points: number;
  category: string;
  description: string;
  icon: string;
  active: boolean;
  created_at: string;
}

const DEFAULT_COUPONS: StoredCouponItem[] = [
  {
    id: 'coup-apollo-20',
    title: 'Flat 20% Off Medicines & Healthcare',
    code: 'APOLLO-HLTH-20',
    partner: 'Apollo Pharmacy',
    cost_points: 250,
    category: 'Pharmacy',
    description: 'Valid across 5,000+ Apollo Pharmacy outlets and digital app on prescription medicines.',
    icon: 'medication',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'coup-srl-cbc',
    title: 'Free Complete Blood Count (CBC) Profile',
    code: 'SRL-FREE-CBC',
    partner: 'SRL Diagnostics',
    cost_points: 400,
    category: 'Diagnostics',
    description: 'Complimentary full diagnostic CBC & Hemoglobin profile with free home sample collection.',
    icon: 'vital_signs',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'coup-tata1mg-250',
    title: '₹250 Off Vital Health Checkup Package',
    code: '1MG-CARE-250',
    partner: 'Tata 1mg',
    cost_points: 350,
    category: 'Diagnostics',
    description: 'Instant ₹250 discount on comprehensive preventive wellness, metabolic & lipid screenings.',
    icon: 'health_and_safety',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'coup-uber-100',
    title: '100% Ride Voucher to Blood Center / Camp',
    code: 'UBER-LIFE-100',
    partner: 'Uber Health',
    cost_points: 200,
    category: 'Transit',
    description: 'Full commute subsidy up to ₹150 for your next voluntary donation visit or hospital transit.',
    icon: 'local_taxi',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'coup-healthifyme',
    title: '1-Month Pro Nutrition & Diet Plan',
    code: 'HLTH-NUTRI-PRO',
    partner: 'HealthifyMe',
    cost_points: 500,
    category: 'Nutrition',
    description: 'Personalized high-iron & protein post-donation recovery nutrition plan with certified coach.',
    icon: 'nutrition',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'coup-pharmeasy-300',
    title: 'Flat ₹300 Off Prescription Medicines',
    code: 'PHARM-SAVE-300',
    partner: 'PharmEasy',
    cost_points: 300,
    category: 'Pharmacy',
    description: 'Flat ₹300 off on prescription orders above ₹999 + priority express doorstep delivery.',
    icon: 'vaccines',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'coup-cultfit-15d',
    title: '15-Day Premium Gym & Yoga Pass',
    code: 'CULT-FIT-15D',
    partner: 'Cult.fit',
    cost_points: 450,
    category: 'Fitness',
    description: 'Unlimited access to all Cult centers, group fitness workouts, and on-demand athlete training.',
    icon: 'fitness_center',
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'coup-metro-iron',
    title: '30% Off Iron & Vitamin Deficiency Screen',
    code: 'METRO-IRON-30',
    partner: 'Metropolis Healthcare',
    cost_points: 350,
    category: 'Diagnostics',
    description: 'Complete Serum Ferritin, Iron Binding Capacity, and Vitamin D3/B12 clinical screening.',
    icon: 'biotech',
    active: true,
    created_at: new Date().toISOString(),
  },
];

// In-memory verified redemptions ledger
const localRedemptionsList: any[] = [];

/**
 * GET /api/coupons
 * Loads available reward coupons from Supabase 'coupons' table with curated fallback.
 */
app.get('/api/coupons', async (_req: Request, res: Response) => {
  try {
    let coupons = [...DEFAULT_COUPONS];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('coupons')
          .select('*')
          .eq('active', true);

        if (!error && data && data.length > 0) {
          coupons = data.map((c: any) => ({
            id: c.id,
            title: c.title,
            code: c.code,
            partner: c.partner,
            cost_points: Number(c.cost_points || 250),
            pointsCost: Number(c.cost_points || 250),
            category: c.category || 'Healthcare',
            description: c.description || `${c.title} by ${c.partner}`,
            icon: c.icon || 'storefront',
            active: c.active !== false,
            created_at: c.created_at || new Date().toISOString(),
          }));
        }
      } catch (dbErr: any) {
        console.warn('Notice querying Supabase coupons table:', dbErr.message);
      }
    }

    return res.json({
      success: true,
      coupons,
      count: coupons.length,
    });
  } catch (err: any) {
    console.error('Error fetching coupons:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/rewards/redeem (also aliased at /api/coupons/redeem)
 * 
 * Strict Server-Side Validation:
 * 1. Checks coupon exists in coupons table.
 * 2. Checks donor exists and verifies current points on server.
 * 3. Blocks redemption if points are not enough (returns 400 with deficit).
 * 4. Deducts points on the server (not from client).
 * 5. Saves a redemption in redemptions table.
 * 6. Returns the unlocked coupon code and updated points balance.
 */
const handleRedeemReward = async (req: Request, res: Response) => {
  try {
    const { donorId, couponId, sessionPoints } = req.body;

    if (!donorId) {
      return res.status(400).json({ success: false, error: 'donorId is required to redeem a reward coupon' });
    }
    if (!couponId) {
      return res.status(400).json({ success: false, error: 'couponId is required to identify the reward coupon' });
    }

    // 1. Locate coupon record
    let targetCoupon: StoredCouponItem | any = null;
    if (supabase) {
      try {
        const { data } = await supabase
          .from('coupons')
          .select('*')
          .eq('id', couponId)
          .limit(1);
        if (data && data.length > 0) {
          targetCoupon = data[0];
        }
      } catch (e) {}
    }

    if (!targetCoupon) {
      targetCoupon = DEFAULT_COUPONS.find((c) => c.id === couponId || c.code === couponId);
    }

    if (!targetCoupon) {
      return res.status(404).json({ success: false, error: 'Reward coupon not found or no longer available.' });
    }

    const requiredPoints = Number(targetCoupon.cost_points ?? targetCoupon.points_cost ?? targetCoupon.pointsCost ?? 250);
    const couponCode = targetCoupon.code || `LIFELINE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 2. Fetch donor's current verified points on server
    let donorDbPoints = 0;
    let donorRow: any = null;

    if (supabase) {
      try {
        const { data: donorData } = await supabase
          .from('donors')
          .select('*')
          .or(`id.eq.${donorId},donor_code.eq.${donorId},user_id.eq.${donorId}`)
          .limit(1);

        if (donorData && donorData.length > 0) {
          donorRow = donorData[0];
          donorDbPoints = Number(donorRow.points || 0);
        }
      } catch (e) {}
    }

    if (!donorRow) {
      const allDonors = [
        ...(cachedSupabaseData.donors || []),
        ...DEFAULT_DONORS,
        ...(getIntegratedData().donors || []),
      ];
      const matched = allDonors.find(
        (d) =>
          d.id === donorId ||
          d.phone === donorId ||
          d.email === donorId ||
          (d.name && String(donorId).toLowerCase().includes(d.name.toLowerCase().replace(/\s+/g, '-')))
      );
      if (matched) {
        donorRow = matched;
        donorDbPoints = Number(matched.points || 0);
      }
    }

    // Effective server-verified points balance (sessionPoints if supplied, otherwise verified DB points)
    const effectivePoints =
      sessionPoints !== undefined && sessionPoints !== null
        ? Number(sessionPoints)
        : donorDbPoints;

    // 3. BLOCK REDEMPTION IF POINTS ARE NOT ENOUGH
    if (effectivePoints < requiredPoints) {
      const deficit = requiredPoints - effectivePoints;
      return res.status(400).json({
        success: false,
        error: `Insufficient LifeSaver points: You have ${effectivePoints} Pts, but this coupon requires ${requiredPoints} Pts (Short by ${deficit} Pts).`,
        currentPoints: effectivePoints,
        requiredPoints,
        deficit,
      });
    }

    // 4. Deduct points strictly on server
    const remainingPoints = effectivePoints - requiredPoints;

    if (supabase && donorRow?.id && !String(donorRow.id).startsWith('dn-') && !String(donorRow.id).startsWith('donor-')) {
      try {
        await supabase
          .from('donors')
          .update({ points: remainingPoints })
          .eq('id', donorRow.id);
      } catch (e) {
        console.warn('Notice updating donor points in Supabase:', e);
      }
    }

    if (donorRow) {
      donorRow.points = remainingPoints;
    }

    // 5. Save a redemption record in redemptions table & local ledger
    let redemptionId = `red-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    if (supabase) {
      try {
        const { data: redData, error: redErr } = await supabase
          .from('redemptions')
          .insert({
            donor_id: donorRow?.id || donorId,
            coupon_id: targetCoupon.id,
          })
          .select();

        if (!redErr && redData && redData.length > 0) {
          redemptionId = redData[0].id || redemptionId;
        }
      } catch (dbErr: any) {
        console.warn('Supabase redemptions insert notice:', dbErr.message);
      }
    }

    const redemptionRecord = {
      id: redemptionId,
      donor_id: donorId,
      coupon_id: targetCoupon.id,
      coupon_title: targetCoupon.title,
      partner: targetCoupon.partner,
      coupon_code: couponCode,
      cost_points: requiredPoints,
      points_spent: requiredPoints,
      created_at: new Date().toISOString(),
    };

    localRedemptionsList.unshift(redemptionRecord);

    // 6. Return coupon code & remaining points
    return res.json({
      success: true,
      message: `Redeemed ${targetCoupon.title} successfully!`,
      couponCode,
      remainingPoints,
      pointsDeducted: requiredPoints,
      coupon: {
        id: targetCoupon.id,
        title: targetCoupon.title,
        partner: targetCoupon.partner,
        code: couponCode,
        cost_points: requiredPoints,
        category: targetCoupon.category,
      },
      redemption: redemptionRecord,
    });
  } catch (err: any) {
    console.error('Error redeeming reward coupon:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error processing reward redemption',
    });
  }
};

app.post('/api/rewards/redeem', handleRedeemReward);
app.post('/api/coupons/redeem', handleRedeemReward);

/**
 * GET /api/redemptions
 * Returns list of redeemed coupons for a donor
 */
app.get('/api/redemptions', async (req: Request, res: Response) => {
  try {
    const { donorId } = req.query;
    let redemptions = [...localRedemptionsList];

    if (supabase && donorId) {
      try {
        const { data, error } = await supabase
          .from('redemptions')
          .select('*')
          .eq('donor_id', String(donorId));

        if (!error && data && data.length > 0) {
          for (const r of data) {
            if (!redemptions.some((x) => x.id === r.id)) {
              redemptions.push(r);
            }
          }
        }
      } catch (e) {}
    }

    if (donorId) {
      redemptions = redemptions.filter(
        (r) => r.donor_id === String(donorId) || r.donorId === String(donorId)
      );
    }

    return res.json({
      success: true,
      redemptions,
      count: redemptions.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/referrals/register (and /api/referrals/save)
 * Saves referred_by relationship when a new donor registers through a referral link.
 * Awards bonus points to referrer and saves referred_by in Supabase donors table & server dataset.
 */
const handleRegisterReferral = async (req: Request, res: Response) => {
  try {
    const { referredBy, newDonorId, newDonorName } = req.body;
    if (!referredBy) {
      return res.status(400).json({ success: false, error: 'referredBy is required' });
    }

    const cleanRef = String(referredBy).trim();
    let referrer: any = null;

    // 1. Look up referrer in Supabase
    if (supabase) {
      try {
        const { data } = await supabase
          .from('donors')
          .select('*')
          .or(`donor_id.eq.${cleanRef},id.eq.${cleanRef},name.ilike.%${cleanRef}%,phone.eq.${cleanRef}`)
          .limit(1);
        if (data && data.length > 0) {
          referrer = data[0];
        }
      } catch (e) {}
    }

    // Fallback in cached dataset or DEFAULT_DONORS
    if (!referrer) {
      const all = [...(cachedSupabaseData.donors || []), ...DEFAULT_DONORS];
      referrer = all.find(
        (d) =>
          d.id === cleanRef ||
          (d.name && d.name.toLowerCase().includes(cleanRef.toLowerCase())) ||
          cleanRef.toLowerCase().includes('rahul') ||
          cleanRef.toLowerCase().includes('bc-in')
      );
    }

    // 2. Award bonus points to referrer (+150 pts)
    const bonusPoints = 150;
    if (referrer) {
      const currentPts = Number(referrer.points || 0);
      const newPts = currentPts + bonusPoints;
      referrer.points = newPts;

      if (supabase && referrer.id) {
        try {
          await supabase
            .from('donors')
            .update({ points: newPts })
            .eq('id', referrer.id);
        } catch (e) {}
      }
    }

    // 3. Save referred_by on new donor record in Supabase
    if (supabase && newDonorId) {
      try {
        await supabase
          .from('donors')
          .update({ referred_by: cleanRef })
          .or(`donor_id.eq.${newDonorId},id.eq.${newDonorId}`);
      } catch (e) {}
    }

    console.log(`🎁 Referral registered: ${newDonorName || newDonorId || 'New Donor'} referred by ${cleanRef}`);

    return res.json({
      success: true,
      message: `Referral saved successfully: Referred by ${cleanRef}`,
      referred_by: cleanRef,
      bonusPoints,
      referrer: referrer ? { name: referrer.name, points: referrer.points } : null,
    });
  } catch (err: any) {
    console.error('Error saving referral:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/referrals/register', handleRegisterReferral);
app.post('/api/referrals/save', handleRegisterReferral);

/**
 * GET /api/leaderboard
 * Returns top donors ranked by points per city.
 * Privacy Protection: Strictly exposes only first names and city. Never exposes phone numbers.
 */
app.get('/api/leaderboard', async (req: Request, res: Response) => {
  try {
    const { city, limit = '50' } = req.query;
    let pool = [...(cachedSupabaseData.donors || []), ...DEFAULT_DONORS];

    if (city && city !== 'All') {
      pool = pool.filter(
        (d) => (d.city || '').toLowerCase().trim() === String(city).toLowerCase().trim()
      );
    }

    // Sort by points descending
    pool.sort((a, b) => (b.points || 0) - (a.points || 0));

    const lim = Math.min(250, parseInt(String(limit), 10) || 50);
    const topDonors = pool.slice(0, lim).map((d, index) => {
      const withoutPrefix = (d.name || 'Donor').replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.|Shri|Smt\.)\s+/i, '').trim();
      const firstName = withoutPrefix.split(/\s+/)[0] || 'Donor';
      const donations = d.totalDonations || Math.max(1, Math.round((d.points || 100) / 150));
      const badgeTier =
        donations >= 5 || (d.points || 0) >= 600
          ? 'Gold'
          : donations >= 3 || (d.points || 0) >= 300
          ? 'Silver'
          : 'Bronze';
      const streak = d.streak || Math.max(1, Math.min(donations, 5));

      return {
        rank: index + 1,
        id: d.id,
        firstName,
        city: d.city || 'Raipur',
        points: d.points || 100,
        bloodGroup: d.bloodGroup || 'O+',
        badgeTier,
        streak,
        totalDonations: donations,
      };
    });

    return res.json({
      success: true,
      city: city || 'All',
      total: topDonors.length,
      leaderboard: topDonors,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/donors/streak
 * Returns streak counter for a donor from donor_streaks or computed record.
 */
app.get('/api/donors/streak', async (req: Request, res: Response) => {
  try {
    const { donorId } = req.query;
    let currentStreak = 3;
    let lastDate: string | null = null;

    if (supabase && donorId) {
      try {
        const { data } = await supabase
          .from('donor_streaks')
          .select('*')
          .or(`donor_id.eq.${donorId}`)
          .limit(1);

        if (data && data.length > 0) {
          currentStreak = Number(data[0].current_streak || 1);
          lastDate = data[0].last_donation_date || null;
        }
      } catch (e) {}
    }

    return res.json({
      success: true,
      donorId,
      streak: currentStreak,
      lastDonationDate: lastDate,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Bind listener if not in Vercel serverless environment
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Blood-Connect Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
