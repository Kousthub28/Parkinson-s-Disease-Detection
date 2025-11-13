/*
# [Operation Name]
Fix User Profile Creation Trigger

## Query Description: [This operation updates the `handle_new_user` function to correctly parse user metadata during sign-up. It changes the way consent flags are read, switching from a nested JSON object to flat key-value pairs and building the JSONB object within the function itself. This prevents errors when a new user's profile is automatically created.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- Function: `public.handle_new_user()`

## Security Implications:
- RLS Status: [No Change]
- Policy Changes: [No]
- Auth Requirements: [No Change]

## Performance Impact:
- Indexes: [No Change]
- Triggers: [No Change]
- Estimated Impact: [Negligible. This is a minor logic change in a function that runs once per user creation.]
*/

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with the corrected logic
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.patient_profiles (id, full_name, consent_flags)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    jsonb_build_object(
      'medical_data', (new.raw_user_meta_data->>'consent_medical_data')::boolean,
      'camera_mic', (new.raw_user_meta_data->>'consent_camera_mic')::boolean
    )
  );
  return new;
end;
$$;

-- Recreate the trigger to use the new function
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
