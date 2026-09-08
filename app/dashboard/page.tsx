"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Clinic } from "@/lib/types";
import OverviewTab from "@/components/OverviewTab";
import PatientsTab from "@/components/PatientsTab";
import AppointmentsTab from "@/components/AppointmentsTab";
import BillingTab from "@/components/BillingTab";
import InventoryTab from "@/components/InventoryTab";
import OwnerQuickView from "@/components/OwnerQuickView";
import NoteForOwner from "@/components/NoteForOwner";

type TabKey = "overview" | "patients" | "appointments" | "billing" | "inventory";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "patients", label: "Patients" },
  { key: "appointments", label: "Appointments" },
  { key: "billing", label: "Billing" },
  { key: "inventory", label: "Inventory" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const user = sessionData.session.user;
      const { data: link } = await supabase
        .from("clinic_owners")
        .select("clinic_id")
        .eq("user_id", user.id)
        .single();

      if (link) {
        const { data: clinicRow } = await supabase
          .from("clinics")
          .select("*")
          .eq("id", link.clinic_id)
          .single();
        setClinic(clinicRow);
        setLoading(false);
        return;
      }

      // No clinic linked yet — this can happen on first login after email
      // confirmation. If the signup form left pending clinic details in
      // this user's metadata, create the clinic now.
      const pendingName = user.user_metadata?.pending_clinic_name;
      if (pendingName) {
        const { data: newClinic, error: clinicError } = await supabase
          .from("clinics")
          .insert({
            name: pendingName,
            owner_name: user.user_metadata?.pending_owner_name ?? "",
            email: user.email,
            clinic_type: user.user_metadata?.pending_clinic_type ?? "General",
          })
          .select()
          .single();

        if (!clinicError && newClinic) {
          await supabase.from("clinic_owners").insert({
            user_id: user.id,
            clinic_id: newClinic.id,
          });
          await supabase.from("subscriptions").insert({
            clinic_id: newClinic.id,
            plan: "standard",
            status: "trial",
          });
          setClinic(newClinic);
          setLoading(false);
          return;
        }
      }

      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink/60">Loading…</p>
      </main>
    );
  }

  if (!clinic) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 text-center max-w-sm">
          <p className="font-medium mb-2">No clinic linked to this account</p>
          <p className="text-sm text-ink/60">
            Something went wrong linking your account to a clinic. Please
            contact support or try signing up again.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold">
              {clinic.name}
            </p>
            <p className="text-xs text-ink/50">{clinic.clinic_type}</p>
          </div>
          <div className="flex items-center gap-2">
            <NoteForOwner clinicId={clinic.id} />
            <button className="btn-ghost text-sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-6">
        <nav className="flex gap-1 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${activeTab === t.key ? "tab-active" : "hover:bg-white"}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" && <OverviewTab clinicId={clinic.id} />}
        {activeTab === "patients" && <PatientsTab clinicId={clinic.id} />}
        {activeTab === "appointments" && (
          <AppointmentsTab clinicId={clinic.id} />
        )}
        {activeTab === "billing" && <BillingTab clinicId={clinic.id} />}
        {activeTab === "inventory" && <InventoryTab clinicId={clinic.id} />}
      </div>

      {/* Floating owner quick-view — visible on every tab */}
      <OwnerQuickView clinicId={clinic.id} />
    </main>
  );
}
