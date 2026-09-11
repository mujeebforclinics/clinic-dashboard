"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/format";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

type StaffNote = { id: string; message: string; urgency: "normal" | "urgent"; created_at: string };

type Snapshot = {
  periodLabel: string;
  totalAppts: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  revenue: number;
  lowStockItems: { id: string; item_name: string; qty: number; reorder_level: number }[];
  pendingDuesTotal: number;
  revenueTrend: { day: string; date: string; amount: number }[];
  weeklyAppointments: { day: string; date: string; count: number }[];
  topLocalities: { locality: string; count: number }[];
  paymentMethods: { name: string; value: number }[];
  collectionRatePct: number;
  byDoctor: { id: string; name: string; specialty: string; revenue: number }[];
  labReferrals: { doctor: string; lab: string; count: number }[];
  healthScore: number;
  healthLabel: string;
  alerts: { text: string; severity: "critical" | "attention" | "monitor" | "healthy" }[];
  topTreatmentsToday: { treatment: string; revenue: number }[];
  topTreatmentsWeek: { treatment: string; revenue: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "#1D7874",
  Completed: "#1C2321",
  Cancelled: "#B5563C",
  "No-show": "#D8B4A0",
};
const METHOD_COLORS: Record<string, string> = { Cash: "#1D7874", UPI: "#6D5DD3", Card: "#D6537A" };
const PIN_COLORS = [
  { bg: "bg-teal", text: "text-white" },
  { bg: "bg-violet", text: "text-white" },
  { bg: "bg-rose", text: "text-white" },
  { bg: "bg-amber-600", text: "text-white" },
  { bg: "bg-sage", text: "text-white" },
];
const DOCTOR_COLORS = ["#1D7874", "#6D5DD3", "#D6537A", "#D97706", "#5C7A6E", "#B5563C"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ProgressRing({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 70 ? "#1D7874" : clamped >= 40 ? "#D97706" : "#B5563C";
  return (
    <div className="flex items-center gap-3">
      <svg width="92" height="92" viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={radius} stroke="#E4DED2" strokeWidth="10" fill="none" />
        <circle cx="50" cy="50" r={radius} stroke={color} strokeWidth="10" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 50 50)" />
        <text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="700" fill="#1C2321">{clamped.toFixed(0)}%</text>
      </svg>
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-ink/60">{sub}</p>
      </div>
    </div>
  );
}

export default function OwnerQuickView({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const activeDate = selectedDate ?? today;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

    let apptQ = supabase.from("appointments").select("status").eq("clinic_id", clinicId).eq("appointment_date", activeDate);
    let payQ = supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", activeDate).lt("paid_at", activeDate + "T23:59:59");
    let invQ = supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId).in("status", ["unpaid", "partial"]);
    let trendQ = supabase.from("payments").select("amount, paid_at").eq("clinic_id", clinicId).gte("paid_at", sevenDaysAgoStr);
    let weekQ = supabase.from("appointments").select("appointment_date").eq("clinic_id", clinicId).gte("appointment_date", sevenDaysAgoStr);
    let methodQ = supabase.from("payments").select("amount, payment_method").eq("clinic_id", clinicId).gte("paid_at", thirtyDaysAgoStr);
    let allInvQ = supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId).limit(3000);
    let treatmentQ = supabase.from("invoices").select("treatment, payments(amount, paid_at)").eq("clinic_id", clinicId).not("treatment", "is", null).limit(3000);

    if (selectedDoctorId) {
      apptQ = apptQ.eq("doctor_id", selectedDoctorId);
      payQ = payQ.eq("doctor_id", selectedDoctorId);
      invQ = invQ.eq("doctor_id", selectedDoctorId);
      trendQ = trendQ.eq("doctor_id", selectedDoctorId);
      weekQ = weekQ.eq("doctor_id", selectedDoctorId);
      methodQ = methodQ.eq("doctor_id", selectedDoctorId);
      allInvQ = allInvQ.eq("doctor_id", selectedDoctorId);
      treatmentQ = treatmentQ.eq("doctor_id", selectedDoctorId);
    }

    const [
      { data: appts },
      { data: payments },
      { data: items },
      { data: invoices },
      { data: allInvoices },
      { data: trendPayments },
      { data: weekAppts },
      { data: unreadNotes },
      { data: localityRows },
      { data: methodRows },
      { data: doctorRows },
      { data: doctorInvoices },
      { data: labReferralRows },
      { data: treatmentRows },
    ] = await Promise.all([
      apptQ,
      payQ,
      supabase.from("inventory_items").select("id, item_name, reorder_level, inventory_batches(quantity)").eq("clinic_id", clinicId),
      invQ,
      allInvQ,
      trendQ,
      weekQ,
      supabase.from("staff_notes").select("id, message, urgency, created_at").eq("clinic_id", clinicId).eq("is_read", false).order("created_at", { ascending: false }),
      supabase.from("patients").select("locality").eq("clinic_id", clinicId).not("locality", "is", null).limit(3000),
      methodQ,
      supabase.from("doctors").select("id, name, specialty").eq("clinic_id", clinicId),
      supabase.from("invoices").select("doctor_id, total_amount, payments(amount)").eq("clinic_id", clinicId).limit(3000),
      supabase.from("appointments").select("doctor_id, lab_name, doctors(name)").eq("clinic_id", clinicId).eq("referred_to_lab", true).not("lab_name", "is", null),
      treatmentQ,
    ]);

    const counts = { scheduled: 0, completed: 0, cancelled: 0, noShow: 0 };
    (appts ?? []).forEach((a: any) => {
      if (a.status === "scheduled") counts.scheduled++;
      else if (a.status === "completed") counts.completed++;
      else if (a.status === "cancelled") counts.cancelled++;
      else if (a.status === "no_show") counts.noShow++;
    });

    const revenue = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);

    const lowStockItems = (items ?? [])
      .map((item: any) => {
        const qty = (item.inventory_batches ?? []).reduce((s: number, b: any) => s + (b.quantity ?? 0), 0);
        return { id: item.id, item_name: item.item_name, qty, reorder_level: item.reorder_level ?? 0 };
      })
      .filter((i: any) => i.qty <= i.reorder_level)
      .slice(0, 5);

    const pendingDuesTotal = (invoices ?? []).reduce((sum: number, inv: any) => {
      const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      return sum + (Number(inv.total_amount) - paid);
    }, 0);

    let totalBilled = 0;
    let totalCollected = 0;
    (allInvoices ?? []).forEach((inv: any) => {
      totalBilled += Number(inv.total_amount);
      totalCollected += (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    });
    const collectionRatePct = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    const revenueByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      revenueByDay[d.toISOString().slice(0, 10)] = 0;
    }
    (trendPayments ?? []).forEach((p: any) => {
      const day = p.paid_at.slice(0, 10);
      if (day in revenueByDay) revenueByDay[day] += Number(p.amount);
    });
    const revenueTrend = Object.entries(revenueByDay).map(([date, amount]) => ({
      day: DAY_LABELS[new Date(date).getDay()],
      date,
      amount,
    }));

    const apptsByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      apptsByDay[d.toISOString().slice(0, 10)] = 0;
    }
    (weekAppts ?? []).forEach((a: any) => {
      if (a.appointment_date in apptsByDay) apptsByDay[a.appointment_date]++;
    });
    const weeklyAppointments = Object.entries(apptsByDay).map(([date, count]) => ({
      day: DAY_LABELS[new Date(date).getDay()],
      date,
      count,
    }));

    const localityCounts: Record<string, number> = {};
    (localityRows ?? []).forEach((r: any) => {
      const loc = (r.locality ?? "").trim();
      if (!loc) return;
      localityCounts[loc] = (localityCounts[loc] ?? 0) + 1;
    });
    const topLocalities = Object.entries(localityCounts)
      .map(([locality, count]) => ({ locality, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const methodTotals: Record<string, number> = { Cash: 0, UPI: 0, Card: 0 };
    (methodRows ?? []).forEach((p: any) => {
      const label = p.payment_method === "upi" ? "UPI" : p.payment_method === "card" ? "Card" : "Cash";
      methodTotals[label] += Number(p.amount);
    });
    const paymentMethods = Object.entries(methodTotals).map(([name, value]) => ({ name, value })).filter((m) => m.value > 0);

    const doctorRevenue: Record<string, number> = {};
    (doctorInvoices ?? []).forEach((inv: any) => {
      if (!inv.doctor_id) return;
      const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      doctorRevenue[inv.doctor_id] = (doctorRevenue[inv.doctor_id] ?? 0) + paid;
    });
    const byDoctor = (doctorRows ?? [])
      .map((d: any) => ({ id: d.id, name: d.name, specialty: d.specialty ?? "General", revenue: doctorRevenue[d.id] ?? 0 }))
      .sort((a: any, b: any) => b.revenue - a.revenue);

    const labCounts: Record<string, { doctor: string; lab: string; count: number }> = {};
    (labReferralRows ?? []).forEach((r: any) => {
      if (selectedDoctorId && r.doctor_id !== selectedDoctorId) return;
      const doctorName = r.doctors?.name ?? "Unassigned";
      const lab = r.lab_name ?? "Unknown lab";
      const key = `${doctorName}|${lab}`;
      if (!labCounts[key]) labCounts[key] = { doctor: doctorName, lab, count: 0 };
      labCounts[key].count++;
    });
    const labReferrals = Object.values(labCounts).sort((a, b) => b.count - a.count).slice(0, 6);

    // Revenue by treatment — today and last 7 days, from payments joined to invoices
    const treatmentToday: Record<string, number> = {};
    const treatmentWeek: Record<string, number> = {};
    (treatmentRows ?? []).forEach((inv: any) => {
      const name = inv.treatment;
      if (!name) return;
      (inv.payments ?? []).forEach((p: any) => {
        const payDay = p.paid_at.slice(0, 10);
        if (payDay === activeDate) {
          treatmentToday[name] = (treatmentToday[name] ?? 0) + Number(p.amount);
        }
        if (payDay >= sevenDaysAgoStr) {
          treatmentWeek[name] = (treatmentWeek[name] ?? 0) + Number(p.amount);
        }
      });
    });
    const topTreatmentsToday = Object.entries(treatmentToday)
      .map(([treatment, revenue]) => ({ treatment, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const topTreatmentsWeek = Object.entries(treatmentWeek)
      .map(([treatment, revenue]) => ({ treatment, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Clinic Health Score — composite of collection rate, appointment
    // completion, no-shows, and stock health. All from data already fetched.
    const apptTotalForRate = counts.completed + counts.cancelled + counts.noShow + counts.scheduled;
    const apptCompletionPct = apptTotalForRate > 0
      ? (counts.completed / apptTotalForRate) * 100
      : 100;
    const noShowPct = apptTotalForRate > 0 ? (counts.noShow / apptTotalForRate) * 100 : 0;
    const noShowHealthPct = Math.max(0, 100 - noShowPct * 3);
    const stockHealthPct = Math.max(0, 100 - lowStockItems.length * 15);
    const healthScore = Math.round(
      collectionRatePct * 0.35 + apptCompletionPct * 0.25 + noShowHealthPct * 0.2 + stockHealthPct * 0.2
    );
    const healthLabel = healthScore >= 85 ? "Excellent" : healthScore >= 70 ? "Healthy" : healthScore >= 50 ? "Needs attention" : "Critical";

    const alerts: { text: string; severity: "critical" | "attention" | "monitor" | "healthy" }[] = [];
    if (pendingDuesTotal > 20000) alerts.push({ text: `${formatCurrency(pendingDuesTotal)} outstanding across patients`, severity: "critical" });
    else if (pendingDuesTotal > 5000) alerts.push({ text: `${formatCurrency(pendingDuesTotal)} outstanding across patients`, severity: "attention" });
    if (lowStockItems.length >= 3) alerts.push({ text: `${lowStockItems.length} items critically low on stock`, severity: "critical" });
    else if (lowStockItems.length > 0) alerts.push({ text: `${lowStockItems.length} item${lowStockItems.length > 1 ? "s" : ""} running low on stock`, severity: "attention" });
    if (counts.noShow >= 3) alerts.push({ text: `${counts.noShow} no-shows, higher than usual`, severity: "attention" });
    if (counts.cancelled >= 3) alerts.push({ text: `${counts.cancelled} cancelled appointments`, severity: "monitor" });
    if (collectionRatePct < 50 && totalBilled > 0) alerts.push({ text: `Collection rate is low (${collectionRatePct.toFixed(0)}%)`, severity: "critical" });
    if (alerts.length === 0) alerts.push({ text: "Everything looks healthy, no issues detected", severity: "healthy" });

    const periodLabel =
      activeDate === today
        ? "Today"
        : new Date(activeDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

    setNotes((unreadNotes as any) ?? []);
    setData({
      periodLabel,
      totalAppts: (appts ?? []).length,
      scheduled: counts.scheduled,
      completed: counts.completed,
      cancelled: counts.cancelled,
      noShow: counts.noShow,
      revenue,
      lowStockItems,
      pendingDuesTotal,
      revenueTrend,
      weeklyAppointments,
      topLocalities,
      paymentMethods,
      collectionRatePct,
      byDoctor,
      labReferrals,
      healthScore,
      healthLabel,
      alerts,
      topTreatmentsToday,
      topTreatmentsWeek,
    });
  };

  const dismissNote = async (id: string) => {
    await supabase.from("staff_notes").update({ is_read: true }).eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  useEffect(() => {
    if (!open) return;
    load();
    const channel = supabase
      .channel("owner-quick-view")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_batches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_notes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clinicId, selectedDoctorId, selectedDate]);

  const pieData = data
    ? [
        { name: "Scheduled", value: data.scheduled },
        { name: "Completed", value: data.completed },
        { name: "Cancelled", value: data.cancelled },
        { name: "No-show", value: data.noShow },
      ].filter((d) => d.value > 0)
    : [];

  const selectedDoctorName = data?.byDoctor.find((d) => d.id === selectedDoctorId)?.name;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Owner quick view"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full bg-teal text-white shadow-xl flex items-center justify-center hover:opacity-90 transition"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 14l3-3 3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {notes.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-clay text-white text-[10px] font-bold flex items-center justify-center">
            {notes.length}
          </span>
        )}
      </button>

      {open && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />}

      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-sand shadow-2xl transition-transform duration-300 ease-out max-h-[94vh] overflow-y-auto rounded-b-2xl ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold">
                {data?.periodLabel ?? "Today"}'s Snapshot
                {selectedDoctorName && <span className="text-violet"> · {selectedDoctorName}</span>}
              </h2>
              {(selectedDoctorId || selectedDate) && (
                <button
                  onClick={() => {
                    setSelectedDoctorId(null);
                    setSelectedDate(null);
                  }}
                  className="text-xs text-teal underline underline-offset-2 mt-0.5"
                >
                  Clear filters (show everything)
                </button>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-ink/50 hover:text-ink text-2xl leading-none" aria-label="Close">
              ×
            </button>
          </div>

          {!data ? (
            <p className="text-sm text-ink/60">Loading…</p>
          ) : (
            <div className="space-y-4">
              {/* Clinic Health Score + Attention Required — full width, most important glance info */}
              <div className="card p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="shrink-0 flex flex-col items-center">
                    <svg width="120" height="120" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" stroke="#E4DED2" strokeWidth="10" fill="none" />
                      <circle
                        cx="50" cy="50" r="42"
                        stroke={data.healthScore >= 85 ? "#1D7874" : data.healthScore >= 70 ? "#5C7A6E" : data.healthScore >= 50 ? "#D97706" : "#B5563C"}
                        strokeWidth="10" fill="none"
                        strokeDasharray={2 * Math.PI * 42}
                        strokeDashoffset={2 * Math.PI * 42 - (Math.max(0, Math.min(100, data.healthScore)) / 100) * (2 * Math.PI * 42)}
                        strokeLinecap="round" transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="48" textAnchor="middle" fontSize="26" fontWeight="700" fill="#1C2321">{data.healthScore}</text>
                      <text x="50" y="65" textAnchor="middle" fontSize="9" fill="#6b6156">/ 100</text>
                    </svg>
                    <p className="text-sm font-semibold mt-1">Clinic Health Score</p>
                    <p className={`text-xs font-medium ${data.healthScore >= 70 ? "text-teal" : data.healthScore >= 50 ? "text-amber-700" : "text-clay"}`}>
                      {data.healthLabel}
                    </p>
                  </div>
                  <div className="flex-1 w-full">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 mb-2">Attention Required</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {data.alerts.map((a, i) => {
                        const style =
                          a.severity === "critical" ? "bg-clay/10 border-clay/30 text-clay" :
                          a.severity === "attention" ? "bg-amber-100 border-amber-300 text-amber-800" :
                          a.severity === "monitor" ? "bg-violet/10 border-violet/30 text-violet" :
                          "bg-teal/10 border-teal/30 text-teal";
                        const dot =
                          a.severity === "critical" ? "🔴" :
                          a.severity === "attention" ? "🟠" :
                          a.severity === "monitor" ? "🟡" : "🟢";
                        return (
                          <div key={i} className={`text-sm rounded-lg px-3 py-2 border ${style}`}>
                            {dot} {a.text}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-4">
                {notes.length > 0 && (
                  <div className="card p-4 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 mb-1.5">Notes ({notes.length})</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {notes.map((n) => (
                        <div key={n.id} className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 ${n.urgency === "urgent" ? "bg-clay/10 border border-clay/30" : "bg-teal/10 border border-teal/30"}`}>
                          <div>
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${n.urgency === "urgent" ? "text-clay" : "text-teal"}`}>
                              {n.urgency === "urgent" ? "Urgent" : "Note"}
                            </span>
                            <p className="text-xs mt-0.5">{n.message}</p>
                          </div>
                          <button onClick={() => dismissNote(n.id)} className="text-[10px] text-ink/50 hover:text-ink whitespace-nowrap">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl p-4 bg-teal text-white shadow-lg">
                  <p className="text-xs opacity-80">Revenue · {data.periodLabel}</p>
                  <p className="font-display text-3xl font-semibold mt-1">{formatCurrency(data.revenue)}</p>
                </div>
                <div className={`rounded-xl p-4 text-white shadow-lg ${data.pendingDuesTotal > 0 ? "bg-clay" : "bg-sage"}`}>
                  <p className="text-xs opacity-80">Pending dues</p>
                  <p className="font-display text-2xl font-semibold mt-1">{formatCurrency(data.pendingDuesTotal)}</p>
                </div>
                <div className="card p-4 shadow-lg">
                  <ProgressRing pct={data.collectionRatePct} label="Collection rate" sub="of billed amount collected" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl px-3 py-3 bg-violet text-white text-center shadow-lg">
                    <p className="font-display text-xl font-semibold">{data.totalAppts}</p>
                    <p className="text-[10px] opacity-80">appts</p>
                  </div>
                  <div className="rounded-xl px-3 py-3 bg-rose text-white text-center shadow-lg">
                    <p className="font-display text-xl font-semibold">{data.lowStockItems.length}</p>
                    <p className="text-[10px] opacity-80">low stock</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1 space-y-4">
                <div className="card p-4 shadow-lg">
                  <p className="text-sm text-ink/60 mb-2">Appointments · {data.periodLabel} ({data.totalAppts})</p>
                  {pieData.length === 0 ? (
                    <p className="text-sm text-ink/40 py-6 text-center">No appointments</p>
                  ) : (
                    <div style={{ width: "100%", height: 150 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2}>
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="card p-4 shadow-lg">
                  <p className="text-sm text-ink/60 mb-2">Revenue, last 7 days</p>
                  <div style={{ width: "100%", height: 140 }}>
                    <ResponsiveContainer>
                      <LineChart data={data.revenueTrend} onClick={(e: any) => {
                        const point = e?.activePayload?.[0]?.payload;
                        if (point) setSelectedDate(point.date === selectedDate ? null : point.date);
                      }}>
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip />
                        <Line type="monotone" dataKey="amount" stroke="#1D7874" strokeWidth={2} dot={{ r: 3, cursor: "pointer" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-4 shadow-lg">
                  <p className="text-sm text-ink/60 mb-2">Appointments this week (tap a day)</p>
                  <div style={{ width: "100%", height: 140 }}>
                    <ResponsiveContainer>
                      <BarChart data={data.weeklyAppointments}>
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry: any) => setSelectedDate(entry.date === selectedDate ? null : entry.date)}>
                          {data.weeklyAppointments.map((entry) => (
                            <Cell key={entry.date} fill={entry.date === selectedDate ? "#D6537A" : "#6D5DD3"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-4 shadow-lg">
                  <p className="text-sm text-ink/60 mb-2">Payment methods (30 days)</p>
                  {data.paymentMethods.length === 0 ? (
                    <p className="text-sm text-ink/40 py-6 text-center">No payments</p>
                  ) : (
                    <div style={{ width: "100%", height: 140 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={data.paymentMethods} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2}>
                            {data.paymentMethods.map((entry) => (
                              <Cell key={entry.name} fill={METHOD_COLORS[entry.name]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="card p-4 shadow-lg">
                  <p className="text-sm text-ink/60 mb-1">Top treatments by revenue</p>
                  <p className="text-xs text-teal font-medium mb-2">
                    {data.periodLabel}: {data.topTreatmentsToday[0] ? `${data.topTreatmentsToday[0].treatment}: ${formatCurrency(data.topTreatmentsToday[0].revenue)}` : "No sales yet"}
                  </p>
                  {data.topTreatmentsWeek.length === 0 ? (
                    <p className="text-sm text-ink/40 py-4 text-center">No treatment data yet</p>
                  ) : (
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <BarChart data={data.topTreatmentsWeek} layout="vertical" margin={{ left: 10 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="treatment" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                            {data.topTreatmentsWeek.map((entry, i) => (
                              <Cell key={entry.treatment} fill={DOCTOR_COLORS[i % DOCTOR_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <p className="text-[10px] text-ink/40 mt-1">Last 7 days, by revenue collected</p>
                </div>
              </div>

              <div className="lg:col-span-1 space-y-4">
                <div className="card p-4 shadow-lg">
                  <p className="text-sm text-ink/60 mb-3">Business by doctor (tap to filter)</p>
                  <div className="space-y-2">
                    {data.byDoctor.map((d, i) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDoctorId(selectedDoctorId === d.id ? null : d.id)}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                          selectedDoctorId === d.id ? "bg-violet/15 border border-violet" : "bg-sand hover:bg-violet/5"
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DOCTOR_COLORS[i % DOCTOR_COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.name}</p>
                          <p className="text-xs text-violet">{d.specialty}</p>
                        </div>
                        <p className="font-display text-sm font-semibold whitespace-nowrap">{formatCurrency(d.revenue)}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {data.labReferrals.length > 0 && (
                  <div className="card p-4 shadow-lg">
                    <p className="text-sm text-ink/60 mb-3">Lab referrals</p>
                    <div className="space-y-1.5">
                      {data.labReferrals.map((r) => (
                        <div key={`${r.doctor}-${r.lab}`} className="flex items-center justify-between text-xs bg-rose/5 border border-rose/20 rounded-lg px-3 py-2">
                          <span><span className="text-violet font-medium">{r.doctor}</span> → {r.lab}</span>
                          <span className="font-semibold text-rose">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card p-4 shadow-lg">
                  <p className="text-sm text-ink/60 mb-3">Where patients come from</p>
                  {data.topLocalities.length === 0 ? (
                    <p className="text-sm text-ink/40 py-2">No locality data yet</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {data.topLocalities.map((loc, i) => {
                        const c = PIN_COLORS[i % PIN_COLORS.length];
                        return (
                          <div key={loc.locality} className={`rounded-lg p-2.5 ${c.bg} ${c.text}`}>
                            <p className="font-display text-lg font-semibold">{loc.count}</p>
                            <p className="text-[10px] opacity-90 truncate">{loc.locality}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="card p-4 shadow-lg">
                  <p className="text-sm text-ink/60 mb-2">Low stock ({data.lowStockItems.length})</p>
                  {data.lowStockItems.length === 0 ? (
                    <p className="text-sm text-ink/40 py-2">All stocked up 👍</p>
                  ) : (
                    <ul className="space-y-1">
                      {data.lowStockItems.map((item) => (
                        <li key={item.id} className="flex items-center justify-between text-xs bg-clay/10 text-clay rounded-lg px-3 py-2">
                          <span>{item.item_name}</span>
                          <span className="font-medium">{item.qty}/{item.reorder_level}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
