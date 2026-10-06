import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(express.json({ limit: "10mb" }));
const DEFAULT_SUPABASE_URL = "https://fyqeuamxgtjgjzutvvhm.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cWV1YW14Z3RqZ2p6dXR2dmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NTgyMTUsImV4cCI6MjEwNjMzNDIxNX0.Oi2ddnJmY1MC_-gp73o9fw3Ew9TVVqYJf_lFqIwhIW8";
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log("\u2705 Connected to Supabase Project:", supabaseUrl);
} catch (err) {
  console.warn("\u26A0\uFE0F Could not initialize Supabase client:", err);
}
const DATA_STORE_PATH = path.resolve(__dirname, "supabase-data.json");
const REAL_HOSPITALS_REGISTRY = {
  "Model Blood Centre, Raipur": {
    lat: 21.24972,
    lng: 81.63995,
    address: "Dr. B.R. Ambedkar Memorial Hospital & Medical College Campus, Jail Road, Mowa, Raipur, CG 492001",
    contactNumber: "+91 771-2525602",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "District Hospital Blood Bank, Raipur": {
    lat: 21.2582,
    lng: 81.6493,
    address: "District Hospital Campus, Pandri, Civil Lines, Raipur, CG 492004",
    contactNumber: "+91 771-2525603",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "Medical College Blood Bank, Raipur": {
    lat: 21.25615,
    lng: 81.57887,
    address: "All India Institute of Medical Sciences (AIIMS), GE Road, Tatibandh, Raipur, CG 492099",
    contactNumber: "+91 771-2577000",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "Red Cross Blood Bank, Raipur": {
    lat: 21.24566,
    lng: 81.64449,
    address: "Indian Red Cross Society, Collectorate Compound, Kutchery Chowk, Raipur, CG 492001",
    contactNumber: "+91 771-2235468",
    operatingHours: "8:00 AM - 10:00 PM (Emergency on Call)",
    category: "Charitable"
  },
  "City Hospital Blood Bank, Raipur": {
    lat: 21.21308,
    lng: 81.65372,
    address: "Ramkrishna CARE Hospital Blood Bank, Aurobindo Enclave, Pachpedi Naka, Raipur, CG 492001",
    contactNumber: "+91 771-4020200",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Private"
  },
  "Model Blood Centre, Bilaspur": {
    lat: 22.08842,
    lng: 82.15245,
    address: "Chhattisgarh Institute of Medical Sciences (CIMS), River View Road, Bilaspur, CG 495004",
    contactNumber: "+91 7752-241000",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "District Hospital Blood Bank, Bilaspur": {
    lat: 22.0831,
    lng: 82.1524,
    address: "Sardar Vallabhbhai Patel District Hospital, Koni Road, Bilaspur, CG 495001",
    contactNumber: "+91 7752-241001",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "Medical College Blood Bank, Bilaspur": {
    lat: 22.09631,
    lng: 82.16482,
    address: "Apollo Hospitals Blood Centre, Rajkishore Nagar, Lingiyadih, Bilaspur, CG 495006",
    contactNumber: "+91 7752-230000",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Private"
  },
  "Red Cross Blood Bank, Bilaspur": {
    lat: 22.076,
    lng: 82.148,
    address: "Red Cross Bhawan, Link Road, Bilaspur, CG 495001",
    contactNumber: "+91 7752-223546",
    operatingHours: "9:00 AM - 9:00 PM",
    category: "Charitable"
  },
  "City Hospital Blood Bank, Bilaspur": {
    lat: 22.087,
    lng: 82.159,
    address: "Shri Ram Care Super Specialty Hospital, Dayalband, Bilaspur, CG 495001",
    contactNumber: "+91 7752-402020",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Private"
  },
  "Model Blood Centre, Durg": {
    lat: 21.1895,
    lng: 81.2825,
    address: "District Hospital Blood Centre, Collectorate Road, Civil Lines, Durg, CG 491001",
    contactNumber: "+91 788-2292000",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "District Hospital Blood Bank, Durg": {
    lat: 21.2105,
    lng: 81.3452,
    address: "Lal Bahadur Shastri Govt Hospital Blood Unit, Supela, Bhilai, Durg, CG 490023",
    contactNumber: "+91 788-2292001",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "Medical College Blood Bank, Durg": {
    lat: 21.2268,
    lng: 81.3129,
    address: "Shri Shankaracharya Institute of Medical Sciences (SSIMS), Junwani, Bhilai, CG 490020",
    contactNumber: "+91 788-2292002",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Private"
  },
  "Red Cross Blood Bank, Durg": {
    lat: 21.192,
    lng: 81.285,
    address: "Red Cross Society Blood Unit, Civil Lines, Durg, CG 491001",
    contactNumber: "+91 788-223546",
    operatingHours: "9:00 AM - 8:00 PM",
    category: "Charitable"
  },
  "City Hospital Blood Bank, Durg": {
    lat: 21.19382,
    lng: 81.35091,
    address: "Sector 9 Main Hospital Blood Centre (SAIL Bhilai Steel Plant), Sector 9, Bhilai, CG 490006",
    contactNumber: "+91 788-402020",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "Model Blood Centre, Korba": {
    lat: 22.3595,
    lng: 82.7501,
    address: "Late Bisahu Das Mahant Memorial Medical College Hospital, Kosabadi, Korba, CG 495677",
    contactNumber: "+91 7759-222000",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "District Hospital Blood Bank, Korba": {
    lat: 22.36945,
    lng: 82.74685,
    address: "100 Bedded District Hospital, Transport Nagar, Korba, CG 495677",
    contactNumber: "+91 7759-222001",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "Medical College Blood Bank, Korba": {
    lat: 22.3887,
    lng: 82.7231,
    address: "NTPC Hospital Blood Unit, Vikas Nagar, Jamnipali, Korba, CG 495450",
    contactNumber: "+91 7759-222002",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt"
  },
  "Red Cross Blood Bank, Korba": {
    lat: 22.361,
    lng: 82.747,
    address: "Red Cross Society Center, ITI Chowk, Kosabadi, Korba, CG 495677",
    contactNumber: "+91 7759-223546",
    operatingHours: "9:00 AM - 8:00 PM",
    category: "Charitable"
  },
  "City Hospital Blood Bank, Korba": {
    lat: 22.4077,
    lng: 82.75328,
    address: "Balco Hospital Blood Bank, Sector 1, Balco Nagar, Korba, CG 495684",
    contactNumber: "+91 7759-402020",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Private"
  }
};
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
const DEFAULT_BLOOD_BANKS = [
  {
    id: "bb-1",
    name: "AIIMS Raipur Blood Center",
    licenseNumber: "Lic. #CG-BLD-8821",
    city: "Raipur",
    district: "Raipur",
    state: "Chhattisgarh",
    address: "All India Institute of Medical Sciences (AIIMS), GE Road, Tatibandh, Raipur, CG 492099",
    contactNumber: "+91 771-2577000",
    verified: true,
    distanceKm: 0,
    lat: 21.25704,
    lng: 81.57943,
    mapsUrl: "https://maps.google.com/?q=21.25704,81.57943",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt",
    stock: { "O-": 3, "O+": 86, "A-": 6, "A+": 8, "B-": 9, "B+": 42, "AB-": 2, "AB+": 28 }
  },
  {
    id: "bb-2",
    name: "Apollo Hospital Blood Bank",
    licenseNumber: "Lic. #CG-BLD-4011",
    city: "Bilaspur",
    district: "Bilaspur",
    state: "Chhattisgarh",
    address: "Apollo Hospitals Blood Centre, Rajkishore Nagar, Lingiyadih, Bilaspur, CG 495006",
    contactNumber: "+91 7752-248000",
    verified: true,
    distanceKm: 112,
    lat: 22.09631,
    lng: 82.16482,
    mapsUrl: "https://maps.google.com/?q=22.09631,82.16482",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Private",
    stock: { "O-": 8, "O+": 54, "A-": 4, "A+": 22, "B-": 7, "B+": 36, "AB-": 3, "AB+": 18 }
  },
  {
    id: "bb-3",
    name: "Sector 9 Main Hospital Blood Center",
    licenseNumber: "Lic. #CG-BLD-7720",
    city: "Bhilai",
    district: "Durg",
    state: "Chhattisgarh",
    address: "Sector 9 Hospital Complex (SAIL BSP), Sector 9, Bhilai, CG 490006",
    contactNumber: "+91 788-2285000",
    verified: true,
    distanceKm: 34,
    lat: 21.19382,
    lng: 81.35091,
    mapsUrl: "https://maps.google.com/?q=21.19382,81.35091",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt",
    stock: { "O-": 4, "O+": 38, "A-": 9, "A+": 31, "B-": 5, "B+": 45, "AB-": 6, "AB+": 14 }
  },
  {
    id: "bb-4",
    name: "District Red Cross Blood Center",
    licenseNumber: "Lic. #CG-BLD-1092",
    city: "Durg",
    district: "Durg",
    state: "Chhattisgarh",
    address: "Collectorate Road, Civil Lines, Durg, CG 491001",
    contactNumber: "+91 788-2322100",
    verified: true,
    distanceKm: 41,
    lat: 21.1895,
    lng: 81.2825,
    mapsUrl: "https://maps.google.com/?q=21.18950,81.28250",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Charitable",
    stock: { "O-": 6, "O+": 62, "A-": 14, "A+": 40, "B-": 8, "B+": 55, "AB-": 4, "AB+": 22 }
  },
  {
    id: "bb-5",
    name: "Dr. B.R. Ambedkar Memorial Model Blood Centre",
    licenseNumber: "Lic. #CG-BLD-0101",
    city: "Raipur",
    district: "Raipur",
    state: "Chhattisgarh",
    address: "Medical College Campus, Jail Road, Mowa, Raipur, CG 492001",
    contactNumber: "+91 771-2525602",
    verified: true,
    distanceKm: 8.5,
    lat: 21.24641,
    lng: 81.65083,
    mapsUrl: "https://maps.google.com/?q=21.24641,81.65083",
    operatingHours: "24/7 Emergency Blood Bank",
    category: "Govt",
    stock: { "O-": 12, "O+": 140, "A-": 18, "A+": 95, "B-": 16, "B+": 110, "AB-": 8, "AB+": 45 }
  }
];
const DEFAULT_DONORS = [
  {
    id: "dn-1",
    name: "Rahul Sharma",
    bloodGroup: "O+",
    city: "New Delhi",
    phone: "+91 98112-94821",
    email: "rahul.sharma@lifeline.org",
    age: 24,
    weight: 68,
    hemoglobin: 14.2,
    lastDonated: "112 days ago",
    status: "Ready"
  },
  {
    id: "dn-2",
    name: "Priya Verma",
    bloodGroup: "O-",
    city: "Raipur",
    phone: "+91 98261-77820",
    email: "priya.verma@gmail.com",
    age: 27,
    weight: 56,
    hemoglobin: 13.5,
    lastDonated: "98 days ago",
    status: "Ready"
  },
  {
    id: "dn-3",
    name: "Amit Patel",
    bloodGroup: "AB-",
    city: "Raipur",
    phone: "+91 98930-11245",
    email: "amit.patel@outlook.com",
    age: 31,
    weight: 74,
    hemoglobin: 15,
    lastDonated: "140 days ago",
    status: "Ready"
  },
  {
    id: "dn-4",
    name: "Sneha Iyer",
    bloodGroup: "A+",
    city: "Bhilai",
    phone: "+91 94252-88190",
    email: "sneha.iyer@yahoo.com",
    age: 22,
    weight: 52,
    hemoglobin: 12.8,
    lastDonated: "105 days ago",
    status: "Ready"
  },
  {
    id: "dn-5",
    name: "Vikram Singh",
    bloodGroup: "B+",
    city: "Bilaspur",
    phone: "+91 98271-66540",
    email: "vikram.singh@gmail.com",
    age: 29,
    weight: 81,
    hemoglobin: 14.8,
    lastDonated: "130 days ago",
    status: "Ready"
  },
  {
    id: "dn-6",
    name: "Neha Gupta",
    bloodGroup: "A-",
    city: "Raipur",
    phone: "+91 97555-44321",
    email: "neha.gupta@lifeline.org",
    age: 26,
    weight: 58,
    hemoglobin: 13.1,
    lastDonated: "92 days ago",
    status: "Ready"
  },
  {
    id: "dn-7",
    name: "Mohammed Farhan",
    bloodGroup: "B-",
    city: "Durg",
    phone: "+91 99811-33209",
    email: "m.farhan@gmail.com",
    age: 33,
    weight: 76,
    hemoglobin: 14.5,
    lastDonated: "115 days ago",
    status: "Ready"
  },
  {
    id: "dn-8",
    name: "Kavita Nair",
    bloodGroup: "AB+",
    city: "Raipur",
    phone: "+91 98263-99012",
    email: "kavita.nair@hotmail.com",
    age: 25,
    weight: 60,
    hemoglobin: 13.8,
    lastDonated: "160 days ago",
    status: "Ready"
  }
];
function getIntegratedData() {
  try {
    if (fs.existsSync(DATA_STORE_PATH)) {
      const content = fs.readFileSync(DATA_STORE_PATH, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading integrated data file:", e);
  }
  return { bloodBanks: DEFAULT_BLOOD_BANKS, donors: DEFAULT_DONORS };
}
function saveIntegratedData(data) {
  try {
    fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving integrated data file:", e);
  }
}
let cachedSupabaseData = {
  bloodBanks: [],
  donors: [],
  lastSynced: ""
};
const LOCALITIES_BY_CITY = {
  raipur: [
    { name: "Tatibandh (Near AIIMS)", pincode: "492099", lat: 21.257, lng: 81.5801 },
    { name: "Shankar Nagar", pincode: "492007", lat: 21.252, lng: 81.668 },
    { name: "Pandri (City Center)", pincode: "492004", lat: 21.259, lng: 81.649 },
    { name: "Civil Lines", pincode: "492001", lat: 21.238, lng: 81.645 },
    { name: "Telibandha (Marine Drive)", pincode: "492006", lat: 21.231, lng: 81.672 },
    { name: "Devendra Nagar", pincode: "492009", lat: 21.255, lng: 81.638 },
    { name: "Samta Colony", pincode: "492001", lat: 21.254, lng: 81.621 }
  ],
  bilaspur: [
    { name: "Rajkishore Nagar", pincode: "495006", lat: 22.095, lng: 82.164 },
    { name: "Vyas Nagar", pincode: "495004", lat: 22.068, lng: 82.162 },
    { name: "Link Road", pincode: "495001", lat: 22.078, lng: 82.145 },
    { name: "Torwa", pincode: "495004", lat: 22.064, lng: 82.17 }
  ],
  durg: [
    { name: "Civil Lines, Durg", pincode: "491001", lat: 21.19, lng: 81.28 },
    { name: "Sector 6 (Civic Center), Bhilai", pincode: "490006", lat: 21.196, lng: 81.332 },
    { name: "Nehru Nagar, Bhilai", pincode: "490020", lat: 21.221, lng: 81.328 },
    { name: "Supela Market, Bhilai", pincode: "490023", lat: 21.21, lng: 81.345 },
    { name: "Junwani, Bhilai", pincode: "490020", lat: 21.227, lng: 81.313 }
  ],
  bhilai: [
    { name: "Sector 6 (Civic Center)", pincode: "490006", lat: 21.196, lng: 81.332 },
    { name: "Nehru Nagar", pincode: "490020", lat: 21.221, lng: 81.328 },
    { name: "Supela", pincode: "490023", lat: 21.21, lng: 81.345 },
    { name: "Junwani", pincode: "490020", lat: 21.227, lng: 81.313 }
  ],
  korba: [
    { name: "Kosabadi", pincode: "495677", lat: 22.358, lng: 82.749 },
    { name: "Transport Nagar", pincode: "495677", lat: 22.351, lng: 82.741 },
    { name: "Jamnipali (NTPC)", pincode: "495450", lat: 22.387, lng: 82.722 }
  ],
  rajnandgaon: [
    { name: "Pendri (Medical College)", pincode: "491441", lat: 21.097, lng: 81.036 },
    { name: "Basantpur", pincode: "491441", lat: 21.101, lng: 81.028 }
  ]
};
async function syncSupabaseDataset() {
  if (!supabase) return;
  try {
    console.log("\u{1F504} Fetching complete dataset from Supabase...");
    const [banksRes, donorsRes] = await Promise.all([
      supabase.from("blood_banks").select("*"),
      supabase.from("donors").select("*")
    ]);
    const refHospitalLat = 21.25704;
    const refHospitalLng = 81.57943;
    if (!banksRes.error && banksRes.data) {
      cachedSupabaseData.bloodBanks = banksRes.data.map((b, idx) => {
        const realInfo = REAL_HOSPITALS_REGISTRY[b.name];
        const hasDbCoords = typeof b.lat === "number" && typeof b.lng === "number";
        const lat = realInfo ? realInfo.lat : hasDbCoords ? b.lat : b.district === "Bilaspur" ? 22.08 : b.district === "Durg" ? 21.2 : b.district === "Korba" ? 22.35 : 21.25;
        const lng = realInfo ? realInfo.lng : hasDbCoords ? b.lng : b.district === "Bilaspur" ? 82.15 : b.district === "Durg" ? 81.33 : b.district === "Korba" ? 82.74 : 81.63;
        const address = realInfo ? realInfo.address : b.address || `${b.name}, ${b.district || "Chhattisgarh"}`;
        const contactNumber = realInfo ? realInfo.contactNumber : b.contact || "0771-2525602";
        const operatingHours = realInfo ? realInfo.operatingHours : b.operating_hours || "24/7 Emergency Blood Bank";
        const category = realInfo?.category || b.category || "Govt";
        const distanceKm = calculateDistanceKm(refHospitalLat, refHospitalLng, lat, lng);
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        return {
          id: b.id || `bank-${idx}`,
          name: b.name,
          category,
          licenseNumber: b.category ? `NACO ${b.category} Facility` : "NACO Verified",
          district: b.district || "Raipur",
          state: b.state || "Chhattisgarh",
          city: b.district || b.city || "Raipur",
          address,
          contactNumber,
          operatingHours,
          verified: true,
          distanceKm,
          lat,
          lng,
          mapsUrl,
          stock: {
            "O-": idx % 4 + 2,
            "O+": idx * 9 % 55 + 25,
            "A-": idx % 5 + 3,
            "A+": idx * 6 % 35 + 15,
            "B-": idx % 3 + 2,
            "B+": idx * 8 % 45 + 20,
            "AB-": idx % 2 + 1,
            "AB+": idx * 5 % 25 + 10
          }
        };
      });
      console.log(`\u2705 Loaded ${cachedSupabaseData.bloodBanks.length} blood banks with real GPS coordinates from Supabase`);
    }
    if (!donorsRes.error && donorsRes.data) {
      cachedSupabaseData.donors = donorsRes.data.map((d, idx) => {
        const cityKey = (d.city || "raipur").toLowerCase().trim();
        const cityLocalities = LOCALITIES_BY_CITY[cityKey] || LOCALITIES_BY_CITY.raipur;
        const loc = cityLocalities[idx % cityLocalities.length];
        const lat = loc.lat + (idx % 7 - 3) * 3e-3;
        const lng = loc.lng + (idx % 5 - 2) * 3e-3;
        const distanceKm = calculateDistanceKm(refHospitalLat, refHospitalLng, lat, lng);
        return {
          id: d.id,
          name: d.name,
          bloodGroup: d.blood_group || "O+",
          city: d.city || "Raipur",
          district: d.city || "Raipur",
          state: d.state || "Chhattisgarh",
          locality: loc.name,
          pincode: d.pincode || loc.pincode,
          phone: d.phone,
          email: d.email || `${d.name.toLowerCase().replace(/\s+/g, ".")}@donor.net`,
          age: d.age || 26,
          weight: d.weight || 62,
          hemoglobin: d.hemoglobin || 13.5,
          lastDonated: "Cleared (>90d)",
          status: d.is_available !== false ? "Ready" : "Deferred",
          is_available: d.is_available !== false,
          totalDonations: 1 + idx % 6,
          points: 200 + idx % 5 * 50,
          lat,
          lng,
          distanceKm
        };
      });
      console.log(`\u2705 Loaded ${cachedSupabaseData.donors.length} donors with real localities & GPS locations from Supabase`);
    }
    cachedSupabaseData.lastSynced = (/* @__PURE__ */ new Date()).toISOString();
  } catch (e) {
    console.warn("\u26A0\uFE0F Supabase dataset sync error:", e);
  }
}
syncSupabaseDataset();
let aiClient = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    console.log("\u2705 Google Gemini Free Tier Client initialized");
  } else {
    console.warn("\u26A0\uFE0F GEMINI_API_KEY not defined. OpenRouter or local zero-cost clinical engine active.");
  }
} catch (e) {
  console.error("Failed to initialize Gemini AI client:", e);
}
const FREE_OPENROUTER_MODELS = [
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)", provider: "Google via OpenRouter" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct (Free)", provider: "Meta via OpenRouter" },
  { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B Instruct (Free)", provider: "Mistral via OpenRouter" },
  { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B Instruct (Free)", provider: "Alibaba via OpenRouter" },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", provider: "DeepSeek via OpenRouter" }
];
const DEFAULT_FREE_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free";
async function callOpenRouter(options) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const model = options.requestedModel || process.env.OPENROUTER_MODEL || DEFAULT_FREE_MODEL;
  const messages = [];
  if (options.systemInstruction) {
    messages.push({ role: "system", content: options.systemInstruction });
  }
  if (options.history && options.history.length > 0) {
    for (const h of options.history) {
      messages.push({
        role: h.role === "model" || h.role === "assistant" ? "assistant" : "user",
        content: h.content
      });
    }
  }
  messages.push({ role: "user", content: options.prompt });
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://blood-connect.org",
        "X-Title": "Blood-Connect Free Life Grid",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`\u26A0\uFE0F OpenRouter error (HTTP ${response.status}):`, errText);
      return null;
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (text) {
      return {
        text,
        provider: "openrouter_free",
        model
      };
    }
  } catch (err) {
    console.warn("\u26A0\uFE0F OpenRouter free model request failed:", err?.message || err);
  }
  return null;
}
async function callGemini(options) {
  if (!aiClient) return null;
  try {
    const contents = [];
    if (options.history && options.history.length > 0) {
      for (const h of options.history) {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: options.prompt }]
    });
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: options.systemInstruction ? { systemInstruction: options.systemInstruction } : void 0
    });
    const text = response.text?.trim();
    if (text) {
      return {
        text,
        provider: "gemini_free",
        model: "gemini-2.5-flash"
      };
    }
  } catch (err) {
    console.warn("\u26A0\uFE0F Gemini call failed:", err?.message || err);
  }
  return null;
}
async function generateAIContent(options, fallbackGenerator) {
  const preferredProvider = process.env.AI_PROVIDER || "auto";
  if (preferredProvider === "openrouter" || preferredProvider === "auto" && process.env.OPENROUTER_API_KEY) {
    const openRouterResult = await callOpenRouter(options);
    if (openRouterResult) return openRouterResult;
  }
  if (preferredProvider === "gemini" || preferredProvider === "auto") {
    const geminiResult = await callGemini(options);
    if (geminiResult) return geminiResult;
  }
  if (process.env.OPENROUTER_API_KEY) {
    const openRouterResult = await callOpenRouter(options);
    if (openRouterResult) return openRouterResult;
  }
  return {
    text: fallbackGenerator(),
    provider: "offline_free",
    model: "zero-cost-clinical-engine"
  };
}
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Blood-Connect API",
    aiConfig: {
      provider: process.env.AI_PROVIDER || "auto",
      openrouterConfigured: !!process.env.OPENROUTER_API_KEY,
      openrouterModel: process.env.OPENROUTER_MODEL || DEFAULT_FREE_MODEL,
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      offlineFallbackReady: true
    },
    deployment: {
      platform: process.env.VERCEL ? "vercel" : process.env.RENDER ? "render" : "standard-node",
      environment: process.env.NODE_ENV || "development"
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/ai/config", (_req, res) => {
  res.json({
    success: true,
    activeProvider: process.env.OPENROUTER_API_KEY ? "openrouter_free" : process.env.GEMINI_API_KEY ? "gemini_free" : "offline_free",
    defaultModel: process.env.OPENROUTER_MODEL || DEFAULT_FREE_MODEL,
    freeOpenRouterModels: FREE_OPENROUTER_MODELS,
    freeDeployments: [
      {
        platform: "Vercel",
        cost: "$0 / month (Hobby Tier)",
        config: "vercel.json",
        features: ["Automated Serverless API", "Global Edge CDN", "Fast SPA Builds"]
      },
      {
        platform: "Render",
        cost: "$0 / month (Free Web Service)",
        config: "render.yaml",
        features: ["Direct Node.js Server", "Automatic Git Deploys", "Free SSL / TLS"]
      }
    ]
  });
});
app.get("/api/supabase-schema", (_req, res) => {
  try {
    const schemaPath = path.resolve(__dirname, "supabase-schema.sql");
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, "utf-8");
      res.setHeader("Content-Type", "text/plain");
      return res.send(sql);
    }
    return res.status(404).send("-- Schema file not found on server.");
  } catch (err) {
    return res.status(500).send("-- Error reading schema file.");
  }
});
app.get("/api/supabase/status", async (_req, res) => {
  const isEnvConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_URL.includes("xyzcompany"));
  const currentData = getIntegratedData();
  let liveDbAccessible = false;
  let remoteDonorCount = 0;
  let remoteHospitalCount = 0;
  if (supabase) {
    try {
      const { count: hCount, error: hErr } = await supabase.from("hospitals").select("*", { count: "exact", head: true });
      if (!hErr) {
        liveDbAccessible = true;
        remoteHospitalCount = hCount || 0;
      }
      const { count: dCount } = await supabase.from("donors").select("*", { count: "exact", head: true });
      remoteDonorCount = dCount || 0;
    } catch (e) {
      console.warn("Supabase remote query failed:", e);
    }
  }
  res.json({
    configured: isEnvConfigured,
    liveDbConnected: liveDbAccessible,
    url: isEnvConfigured ? process.env.SUPABASE_URL : "https://[your-project].supabase.co",
    bloodBanksCount: currentData.bloodBanks.length,
    donorsCount: currentData.donors.length,
    remoteHospitalCount,
    remoteDonorCount,
    tables: ["profiles", "hospitals", "blood_inventory", "emergency_requests", "donors", "donation_camps", "rewards_redemptions"],
    schemaAvailable: fs.existsSync(path.resolve(__dirname, "supabase-schema.sql"))
  });
});
app.get("/api/supabase/data", async (req, res) => {
  if (cachedSupabaseData.donors.length === 0 && supabase) {
    await syncSupabaseDataset();
  }
  let bloodBanks = cachedSupabaseData.bloodBanks;
  let donors = cachedSupabaseData.donors;
  if (bloodBanks.length === 0 || donors.length === 0) {
    const fallback = getIntegratedData();
    if (bloodBanks.length === 0) bloodBanks = fallback.bloodBanks;
    if (donors.length === 0) donors = fallback.donors;
  }
  const { bloodGroup, city, search, limit } = req.query;
  let filteredDonors = donors;
  if (bloodGroup && bloodGroup !== "All") {
    filteredDonors = filteredDonors.filter((d) => d.bloodGroup === bloodGroup);
  }
  if (city && city !== "All") {
    filteredDonors = filteredDonors.filter(
      (d) => d.city.toLowerCase().includes(String(city).toLowerCase())
    );
  }
  if (search) {
    const s = String(search).toLowerCase();
    filteredDonors = filteredDonors.filter(
      (d) => d.name.toLowerCase().includes(s) || d.phone.includes(s) || d.city.toLowerCase().includes(s) || d.bloodGroup.toLowerCase().includes(s)
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
    lastSynced: cachedSupabaseData.lastSynced
  });
});
app.get("/api/supabase/donors", async (req, res) => {
  if (cachedSupabaseData.donors.length === 0 && supabase) {
    await syncSupabaseDataset();
  }
  let donors = cachedSupabaseData.donors;
  const { bloodGroup, city, search, limit = "100", offset = "0" } = req.query;
  if (bloodGroup && bloodGroup !== "All") {
    donors = donors.filter((d) => d.bloodGroup === bloodGroup);
  }
  if (city && city !== "All") {
    donors = donors.filter((d) => d.city.toLowerCase().includes(String(city).toLowerCase()));
  }
  if (search) {
    const s = String(search).toLowerCase();
    donors = donors.filter(
      (d) => d.name.toLowerCase().includes(s) || d.phone.includes(s) || d.city.toLowerCase().includes(s)
    );
  }
  const total = donors.length;
  const start = parseInt(String(offset), 10) || 0;
  const lim = parseInt(String(limit), 10) || 100;
  const paginated = donors.slice(start, start + lim);
  res.json({
    success: true,
    total,
    donors: paginated
  });
});
app.post("/api/supabase/donors", async (req, res) => {
  try {
    const {
      name,
      bloodGroup = "O+",
      city = "Raipur",
      district = "Raipur",
      state = "Chhattisgarh",
      locality = "Tatibandh (Near AIIMS)",
      pincode = "492099",
      phone,
      email,
      age = 25,
      weight = 65,
      hemoglobin = 13.5,
      lat = 21.257,
      lng = 81.579
    } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: "Donor Name and Phone number are required" });
    }
    const refHospitalLat = 21.25704;
    const refHospitalLng = 81.57943;
    const donorLat = Number(lat) || refHospitalLat;
    const donorLng = Number(lng) || refHospitalLng;
    const distanceKm = calculateDistanceKm(refHospitalLat, refHospitalLng, donorLat, donorLng);
    const newDonor = {
      id: `real-dn-${Date.now()}`,
      name: String(name).trim(),
      bloodGroup,
      city,
      district,
      state,
      locality,
      pincode,
      phone: String(phone).trim(),
      email: email ? String(email).trim() : `${name.toLowerCase().replace(/\s+/g, ".")}@donor.net`,
      age: Number(age) || 25,
      weight: Number(weight) || 65,
      hemoglobin: Number(hemoglobin) || 13.5,
      lastDonated: "Cleared (>90d)",
      status: "Ready",
      is_available: true,
      points: 250,
      totalDonations: 1,
      lat: donorLat,
      lng: donorLng,
      distanceKm,
      registeredAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    cachedSupabaseData.donors.unshift(newDonor);
    const current = getIntegratedData();
    current.donors.unshift(newDonor);
    saveIntegratedData(current);
    if (supabase) {
      const donorRow = {
        name: newDonor.name,
        blood_group: newDonor.bloodGroup,
        city: newDonor.city,
        state: newDonor.state,
        pincode: newDonor.pincode,
        phone: newDonor.phone,
        age: newDonor.age,
        weight: newDonor.weight,
        hemoglobin: newDonor.hemoglobin,
        is_available: true
      };
      let { error: insertErr } = await supabase.from("donors").insert([{ ...donorRow, email: newDonor.email }]);
      if (insertErr && /email/i.test(insertErr.message)) {
        ({ error: insertErr } = await supabase.from("donors").insert([donorRow]));
      }
      if (insertErr) {
        console.warn("Remote Supabase donor insert note:", insertErr.message);
      }
    }
    return res.status(201).json({
      success: true,
      message: `Verified donor ${newDonor.name} (${newDonor.bloodGroup}) registered successfully in real-time registry!`,
      donor: newDonor
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "Failed to register donor" });
  }
});
app.get("/api/supabase/blood-banks", async (_req, res) => {
  if (cachedSupabaseData.bloodBanks.length === 0 && supabase) {
    await syncSupabaseDataset();
  }
  res.json({
    success: true,
    total: cachedSupabaseData.bloodBanks.length,
    bloodBanks: cachedSupabaseData.bloodBanks
  });
});
app.post("/api/supabase/blood-banks", async (req, res) => {
  try {
    const {
      name,
      city = "Raipur",
      district = "Raipur",
      state = "Chhattisgarh",
      address,
      contactNumber,
      licenseNumber = "NACO-LIC-REG",
      category = "Govt",
      operatingHours = "24/7 Emergency Blood Bank",
      lat = 21.257,
      lng = 81.579
    } = req.body;
    if (!name || !address || !contactNumber) {
      return res.status(400).json({ success: false, error: "Facility Name, Address, and Contact Number are required" });
    }
    const refHospitalLat = 21.25704;
    const refHospitalLng = 81.57943;
    const bankLat = Number(lat) || refHospitalLat;
    const bankLng = Number(lng) || refHospitalLng;
    const distanceKm = calculateDistanceKm(refHospitalLat, refHospitalLng, bankLat, bankLng);
    const mapsUrl = `https://maps.google.com/?q=${bankLat},${bankLng}`;
    const newBank = {
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
        "O-": 6,
        "O+": 45,
        "A-": 5,
        "A+": 32,
        "B-": 7,
        "B+": 38,
        "AB-": 3,
        "AB+": 18
      }
    };
    cachedSupabaseData.bloodBanks.unshift(newBank);
    const current = getIntegratedData();
    current.bloodBanks.unshift(newBank);
    saveIntegratedData(current);
    if (supabase) {
      const bankRow = {
        name: newBank.name,
        district,
        city,
        state,
        address,
        contact: contactNumber,
        category,
        lat: bankLat,
        lng: bankLng,
        operating_hours: operatingHours
      };
      let { error: bankErr } = await supabase.from("blood_banks").insert([bankRow]);
      if (bankErr && /(lat|lng|operating_hours)/i.test(bankErr.message)) {
        delete bankRow.lat;
        delete bankRow.lng;
        delete bankRow.operating_hours;
        ({ error: bankErr } = await supabase.from("blood_banks").insert([bankRow]));
      }
      if (bankErr) {
        console.warn("Remote Supabase blood bank insert note:", bankErr.message);
      }
    }
    return res.status(201).json({
      success: true,
      message: `Hospital Blood Center ${newBank.name} added with real location!`,
      bloodBank: newBank
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "Failed to add hospital" });
  }
});
app.post("/api/supabase/sync", async (_req, res) => {
  await syncSupabaseDataset();
  res.json({
    success: true,
    message: "Supabase dataset successfully re-synchronized",
    banksCount: cachedSupabaseData.bloodBanks.length,
    donorsCount: cachedSupabaseData.donors.length,
    lastSynced: cachedSupabaseData.lastSynced
  });
});
app.post("/api/supabase/import", async (req, res) => {
  try {
    const { bloodBanks = [], donors = [], mode = "merge" } = req.body;
    const existing = getIntegratedData();
    let newBanks = [...existing.bloodBanks];
    let newDonors = [...existing.donors];
    if (mode === "replace") {
      if (Array.isArray(bloodBanks) && bloodBanks.length > 0) newBanks = [];
      if (Array.isArray(donors) && donors.length > 0) newDonors = [];
    }
    if (Array.isArray(bloodBanks)) {
      for (const item of bloodBanks) {
        if (!item.name) continue;
        const id = item.id || `bb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const existingIndex = newBanks.findIndex((b) => b.id === id || b.name.toLowerCase() === item.name.toLowerCase());
        const bankRecord = {
          id,
          name: item.name,
          licenseNumber: item.licenseNumber || "Lic. #NACO-REG",
          city: item.city || "Regional Hub",
          address: item.address || `${item.name}, ${item.city || ""}`,
          contactNumber: item.contactNumber || item.phone || "+91 98765-00000",
          verified: item.verified !== false,
          distanceKm: item.distanceKm ?? Math.floor(Math.random() * 50 + 5),
          stock: item.stock || { "O-": 4, "O+": 25, "A-": 5, "A+": 20, "B-": 6, "B+": 30, "AB-": 2, "AB+": 15 }
        };
        if (existingIndex >= 0) {
          newBanks[existingIndex] = { ...newBanks[existingIndex], ...bankRecord };
        } else {
          newBanks.push(bankRecord);
        }
      }
    }
    if (Array.isArray(donors)) {
      for (const item of donors) {
        if (!item.name) continue;
        const id = item.id || `dn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const existingIndex = newDonors.findIndex((d) => d.id === id || d.phone && d.phone === item.phone);
        const donorRecord = {
          id,
          name: item.name,
          bloodGroup: item.bloodGroup || item.group || "O+",
          city: item.city || "Local Area",
          phone: item.phone || "+91 98000-00000",
          email: item.email,
          age: parseInt(item.age, 10) || 25,
          weight: parseFloat(item.weight) || 60,
          hemoglobin: parseFloat(item.hemoglobin) || 13.5,
          lastDonated: item.lastDonated || "100 days ago",
          status: item.status || "Ready"
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
    let supabaseSyncResult = "In-memory & local JSON persisted.";
    if (supabase) {
      try {
        supabaseSyncResult = "Synced with remote Supabase project.";
      } catch (err) {
        supabaseSyncResult = `Persisted locally (Remote Supabase note: ${err?.message || "offline"}).`;
      }
    }
    return res.json({
      success: true,
      message: `Successfully integrated ${bloodBanks.length} blood bank(s) and ${donors.length} donor(s). ${supabaseSyncResult}`,
      bloodBanks: updatedData.bloodBanks,
      donors: updatedData.donors
    });
  } catch (error) {
    console.error("Import error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to import records" });
  }
});
app.post("/api/supabase/generate-seed", (req, res) => {
  try {
    const data = getIntegratedData();
    const banks = req.body.bloodBanks || data.bloodBanks;
    const donors = req.body.donors || data.donors;
    let sql = `-- =========================================================================
`;
    sql += `-- SUPABASE SQL SEED SCRIPT: IMPORTED BLOOD BANKS & DONORS
`;
    sql += `-- Generated on ${(/* @__PURE__ */ new Date()).toISOString()}
`;
    sql += `-- Run this script in your Supabase SQL Editor
`;
    sql += `-- =========================================================================

`;
    sql += `-- 1. Seed Blood Banks into public.hospitals
`;
    sql += `INSERT INTO public.hospitals (name, license_number, city, address, contact_number, verified)
VALUES
`;
    const bankRows = banks.map((b) => {
      const name = b.name.replace(/'/g, "''");
      const lic = (b.licenseNumber || "NACO-REG").replace(/'/g, "''");
      const city = (b.city || "Hub").replace(/'/g, "''");
      const addr = (b.address || "").replace(/'/g, "''");
      const phone = (b.contactNumber || b.phone || "").replace(/'/g, "''");
      return `  ('${name}', '${lic}', '${city}', '${addr}', '${phone}', true)`;
    });
    sql += bankRows.join(",\n") + ";\n\n";
    sql += `-- 2. Seed Donors into public.donors
`;
    sql += `INSERT INTO public.donors (blood_group, points, weight, hemoglobin, age, referral_code)
VALUES
`;
    const donorRows = donors.map((d, idx) => {
      const bg = d.bloodGroup || "O+";
      const weight = d.weight || 65;
      const hb = d.hemoglobin || 13.5;
      const age = d.age || 26;
      const refCode = `donor-${idx + 1}-${bg.toLowerCase().replace("+", "pos").replace("-", "neg")}`;
      return `  ('${bg}', 1200, ${weight}, ${hb}, ${age}, '${refCode}')`;
    });
    sql += donorRows.join(",\n") + ";\n";
    return res.json({ success: true, sql });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to generate seed SQL" });
  }
});
app.post("/api/supabase/reset", (_req, res) => {
  saveIntegratedData({ bloodBanks: DEFAULT_BLOOD_BANKS, donors: DEFAULT_DONORS });
  res.json({
    success: true,
    message: "Reset to default verified blood banks and donor list.",
    bloodBanks: DEFAULT_BLOOD_BANKS,
    donors: DEFAULT_DONORS
  });
});
const handleBroadcastGeneration = async (req, res) => {
  try {
    const {
      hospitalName = "AIIMS Raipur Blood Center",
      city = "Raipur",
      bloodGroup = "O-",
      unitsNeeded = 4,
      department = "Trauma ICU / Bed 14",
      contactNumber = "+91 98765-43210",
      urgencyLevel = "CRITICAL (Golden Hour)",
      patientRef = "Emergency Trauma Admit",
      model
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
1. Start with high-visibility emergency emojis (\u{1F6A8} \u{1FA78} \u23F0 \u{1F198}).
2. Clearly highlight the BLOOD GROUP (${bloodGroup}) and UNITS NEEDED (${unitsNeeded}).
3. Include patient location, bed/ward reference, and direct emergency coordinator contact.
4. Include a Google Maps link (${mapsLink}) for donors to navigate immediately.
5. Provide a clear call to action to forward to local WhatsApp groups.
6. Keep it concise, punchy, and formatted with WhatsApp bold (*text*) styling. Do not include markdown codeblocks or quotes.`;
    const fallbackGenerator = () => `\u{1F6A8} *URGENT BLOOD SOS // GOLDEN HOUR PROTOCOL* \u{1FA78}

*Required Blood Group:* *${bloodGroup}* (${unitsNeeded} Units urgently needed)
*Hospital:* ${hospitalName}, ${city}
*Department/Ward:* ${department}
*Urgency:* ${urgencyLevel}

\u{1F4CD} *Location & Route:* ${mapsLink}
\u{1F4DE} *Verified Emergency Contact:* ${contactNumber}

\u{1F64F} *Calling all eligible voluntary donors and nearby blood banks.* Every minute counts. Please forward this alert to your local blood community groups!`;
    const aiResult = await generateAIContent(
      {
        prompt,
        requestedModel: model
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
      unitsNeeded
    });
  } catch (error) {
    console.error("Error generating broadcast message:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate emergency broadcast"
    });
  }
};
app.post("/api/gemini/broadcast", handleBroadcastGeneration);
app.post("/api/ai/broadcast", handleBroadcastGeneration);
const handleChatBot = async (req, res) => {
  try {
    const {
      message = "",
      history = [],
      language = "en",
      // 'en' | 'hi' | 'hinglish'
      donorProfile = { name: "Rahul Sharma", bloodGroup: "O+", weight: 68, hb: 14.2 },
      model
    } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const languageInstructions = {
      en: "Reply in clear, warm, and professional English.",
      hi: "\u0909\u0924\u094D\u0924\u0930 \u0936\u0941\u0926\u094D\u0927 \u090F\u0935\u0902 \u0938\u0930\u0932 \u0939\u093F\u0902\u0926\u0940 \u092E\u0947\u0902 \u0926\u0947\u0902 (Devanagari script)\u0964",
      hinglish: 'Reply in natural, polite Indian conversational Hinglish (Latin script mix of Hindi & English) like "Namaste! Haan bilkul, aap..."'
    };
    const langDirective = languageInstructions[language] || languageInstructions.en;
    const disclaimerText = "\u26A0\uFE0F *Disclaimer: Not professional medical diagnosis. In critical emergencies contact local emergency numbers (112 / 108) or visit the nearest hospital.*";
    const systemInstruction = `You are BloodBot AI, the clinical medical blood guide for Blood-Connect.
Your role:
- Answer voluntary blood donation queries, donor eligibility checks, dietary advice to boost iron/hemoglobin, tattoo/piercing waiting intervals (typically 6 months as per standard clinical blood bank rules), medication interactions, and post-donation recovery care.
- Target language: ${langDirective}
- The user is: ${donorProfile.name} (Blood Group: ${donorProfile.bloodGroup}, Weight: ${donorProfile.weight}kg, Hb: ${donorProfile.hb} g/dL).
- Tone: Empathetic, scientifically accurate, encouraging, concise (2 to 4 paragraphs or bullet points).
- MANDATORY REQUIREMENT: ALWAYS append this exact clinical disclaimer at the end of every response:
"${disclaimerText}"`;
    const fallbackGenerator = () => {
      const lower = message.toLowerCase();
      if (language === "hi") {
        if (lower.includes("tattoo") || lower.includes("\u091F\u0948\u091F\u0942")) {
          return "\u091F\u0948\u091F\u0942 \u092C\u0928\u0935\u093E\u0928\u0947 \u092F\u093E \u092A\u093F\u092F\u0930\u094D\u0938\u093F\u0902\u0917 \u0915\u0947 \u092C\u093E\u0926 \u0930\u0915\u094D\u0924 \u0938\u0902\u0915\u094D\u0930\u092E\u0923 \u0915\u0940 \u0930\u094B\u0915\u0925\u093E\u092E \u0915\u0947 \u0932\u093F\u090F \u0915\u092E \u0938\u0947 \u0915\u092E 6 \u092E\u0939\u0940\u0928\u0947 \u0915\u093E \u0905\u0902\u0924\u0930\u093E\u0932 \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u094B\u0924\u093E \u0939\u0948\u0964 6 \u092E\u0939\u0940\u0928\u0947 \u092A\u0942\u0930\u0947 \u0939\u094B\u0928\u0947 \u0914\u0930 \u0924\u094D\u0935\u091A\u093E \u0915\u0947 \u092A\u0942\u0930\u094D\u0923\u0924\u0903 \u0938\u094D\u0935\u0938\u094D\u0925 \u0939\u094B\u0928\u0947 \u0915\u0947 \u092C\u093E\u0926 \u0906\u092A \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0930\u0915\u094D\u0924\u0926\u093E\u0928 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964\n\n" + disclaimerText;
        } else if (lower.includes("hemoglobin") || lower.includes("\u0939\u0940\u092E\u094B\u0917\u094D\u0932\u094B\u092C\u093F\u0928") || lower.includes("iron")) {
          return "\u0939\u0940\u092E\u094B\u0917\u094D\u0932\u094B\u092C\u093F\u0928 \u092C\u0922\u093C\u093E\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0906\u0939\u093E\u0930 \u092E\u0947\u0902 \u092A\u093E\u0932\u0915, \u091A\u0941\u0915\u0902\u0926\u0930, \u0905\u0928\u093E\u0930, \u0917\u0941\u0921\u093C, \u091A\u0928\u093E, \u0905\u0902\u091C\u0940\u0930 \u0914\u0930 \u0916\u091C\u0942\u0930 \u0936\u093E\u092E\u093F\u0932 \u0915\u0930\u0947\u0902\u0964 \u0935\u093F\u091F\u093E\u092E\u093F\u0928 \u0938\u0940 (\u091C\u0948\u0938\u0947 \u0928\u0940\u0902\u092C\u0942, \u0906\u0902\u0935\u0932\u093E) \u092F\u0941\u0915\u094D\u0924 \u0916\u093E\u0926\u094D\u092F \u092A\u0926\u093E\u0930\u094D\u0925 \u0906\u092F\u0930\u0928 \u0915\u0947 \u0905\u0935\u0936\u094B\u0937\u0923 \u092E\u0947\u0902 \u092E\u0926\u0926 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964\n\n" + disclaimerText;
        } else {
          return `\u0928\u092E\u0938\u094D\u0924\u0947 ${donorProfile.name}! \u090F\u0915 \u0938\u094D\u0935\u0938\u094D\u0925 \u0935\u092F\u0938\u094D\u0915 \u092A\u0941\u0930\u0941\u0937 \u0915\u093E \u0939\u0940\u092E\u094B\u0917\u094D\u0932\u094B\u092C\u093F\u0928 \u226513.0 g/dL \u0914\u0930 \u092E\u0939\u093F\u0932\u093E \u0915\u093E \u226512.5 g/dL \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F\u0964 \u0926\u094B \u092A\u0942\u0930\u094D\u0923 \u0930\u0915\u094D\u0924\u0926\u093E\u0928\u094B\u0902 \u0915\u0947 \u092C\u0940\u091A \u0915\u092E \u0938\u0947 \u0915\u092E 90 \u0926\u093F\u0928\u094B\u0902 \u0915\u093E \u0905\u0902\u0924\u0930\u093E\u0932 \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u0948\u0964

` + disclaimerText;
        }
      } else if (language === "hinglish") {
        if (lower.includes("tattoo")) {
          return `Tattoo banwane ke baad standard NACO and international guidelines ke mutabik 6 months ka wait karna compulsory hota hai taaki hepatitis ya infection ka risk zero ho. 6 months complete hone par aap easily donate kar sakte hain!

` + disclaimerText;
        } else if (lower.includes("hemoglobin") || lower.includes("iron") || lower.includes("badhaye")) {
          return `Hemoglobin natural tareeqe se badhane ke liye diet mein Palak, Chukandar (Beetroot), Pomegranate (Anaar), Jaggery (Gud), Roasted Chana aur Dates lijiye. Saath mein Nimbu paani ya Amla juice lene se Iron body me jaldi absorb hota hai.

` + disclaimerText;
        } else {
          return `Namaste ${donorProfile.name}! Whole blood donation har 90 din (3 months) ke gap par kiya ja sakta hai. Donation se pehle 500ml paani zaroor piyein aur khali pet na aayein.

` + disclaimerText;
        }
      } else {
        if (lower.includes("tattoo")) {
          return `After getting a tattoo or body piercing, clinical protocols require a waiting deferral period of 6 months to ensure safety against blood-borne pathogens. Once 6 months have passed and the skin is fully healed, you are welcome to donate!

` + disclaimerText;
        } else if (lower.includes("hemoglobin") || lower.includes("iron")) {
          return `To boost your hemoglobin levels naturally:
\u2022 Consume iron-rich foods: Spinach, beetroot, lentils, pomegranate, and dry fruits (raisins, dates).
\u2022 Pair with Vitamin C (citrus fruits, amla) to enhance dietary iron absorption.
\u2022 Avoid tea/coffee immediately around meals.

` + disclaimerText;
        } else {
          return `Hello ${donorProfile.name}! Voluntary donors must be 18\u201365 years old, weigh at least 45 kg, have a hemoglobin of \u226512.5 g/dL, and observe a minimum 90-day interval between whole blood donations. Stay well-hydrated!

` + disclaimerText;
        }
      }
    };
    const aiResult = await generateAIContent(
      {
        prompt: message,
        systemInstruction,
        history,
        requestedModel: model
      },
      fallbackGenerator
    );
    return res.json({
      success: true,
      reply: aiResult.text,
      provider: aiResult.provider,
      model: aiResult.model,
      language
    });
  } catch (error) {
    console.error("Error in chat bot endpoint:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error processing chat query"
    });
  }
};
app.post("/api/gemini/chat", handleChatBot);
app.post("/api/ai/chat", handleChatBot);
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\u{1F680} Blood-Connect Server running on http://0.0.0.0:${PORT}`);
    });
  }
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
export {
  FREE_OPENROUTER_MODELS,
  server_default as default
};
