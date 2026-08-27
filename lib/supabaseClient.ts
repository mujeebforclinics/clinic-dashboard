import { createClient } from "@supabase/supabase-js";

// Fallback values prevent the build from crashing if env vars aren't
// available at build time. In the browser (runtime), the real values
// from Vercel's Environment Variables will always be used instead.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);