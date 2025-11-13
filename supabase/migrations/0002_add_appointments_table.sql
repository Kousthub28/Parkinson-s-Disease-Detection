-- Create appointments table for storing doctor consultations
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  doctor_hospital TEXT,
  appointment_date TIMESTAMPTZ NOT NULL,
  appointment_time TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  consultation_type TEXT DEFAULT 'in-person' CHECK (consultation_type IN ('in-person', 'video')),
  notes TEXT,
  prescription_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.appointments IS 'Stores doctor appointment bookings with prescription attachments';

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Allow users to view and manage their own appointments
CREATE POLICY "Users can view their own appointments"
ON public.appointments
FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Users can create their own appointments"
ON public.appointments
FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can update their own appointments"
ON public.appointments
FOR UPDATE
USING (auth.uid() = patient_id);

-- Create index for faster queries
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);

-- Create storage bucket for prescriptions
INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', FALSE)
ON CONFLICT (id) DO NOTHING;

-- RLS for prescriptions bucket
CREATE POLICY "Users can upload their prescriptions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'prescriptions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their prescriptions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prescriptions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
