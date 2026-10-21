"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AuthShell from "@/components/AuthShell";

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
      <AuthShell
        title="Check your email"
        subtitle="One quick step and your clinic is ready."
        footer={<Link href="/login" className="font-semibold text-teal hover:underline">Go to login</Link>}
      >
        <div className="card p-6 text-sm text-ink/70">
          We sent a confirmation link to <strong className="text-ink">{email}</strong>. Click it, then come back and log in. Your clinic will be set up automatically.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set up your clinic"
      subtitle="Start free. Create your account to track appointments, billing and inventory."
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-teal hover:underline">Log in</Link></>}
    >
      <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
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
            <label className="mb-1.5 block text-sm font-medium">
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
            <label className="mb-1.5 block text-sm font-medium">
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
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
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
    </AuthShell>
  );
}
