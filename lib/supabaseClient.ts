import { createClient } from "@supabase/supabase-js";

// Fallback values prevent the build from crashing if env vars aren't
// available, or are malformed, at build time. In the browser (runtime),
// the real values from Vercel's Environment Variables will be used
// instead, as long as they are entered correctly.
function safeUrl(value: string | undefined): string {
  if (!value) return "https://placeholder.supabase.co";
  try {
    // Throws if the string isn't a valid URL
    new URL(value);
    return value;
  } catch {
    return "https://placeholder.supabase.co";
  }
}

const supabaseUrl = safeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);