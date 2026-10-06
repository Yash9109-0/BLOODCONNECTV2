-- =========================================================================
-- BLOOD-CONNECT: SUPABASE PRODUCTION DATABASE SCHEMA & RLS POLICIES
-- Multi-Tenant Blood Inventory, Emergency Broadcasts & Gamified Donors
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('hospital', 'donor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE blood_group_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE urgency_type AS ENUM ('routine', 'urgent', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE request_status_type AS ENUM ('open', 'fulfilled', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles Table (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'donor',
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Hospitals Table
CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  license_number TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  coordinates JSONB DEFAULT '{"lat": 21.2514, "lng": 81.6296}'::jsonb,
  contact_number TEXT NOT NULL,
  verified BOOLEAN DEFAULT true,
  zone_hub TEXT DEFAULT 'Zone 4 Hub',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Blood Inventory Table
CREATE TABLE IF NOT EXISTS public.blood_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  blood_group blood_group_type NOT NULL,
  units_available INTEGER NOT NULL DEFAULT 0 CHECK (units_available >= 0),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(hospital_id, blood_group)
);

-- 5. Emergency Requests Table
CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  blood_group blood_group_type NOT NULL,
  units_needed INTEGER NOT NULL CHECK (units_needed > 0),
  urgency_level urgency_type NOT NULL DEFAULT 'urgent',
  status request_status_type NOT NULL DEFAULT 'open',
  patient_ref TEXT,
  department TEXT DEFAULT 'Trauma ICU',
  formatted_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  fulfilled_at TIMESTAMPTZ
);

-- 6. Donors Table
CREATE TABLE IF NOT EXISTS public.donors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  donor_code TEXT UNIQUE NOT NULL DEFAULT ('BC-IN-' || upper(substring(md5(random()::text) from 1 for 6))),
  blood_group blood_group_type NOT NULL,
  points INTEGER NOT NULL DEFAULT 100 CHECK (points >= 0),
  weight NUMERIC(5,2) NOT NULL CHECK (weight >= 45),
  hemoglobin NUMERIC(4,2) CHECK (hemoglobin >= 12.0),
  age INTEGER NOT NULL CHECK (age >= 18 AND age <= 65),
  total_donations INTEGER DEFAULT 0,
  lives_saved_count INTEGER DEFAULT 0,
  badge_tier TEXT DEFAULT 'Gold Hero',
  last_donated_at TIMESTAMPTZ,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Donation Camps Table
CREATE TABLE IF NOT EXISTS public.donation_camps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  pledged_donors_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Rewards Redemption Table
CREATE TABLE IF NOT EXISTS public.rewards_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_id UUID NOT NULL REFERENCES public.donors(id) ON DELETE CASCADE,
  reward_title TEXT NOT NULL,
  partner_brand TEXT NOT NULL,
  points_spent INTEGER NOT NULL,
  voucher_code TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards_redemptions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 2. Hospitals Policies
CREATE POLICY "Hospitals directory is viewable by all authenticated users"
  ON public.hospitals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Hospital admin can update their own hospital entry"
  ON public.hospitals FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Blood Inventory Policies
-- ANY authenticated user (including donors and other hospitals) can READ inventory across facilities
CREATE POLICY "Blood inventory is publicly readable across network"
  ON public.blood_inventory FOR SELECT
  TO authenticated
  USING (true);

-- ONLY the hospital owning this inventory record can insert/update/delete it
CREATE POLICY "Hospitals can only manage their own blood inventory"
  ON public.blood_inventory FOR ALL
  TO authenticated
  USING (
    hospital_id IN (
      SELECT id FROM public.hospitals WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    hospital_id IN (
      SELECT id FROM public.hospitals WHERE user_id = auth.uid()
    )
  );

-- 4. Emergency Requests Policies
-- Everyone can view open emergency blood requests
CREATE POLICY "Emergency requests are visible to all users"
  ON public.emergency_requests FOR SELECT
  TO authenticated
  USING (true);

-- Only hospital admins can publish emergency requests for their facility
CREATE POLICY "Hospitals can publish emergency requests"
  ON public.emergency_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    hospital_id IN (
      SELECT id FROM public.hospitals WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Hospitals can update their own emergency requests"
  ON public.emergency_requests FOR UPDATE
  TO authenticated
  USING (
    hospital_id IN (
      SELECT id FROM public.hospitals WHERE user_id = auth.uid()
    )
  );

-- 5. Donors Policies
-- Donors can read and update their own donor record
CREATE POLICY "Donors can view their own profile"
  ON public.donors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Hospitals can view donor contact details ONLY when matched to emergency request
CREATE POLICY "Hospitals can view donors for matching"
  ON public.donors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hospital'
    )
  );

CREATE POLICY "Donors can update their own profile and points"
  ON public.donors FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Donation Camps Policies
CREATE POLICY "Donation camps are viewable by everyone"
  ON public.donation_camps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only hospitals can create and manage donation camps"
  ON public.donation_camps FOR ALL
  TO authenticated
  USING (
    hospital_id IN (
      SELECT id FROM public.hospitals WHERE user_id = auth.uid()
    )
  );

-- 7. Rewards Redemptions Policies
CREATE POLICY "Donors can view their own reward redemptions"
  ON public.rewards_redemptions FOR ALL
  TO authenticated
  USING (
    donor_id IN (
      SELECT id FROM public.donors WHERE user_id = auth.uid()
    )
  );

-- =========================================================================
-- DATABASE TRIGGERS & AUTOMATION
-- =========================================================================

-- Trigger to automatically create a public.profile upon Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'donor'::user_role),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Verified User'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger to initialize 8 standard blood group inventory slots when a hospital is created
CREATE OR REPLACE FUNCTION public.handle_new_hospital_inventory()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.blood_inventory (hospital_id, blood_group, units_available)
  VALUES 
    (NEW.id, 'A+', 10),
    (NEW.id, 'A-', 5),
    (NEW.id, 'B+', 20),
    (NEW.id, 'B-', 4),
    (NEW.id, 'AB+', 15),
    (NEW.id, 'AB-', 2),
    (NEW.id, 'O+', 30),
    (NEW.id, 'O-', 3)
  ON CONFLICT (hospital_id, blood_group) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_hospital_created ON public.hospitals;
CREATE TRIGGER on_hospital_created
  AFTER INSERT ON public.hospitals
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_hospital_inventory();
