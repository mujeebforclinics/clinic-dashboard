"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/format";
import Modal from "@/components/Modal";
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
  topTreatmentsWeek: { treatment: string; revenue: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "#1D7874",
  Completed: "#6D5DD3",
  Cancelled: "#B5563C",
  "No-show": "#D97706",
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

type TileKey =
  | "appointments"
  | "revenueTrend"
  | "weeklyAppts"
  | "paymentMethods"
  | "byDoctor"
  | "treatments"
  | "localities"
  | "lowStock";

function Tile({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-3 text-left shadow-md hover:opacity-90 transition text-white ${accent}`}
    >
      <p className="text-[11px] opacity-80 leading-tight">{label}</p>
      <p className="font-display text-xl font-semibold leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>}
    </button>
  );
}

export default function OwnerQuickView({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);
  const [modalDoctorId, setModalDoctorId] = useState<string | null>(null);
  const [modalDay, setModalDay] = useState<string | null>(null);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

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
      supabase.from("appointments").select("status").eq("clinic_id", clinicId).eq("appointment_date", today),
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", today),
      supabase.from("inventory_items").select("id, item_name, reorder_level, inventory_batches(quantity)").eq("clinic_id", clinicId),
      supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId).in("status", ["unpaid", "partial"]),
      supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId).limit(3000),
      supabase.from("payments").select("amount, paid_at").eq("clinic_id", clinicId).gte("paid_at", sevenDaysAgoStr),
      supabase.from("appointments").select("appointment_date").eq("clinic_id", clinicId).gte("appointment_date", sevenDaysAgoStr),
      supabase.from("staff_notes").select("id, message, urgency, created_at").eq("clinic_id", clinicId).eq("is_read", false).order("created_at", { ascending: false }),
      supabase.from("patients").select("locality").eq("clinic_id", clinicId).not("locality", "is", null).limit(3000),
      supabase.from("payments").select("amount, payment_method").eq("clinic_id", clinicId).gte("paid_at", thirtyDaysAgoStr),
      supabase.from("doctors").select("id, name, specialty").eq("clinic_id", clinicId),
      supabase.from("invoices").select("doctor_id, total_amount, payments(amount)").eq("clinic_id", clinicId).limit(3000),
      supabase.from("appointments").select("doctor_id, lab_name, doctors(name)").eq("clinic_id", clinicId).eq("referred_to_lab", true).not("lab_name", "is", null),
      supabase.from("invoices").select("treatment, payments(amount, paid_at)").eq("clinic_id", clinicId).not("treatment", "is", null).limit(3000),
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
      .filter((i: any) => i.qty <= i.reorder_level);

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
      const doctorName = r.doctors?.name ?? "Unassigned";
      const lab = r.lab_name ?? "Unknown lab";
      const key = `${doctorName}|${lab}`;
      if (!labCounts[key]) labCounts[key] = { doctor: doctorName, lab, count: 0 };
      labCounts[key].count++;
    });
    const labReferrals = Object.values(labCounts).sort((a, b) => b.count - a.count);

    const treatmentWeek: Record<string, number> = {};
    (treatmentRows ?? []).forEach((inv: any) => {
      const name = inv.treatment;
      if (!name) return;
      (inv.payments ?? []).forEach((p: any) => {
        const payDay = p.paid_at.slice(0, 10);
        if (payDay >= sevenDaysAgoStr) {
          treatmentWeek[name] = (treatmentWeek[name] ?? 0) + Number(p.amount);
        }
      });
    });
    const topTreatmentsWeek = Object.entries(treatmentWeek)
      .map(([treatment, revenue]) => ({ treatment, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const apptTotalForRate = counts.completed + counts.cancelled + counts.noShow + counts.scheduled;
    const apptCompletionPct = apptTotalForRate > 0 ? (counts.completed / apptTotalForRate) * 100 : 100;
    const noShowPct = apptTotalForRate > 0 ? (counts.noShow / apptTotalForRate) * 100 : 0;
    const noShowHealthPct = Math.max(0, 100 - noShowPct * 3);
    const stockHealthPct = Math.max(0, 100 - lowStockItems.length * 15);
    const healthScore = Math.round(
      collectionRatePct * 0.35 + apptCompletionPct * 0.25 + noShowHealthPct * 0.2 + stockHealthPct * 0.2
    );
    const healthLabel = healthScore >= 85 ? "Excellent" : healthScore >= 70 ? "Healthy" : healthScore >= 50 ? "Needs attention" : "Critical";

    const alerts: { text: string; severity: "critical" | "attention" | "monitor" | "healthy" }[] = [];
    if (pendingDuesTotal > 20000) alerts.push({ text: `${formatCurrency(pendingDuesTotal)} outstanding`, severity: "critical" });
    else if (pendingDuesTotal > 5000) alerts.push({ text: `${formatCurrency(pendingDuesTotal)} outstanding`, severity: "attention" });
    if (lowStockItems.length >= 3) alerts.push({ text: `${lowStockItems.length} items critically low`, severity: "critical" });
    else if (lowStockItems.length > 0) alerts.push({ text: `${lowStockItems.length} item(s) low on stock`, severity: "attention" });
    if (counts.noShow >= 3) alerts.push({ text: `${counts.noShow} no-shows today`, severity: "attention" });
    if (collectionRatePct < 50 && totalBilled > 0) alerts.push({ text: `Collection rate is low (${collectionRatePct.toFixed(0)}%)`, severity: "critical" });
    if (alerts.length === 0) alerts.push({ text: "Everything looks healthy", severity: "healthy" });

    setNotes((unreadNotes as any) ?? []);
    setData({
      totalAppts: (appts ?? []).length,
      scheduled: counts.scheduled,
      completed: counts.completed,
      cancelled: counts.cancelled,
      noShow: counts.noShow,
      revenue,
      lowStockItems: lowStockItems.slice(0, 8),
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
  }, [open, clinicId]);

  const pieData = data
    ? [
        { name: "Scheduled", value: data.scheduled },
        { name: "Completed", value: data.completed },
        { name: "Cancelled", value: data.cancelled },
        { name: "No-show", value: data.noShow },
      ].filter((d) => d.value > 0)
    : [];

  const closeModal = () => {
    setActiveTile(null);
    setModalDoctorId(null);
    setModalDay(null);
  };

  const filteredLabReferrals = data?.labReferrals.filter(
    (r) => !modalDoctorId || r.doctor === data.byDoctor.find((d) => d.id === modalDoctorId)?.name
  ) ?? [];

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
        className={`fixed top-0 left-0 right-0 z-50 bg-sand shadow-2xl transition-transform duration-300 ease-out max-h-[92vh] overflow-y-auto rounded-b-2xl ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="p-4 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Today's Snapshot</h2>
            <button onClick={() => setOpen(false)} className="text-ink/50 hover:text-ink text-2xl leading-none" aria-label="Close">
              ×
            </button>
          </div>

          {!data ? (
            <p className="text-sm text-ink/60">Loading…</p>
          ) : (
            <div className="space-y-3">
              {/* Health score + alerts - compact single row */}
              <div className="card p-3 shadow-md flex items-center gap-4">
                <div className="shrink-0 flex flex-col items-center">
                  <svg width="60" height="60" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="#E4DED2" strokeWidth="10" fill="none" />
                    <circle
                      cx="50" cy="50" r="42"
                      stroke={data.healthScore >= 85 ? "#1D7874" : data.healthScore >= 70 ? "#5C7A6E" : data.healthScore >= 50 ? "#D97706" : "#B5563C"}
                      strokeWidth="10" fill="none"
                      strokeDasharray={2 * Math.PI * 42}
                      strokeDashoffset={2 * Math.PI * 42 - (Math.max(0, Math.min(100, data.healthScore)) / 100) * (2 * Math.PI * 42)}
                      strokeLinecap="round" transform="rotate(-90 50 50)"
                    />
                    <text x="50" y="57" textAnchor="middle" fontSize="30" fontWeight="700" fill="#1C2321">{data.healthScore}</text>
                  </svg>
                  <p className="text-[10px] font-medium">{data.healthLabel}</p>
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {data.alerts.map((a, i) => {
                    const style =
                      a.severity === "critical" ? "bg-clay/10 text-clay" :
                      a.severity === "attention" ? "bg-amber-100 text-amber-800" :
                      a.severity === "monitor" ? "bg-violet/10 text-violet" : "bg-teal/10 text-teal";
                    const dot = a.severity === "critical" ? "🔴" : a.severity === "attention" ? "🟠" : a.severity === "monitor" ? "🟡" : "🟢";
                    return (
                      <span key={i} className={`text-[11px] rounded-full px-2 py-1 ${style}`}>{dot} {a.text}</span>
                    );
                  })}
                </div>
              </div>

              {notes.length > 0 && (
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {notes.map((n) => (
                    <div key={n.id} className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 ${n.urgency === "urgent" ? "bg-clay/10 border border-clay/30" : "bg-teal/10 border border-teal/30"}`}>
                      <p className="text-xs"><span className={`font-semibold uppercase mr-1 ${n.urgency === "urgent" ? "text-clay" : "text-teal"}`}>{n.urgency === "urgent" ? "Urgent" : "Note"}</span>{n.message}</p>
                      <button onClick={() => dismissNote(n.id)} className="text-[10px] text-ink/50 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Revenue + Pending - bold, always visible */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3 bg-teal text-white shadow-md">
                  <p className="text-[11px] opacity-80">Revenue today</p>
                  <p className="font-display text-xl font-semibold">{formatCurrency(data.revenue)}</p>
                </div>
                <div className={`rounded-xl p-3 text-white shadow-md ${data.pendingDuesTotal > 0 ? "bg-clay" : "bg-sage"}`}>
                  <p className="text-[11px] opacity-80">Pending dues</p>
                  <p className="font-display text-xl font-semibold">{formatCurrency(data.pendingDuesTotal)}</p>
                </div>
              </div>

              {/* Tap-to-popup tile grid - no scrolling needed */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Tile label="Appointments today" value={String(data.totalAppts)} accent="bg-teal" onClick={() => setActiveTile("appointments")} />
                <Tile label="Revenue, 7 days" value={formatCurrency(data.revenueTrend.reduce((s, d) => s + d.amount, 0))} accent="bg-violet" onClick={() => setActiveTile("revenueTrend")} />
                <Tile label="Appts this week" value={String(data.weeklyAppointments.reduce((s, d) => s + d.count, 0))} accent="bg-rose" onClick={() => setActiveTile("weeklyAppts")} />
                <Tile label="Payment methods" value={`${data.paymentMethods.length} types`} accent="bg-amber-600" onClick={() => setActiveTile("paymentMethods")} />
                <Tile label="Business by doctor" value={`${data.byDoctor.length} doctors`} sub={data.byDoctor[0]?.name} accent="bg-sage" onClick={() => setActiveTile("byDoctor")} />
                <Tile label="Top treatments" value={data.topTreatmentsWeek[0]?.treatment ?? "-"} sub="tap for full list" accent="bg-teal" onClick={() => setActiveTile("treatments")} />
                <Tile label="Patient localities" value={`${data.topLocalities.length} areas`} accent="bg-violet" onClick={() => setActiveTile("localities")} />
                <Tile label="Low stock" value={String(data.lowStockItems.length)} accent={data.lowStockItems.length > 0 ? "bg-clay" : "bg-sage"} onClick={() => setActiveTile("lowStock")} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Per-tile popups ===== */}

      <Modal open={activeTile === "appointments"} onClose={closeModal} title="Appointments today">
        {data && (
          <>
            {pieData.length === 0 ? (
              <p className="text-sm text-ink/40 py-6 text-center">No appointments today yet</p>
            ) : (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {pieData.map((entry) => (<Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              {pieData.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: STATUS_COLORS[d.name] }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal open={activeTile === "revenueTrend"} onClose={closeModal} title="Revenue, last 7 days">
        {data && (
          <>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={data.revenueTrend} onClick={(e: any) => {
                  const point = e?.activePayload?.[0]?.payload;
                  if (point) setModalDay(point.date === modalDay ? null : point.date);
                }}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="amount" stroke="#1D7874" strokeWidth={2.5} dot={{ r: 4, cursor: "pointer" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {modalDay && (
              <div className="mt-3 bg-teal/10 border border-teal/30 rounded-lg p-3 text-center">
                <p className="text-xs text-ink/60">{new Date(modalDay).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
                <p className="font-display text-lg font-semibold text-teal">
                  {formatCurrency(data.revenueTrend.find((d) => d.date === modalDay)?.amount ?? 0)}
                </p>
              </div>
            )}
            <p className="text-xs text-ink/40 mt-2">Tap a point on the line to see that day's revenue.</p>
          </>
        )}
      </Modal>

      <Modal open={activeTile === "weeklyAppts"} onClose={closeModal} title="Appointments this week">
        {data && (
          <>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={data.weeklyAppointments}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry: any) => setModalDay(entry.date === modalDay ? null : entry.date)}>
                    {data.weeklyAppointments.map((entry) => (
                      <Cell key={entry.date} fill={entry.date === modalDay ? "#D6537A" : "#6D5DD3"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {modalDay && (
              <div className="mt-3 bg-violet/10 border border-violet/30 rounded-lg p-3 text-center">
                <p className="text-xs text-ink/60">{new Date(modalDay).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
                <p className="font-display text-lg font-semibold text-violet">
                  {data.weeklyAppointments.find((d) => d.date === modalDay)?.count ?? 0} appointments
                </p>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal open={activeTile === "paymentMethods"} onClose={closeModal} title="Payment methods (30 days)">
        {data && (
          <>
            {data.paymentMethods.length === 0 ? (
              <p className="text-sm text-ink/40 py-6 text-center">No payments yet</p>
            ) : (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.paymentMethods} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {data.paymentMethods.map((entry) => (<Cell key={entry.name} fill={METHOD_COLORS[entry.name]} />))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              {data.paymentMethods.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: METHOD_COLORS[d.name] }} />
                  {d.name}: {formatCurrency(d.value)}
                </span>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal open={activeTile === "byDoctor"} onClose={closeModal} title="Business by doctor">
        {data && (
          <div className="space-y-4">
            <div className="space-y-2">
              {data.byDoctor.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => setModalDoctorId(modalDoctorId === d.id ? null : d.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    modalDoctorId === d.id ? "bg-violet/15 border border-violet" : "bg-sand hover:bg-violet/5"
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: DOCTOR_COLORS[i % DOCTOR_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-violet">{d.specialty}</p>
                  </div>
                  <p className="font-display text-sm font-semibold whitespace-nowrap">{formatCurrency(d.revenue)}</p>
                </button>
              ))}
            </div>

            <div>
              <p className="text-sm font-semibold text-ink/70 mb-2">
                Lab referrals {modalDoctorId && `— ${data.byDoctor.find((d) => d.id === modalDoctorId)?.name}`}
              </p>
              {filteredLabReferrals.length === 0 ? (
                <p className="text-sm text-ink/40">No lab referrals yet</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredLabReferrals.map((r) => (
                    <div key={`${r.doctor}-${r.lab}`} className="flex items-center justify-between text-sm bg-rose/5 border border-rose/20 rounded-lg px-3 py-2">
                      <span><span className="text-violet font-medium">{r.doctor}</span> → {r.lab}</span>
                      <span className="font-semibold text-rose">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={activeTile === "treatments"} onClose={closeModal} title="Top treatments (7 days)">
        {data && (
          <>
            {data.topTreatmentsWeek.length === 0 ? (
              <p className="text-sm text-ink/40 py-6 text-center">No treatment data yet</p>
            ) : (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={data.topTreatmentsWeek} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="treatment" type="category" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {data.topTreatmentsWeek.map((entry, i) => (<Cell key={entry.treatment} fill={DOCTOR_COLORS[i % DOCTOR_COLORS.length]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal open={activeTile === "localities"} onClose={closeModal} title="Where patients come from">
        {data && (
          <>
            {data.topLocalities.length === 0 ? (
              <p className="text-sm text-ink/40 py-4 text-center">No locality data yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.topLocalities.map((loc, i) => {
                  const c = PIN_COLORS[i % PIN_COLORS.length];
                  return (
                    <div key={loc.locality} className={`rounded-xl p-3 ${c.bg} ${c.text}`}>
                      <p className="font-display text-2xl font-semibold">{loc.count}</p>
                      <p className="text-xs opacity-90 truncate">{loc.locality}</p>
                      <p className="text-[10px] opacity-70">patients</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal open={activeTile === "lowStock"} onClose={closeModal} title="Low stock items">
        {data && (
          <>
            {data.lowStockItems.length === 0 ? (
              <p className="text-sm text-ink/40 py-4">All stocked up 👍</p>
            ) : (
              <ul className="space-y-2">
                {data.lowStockItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm bg-clay/10 text-clay rounded-lg px-3 py-2.5">
                    <span>{item.item_name}</span>
                    <span className="font-medium">{item.qty}/{item.reorder_level}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
