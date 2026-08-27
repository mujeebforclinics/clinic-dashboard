"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [clinicName, setClinicName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [clinicType, setClinicType] = useState("General");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup did not return a user.");

      // 2. Create the clinic row
      const { data: clinicRow, error: clinicError } = await supabase
        .from("clinics")
        .insert({
          name: clinicName,
          owner_name: ownerName,
          email,
          clinic_type: clinicType,
        })
        .select()
        .single();
      if (clinicError) throw clinicError;

      // 3. Link the auth user to the clinic
      const { error: linkError } = await supabase.from("clinic_owners").insert({
        user_id: authData.user.id,
        clinic_id: clinicRow.id,
      });
      if (linkError) throw linkError;

      // 4. Start a trial subscription row
      await supabase.from("subscriptions").insert({
        clinic_id: clinicRow.id,
        plan: "standard",
        status: "trial",
      });

      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-semibold mb-1">
          Set up your clinic
        </h1>
        <p className="text-ink/60 mb-6 text-sm">
          Create your account to start tracking appointments, billing, and
          inventory live.
        </p>

        <form onSubmit={handleSignup} className="card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              Clinic name
            </label>
            <input
              className="input"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="e.g. Sunrise Family Clinic"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Owner name
            </label>
            <input
              className="input"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Clinic type
            </label>
            <select
              className="input"
              value={clinicType}
              onChange={(e) => setClinicType(e.target.value)}
            >
              <option>General</option>
              <option>Dental</option>
              <option>Physiotherapy</option>
              <option>Skin</option>
              <option>Eye</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Password
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-ink/60 mt-4 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-clay font-medium">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
