"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    };
    checkSession();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-ink/60 font-body">Loading…</p>
    </main>
  );
}
