import { createClient } from '@supabase/supabase-js';

// Read environment variables defined by Vite. These variables are injected at build
// time and must start with VITE_ to be exposed to the client.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Create a single supabase client instance for the app.
export const supabase = createClient(supabaseUrl, supabaseKey);