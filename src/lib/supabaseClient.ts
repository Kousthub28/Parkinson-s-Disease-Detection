import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient<Database>;

// We check if the URL is a valid http/https URL before creating the client.
// The app crashes if an invalid string (like a masked key) is passed.
if (supabaseUrl && supabaseUrl.startsWith('http') && supabaseAnonKey) {
  supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
} else {
  console.warn(
    'Supabase environment variables are missing or invalid. Using a mock client. Please connect your Supabase project to enable database features.'
  );
  
  // Create a mock client that mimics the Supabase client structure 
  // enough to prevent the app from crashing. Its methods do nothing.
  const mockAuth = {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: "Mock client: Supabase not configured.", name: "MockError", status: 500 } }),
      signOut: () => Promise.resolve({ error: null }),
      signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: "Mock client: Supabase not configured." } }),
  };

  const mockStorage = {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: { message: "Mock client: Supabase not configured." } })
    })
  }

  const mockClient = {
    auth: mockAuth,
    storage: mockStorage,
    from: () => ({
      select: () => Promise.resolve({ data: [], error: { message: "Mock client: Supabase not configured." } }),
      insert: () => Promise.resolve({ data: [], error: { message: "Mock client: Supabase not configured." } }),
      update: () => Promise.resolve({ data: [], error: { message: "Mock client: Supabase not configured." } }),
      delete: () => Promise.resolve({ data: [], error: { message: "Mock client: Supabase not configured." } }),
    }),
  };

  supabase = mockClient as unknown as SupabaseClient<Database>;
}

export { supabase };
