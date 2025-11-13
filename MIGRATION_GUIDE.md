# Database Migration Guide

## Apply the Appointments Table Migration

This migration creates the necessary database structure for the appointment booking feature.

### What This Migration Does:
- ✅ Creates `appointments` table
- ✅ Sets up Row Level Security (RLS) policies
- ✅ Creates `prescriptions` storage bucket
- ✅ Adds indexes for better performance

---

## Quick Setup (Easiest Method)

### Step 1: Go to Supabase Dashboard
1. Open https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Run the Migration
1. Click **"New Query"**
2. Copy the entire contents of `supabase/migrations/0002_add_appointments_table.sql`
3. Paste into the SQL Editor
4. Click **"Run"** (or press Ctrl+Enter)

### Step 3: Verify
After running, you should see:
- `appointments` table in Table Editor
- `prescriptions` bucket in Storage

---

## Alternative: Using Supabase CLI (If You Want to Install It)

### Install Supabase CLI:
```powershell
# Using npm
npm install -g supabase

# Or using Chocolatey
choco install supabase
```

### Run Migration:
```powershell
supabase db push
```

---

## What Gets Created:

### 1. Appointments Table
```
- id (UUID, primary key)
- patient_id (UUID, references auth.users)
- doctor_id (TEXT)
- doctor_name (TEXT)
- doctor_hospital (TEXT)
- appointment_date (TIMESTAMP)
- appointment_time (TEXT)
- status (scheduled/completed/cancelled)
- consultation_type (in-person/video)
- notes (TEXT)
- prescription_storage_path (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### 2. Storage Bucket
- **Name**: `prescriptions`
- **Privacy**: Private (users can only access their own files)

### 3. Security Policies
- Users can only view their own appointments
- Users can create appointments for themselves
- Users can update their own appointments
- Users can upload/view their own prescriptions

---

## Troubleshooting

### "relation already exists" error
- The table might already be created
- Check Table Editor to confirm

### "bucket already exists" error
- Check Storage to see if `prescriptions` bucket exists
- If yes, the migration partially ran successfully

### Need to Rollback?
If you need to remove the changes:
```sql
-- Run this in SQL Editor
DROP TABLE IF EXISTS public.appointments CASCADE;
DELETE FROM storage.buckets WHERE id = 'prescriptions';
```

---

## After Migration

Once the migration is applied, the following features will work:
1. ✅ Book appointments from `/consult/{doctorId}/book`
2. ✅ Upload prescription files
3. ✅ View appointments on Dashboard
4. ✅ Real-time appointment updates

Start the dev server and test it out:
```powershell
npm run dev
```
