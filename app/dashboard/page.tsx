"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Clinic, TabKey } from "@/lib/types";
import OverviewTab from "@/components/OverviewTab";
import PatientsTab from "@/components/PatientsTab";
import AppointmentsTab from "@/components/AppointmentsTab";
import BillingTab from "@/components/BillingTab";
import InventoryTab from "@/components/InventoryTab";
import OwnerQuickView from "@/components/OwnerQuickView";
import NoteForOwner from "@/components/NoteForOwner";
import Sidebar from "@/components/Sidebar";

const TAB_TITLES: Record<TabKey, { title: string; subtitle: string }> = {
  overview: { title: "Welcome back", subtitle: "Here's how {clinic} is doing today." },
  appointments: { title: "Appointments", subtitle: "Book, reschedule and track every visit." },
  patients: { title: "Patients", subtitle: "Search records, visit history and revenue." },
  billing: { title: "Billing", subtitle: "Invoices, payments and outstanding dues." },
  inventory: { title: "Inventory", subtitle: "Stock levels, batches and expiry tracking." },
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [subBlocked, setSubBlocked] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const checkSubscription = async (clinicId: string) => {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, trial_ends_at")
      .eq("clinic_id", clinicId)
      .single();

    if (!sub) return; // no subscription row yet — don't block, nothing to check

    if (sub.status === "cancelled") {
      setSubBlocked("cancelled");
      return;
    }
    if (sub.status === "trial" && sub.trial_ends_at) {
      const expired = new Date(sub.trial_ends_at).getTime() < Date.now();
      if (expired) {
        setSubBlocked("trial_expired");
      }
    }
  };

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
        await checkSubscription(link.clinic_id);
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
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
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

  if (subBlocked) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-md">
          <p className="font-display text-xl font-semibold mb-2">
            {subBlocked === "cancelled" ? "Subscription cancelled" : "Trial period has ended"}
          </p>
          <p className="text-sm text-ink/60 mb-5">
            {subBlocked === "cancelled"
              ? "This clinic's subscription has been cancelled. Contact us to reactivate access."
              : "Your free trial has ended. Contact us to continue using the dashboard."}
          </p>
          <button className="btn-primary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </main>
    );
  }

  const ownerFirstName = clinic.owner_name?.trim().split(/\s+/)[0] ?? null;
  const heading = TAB_TITLES[activeTab];
  const greeting =
    activeTab === "overview"
      ? `Welcome back${ownerFirstName ? `, ${ownerFirstName}` : ""}`
      : heading.title;
  const subtitle = heading.subtitle.replace("{clinic}", clinic.name);

  return (
    <div className="h-screen flex bg-sand overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onSelect={(key) => {
          setActiveTab(key);
          setSidebarOpen(false);
        }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        clinicName={clinic.name}
        clinicType={clinic.clinic_type}
      />

      <div className="flex-1 min-w-0 h-screen flex flex-col">
        <header className="shrink-0 bg-sand/90 backdrop-blur border-b border-line">
          <div className="px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="lg:hidden w-9 h-9 rounded-lg border border-line bg-white flex items-center justify-center text-lg shrink-0"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                ☰
              </button>
              <div className="min-w-0">
                <p className="font-display text-xl sm:text-2xl font-semibold text-ink truncate">
                  {greeting}
                </p>
                <p className="text-sm text-ink/50 mt-0.5 truncate">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <NoteForOwner clinicId={clinic.id} />
              <button className="btn-ghost text-sm hidden sm:inline-flex" onClick={handleLogout}>
                Log out
              </button>
              <div
                className="w-9 h-9 rounded-full bg-teal/15 text-teal font-display font-semibold text-sm flex items-center justify-center shrink-0"
                title={clinic.owner_name ?? clinic.name}
              >
                {(clinic.owner_name || clinic.name).trim().slice(0, 1).toUpperCase()}
              </div>
              <button className="btn-ghost text-sm sm:hidden" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 px-4 sm:px-8 py-5 max-w-6xl w-full overflow-y-auto">
          <div className="lg:h-full">
            {activeTab === "overview" && <OverviewTab clinicId={clinic.id} />}
            {activeTab === "patients" && <PatientsTab clinicId={clinic.id} clinicName={clinic.name} />}
            {activeTab === "appointments" && (
              <AppointmentsTab clinicId={clinic.id} />
            )}
            {activeTab === "billing" && <BillingTab clinicId={clinic.id} />}
            {activeTab === "inventory" && <InventoryTab clinicId={clinic.id} />}
          </div>
        </main>
      </div>

      {/* Floating owner quick-view — visible on every tab */}
      <OwnerQuickView clinicId={clinic.id} />
    </div>
  );
}
