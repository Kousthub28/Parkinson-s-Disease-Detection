/*
# [Initial Schema Setup]
This script sets up the initial database schema for the NeuroCare application.
It includes tables for patient profiles, tests, reports, orders, and audit logs.
It also configures Row Level Security (RLS) to ensure users can only access their own data.
A trigger is created to automatically insert a new patient profile when a new user signs up.

## Query Description: This is a foundational script for a new database. It creates all necessary tables and security policies. It is safe to run on a new, empty project. It does not delete any data.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (tables can be dropped)

## Structure Details:
- Tables created: patient_profiles, tests, reports, orders, audit_logs
- Triggers created: on_auth_user_created
- RLS Policies: Enabled for all tables.

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes (initial policies are created)
- Auth Requirements: Policies are based on `auth.uid()`.

## Performance Impact:
- Indexes: Primary keys and foreign keys are indexed.
- Triggers: One trigger on user creation.
- Estimated Impact: Low.
*/

-- 1. PATIENT PROFILES TABLE
-- Stores additional user information.
CREATE TABLE public.patient_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  phone TEXT,
  emergency_contact TEXT,
  consent_flags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.patient_profiles IS 'Stores additional user information, linked to the auth.users table.';

-- RLS for patient_profiles
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own profile."
ON public.patient_profiles
FOR ALL
USING (auth.uid() = id);

-- 2. CREATE FUNCTION TO HANDLE NEW USER
-- This function will be called by a trigger when a new user is created in auth.users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.patient_profiles (id, full_name, consent_flags)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'consent_flags');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREATE TRIGGER
-- This trigger calls the function whenever a new user is created.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 4. TEST ARTIFACTS STORAGE BUCKET
-- Create a bucket for storing uploaded test files (audio, images, video).
INSERT INTO storage.buckets (id, name, public)
VALUES ('test_artifacts', 'test_artifacts', FALSE)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage
CREATE POLICY "Users can upload their own test artifacts."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'test_artifacts' AND owner = auth.uid());

CREATE POLICY "Users can view their own test artifacts."
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'test_artifacts' AND owner = auth.uid());


-- 5. TESTS TABLE
-- Stores information about each test performed by a user.
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL, -- e.g., 'speech', 'spiral', 'wave', 'video'
  raw_storage_path TEXT, -- Path in Supabase Storage
  processed_storage_path TEXT,
  result JSONB, -- Stores the model's output
  model_versions JSONB,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.tests IS 'Records of each diagnostic test taken by a patient.';

-- RLS for tests
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their own tests."
ON public.tests
FOR ALL
USING (auth.uid() = patient_id);

-- 6. REPORTS TABLE
-- Stores generated PDF reports.
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  pdf_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.reports IS 'Stores generated PDF reports linked to a specific test.';

-- RLS for reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their own reports."
ON public.reports
FOR ALL
USING (auth.uid() = patient_id);


-- 7. ORDERS TABLE
-- For the Zepto/pharmacy integration.
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  order_payload JSONB,
  status TEXT,
  external_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.orders IS 'Tracks medicine orders placed through integrated services.';

-- RLS for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their own orders."
ON public.orders
FOR ALL
USING (auth.uid() = patient_id);


-- 8. AUDIT LOGS TABLE
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS 'Logs significant actions within the application for security and traceability.';

-- RLS for audit_logs (generally, only admins should see this, but users can see their own logs)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own audit logs."
ON public.audit_logs
FOR SELECT
USING (auth.uid() = user_id);
-- Note: An admin/service_role policy would be needed for full access.
