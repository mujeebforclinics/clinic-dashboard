import { createClient } from "@supabase/supabase-js";

function safeUrl(value: string | undefined): string {
  if (!value) return "https://placeholder.supabase.co";
  try {
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
