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
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp(
        {
          email,
          password,
          options: {
            data: {
              pending_clinic_name: clinicName,
              pending_owner_name: ownerName,
              pending_clinic_type: clinicType,
            },
          },
        }
      );
      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup did not return a user.");

      if (authData.session) {
        router.replace("/dashboard");
      } else {
        setCheckEmail(true);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 max-w-sm text-center">
          <p className="font-display text-xl font-semibold mb-2">
            Check your email
          </p>
          <p className="text-sm text-ink/60">
            We sent a confirmation link to <strong>{email}</strong>. Click it,
            then come back and log in — your clinic will be set up
            automatically.
          </p>
          <Link href="/login" className="btn-primary inline-block mt-4">
            Go to login
          </Link>
        </div>
      </main>
    );
  }

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
