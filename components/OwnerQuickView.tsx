"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/format";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  AreaChart,
  Area,
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
  lowStockCount: number;
};

// Two-color system: teal is the everyday color, clay is reserved for
// anything that needs attention. Chart categories use teal shades so
// everything still reads as one calm, restrained palette.
const TEAL_SHADES = ["#0F4C49", "#1D7874", "#4FA39F", "#8FC4C1"];
const CLAY = "#B5563C";

const STATUS_COLORS: Record<string, string> = {
  Scheduled: TEAL_SHADES[1],
  Completed: TEAL_SHADES[0],
  Cancelled: CLAY,
  "No-show": "#D08569",
};
const METHOD_COLORS: Record<string, string> = { Cash: TEAL_SHADES[0], UPI: TEAL_SHADES[1], Card: TEAL_SHADES[2] };
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

type Detail =
  | { kind: "doctor"; id: string }
  | { kind: "day"; date: string }
  | { kind: "treatment"; treatment: string }
  | { kind: "locality"; locality: string }
  | { kind: "method"; name: string }
  | { kind: "status"; status: string }
  | null;

const ACCENTS = [
  { bg: "bg-teal/10", text: "text-teal", stroke: "#1D7874" },
  { bg: "bg-violet/10", text: "text-violet", stroke: "#6D5DD3" },
  { bg: "bg-rose/10", text: "text-rose", stroke: "#D6537A" },
  { bg: "bg-amber-100", text: "text-amber-700", stroke: "#D97706" },
];

function Tile({
  icon,
  label,
  value,
  sub,
  alert,
  onClick,
  sparkline,
  wide,
  accentIndex = 0,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  onClick: () => void;
  sparkline?: { x: string; y: number }[];
  wide?: boolean;
  accentIndex?: number;
}) {
  const accent = alert ? { bg: "bg-clay/10", text: "text-clay", stroke: "#B5563C" } : ACCENTS[accentIndex % ACCENTS.length];
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left hover:shadow-lg transition flex flex-col justify-between min-h-[140px] ${wide ? "col-span-2" : ""}`}
    >
      <div className="flex items-start justify-between">
        <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${accent.bg}`}>
          {icon}
        </span>
        {alert && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-clay/10 text-clay">
            attention
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs text-ink/50">{label}</p>
        <p className="font-display text-2xl md:text-3xl font-semibold text-ink leading-tight mt-0.5">{value}</p>
        {sub && <p className={`text-xs mt-1 truncate ${accent.text}`}>{sub}</p>}
      </div>
      {sparkline && sparkline.length > 1 && (
        <div style={{ width: "100%", height: 32 }} className="mt-2">
          <ResponsiveContainer>
            <AreaChart data={sparkline}>
              <Area type="monotone" dataKey="y" stroke={accent.stroke} strokeWidth={2} fill={accent.stroke} fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </button>
  );
}

export default function OwnerQuickView({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);
  const [detail, setDetail] = useState<Detail>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailExtra, setDetailExtra] = useState<any>(null);

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
      supabase.from("payments").select("amount, paid_at, invoices!inner(treatment)").eq("clinic_id", clinicId).gte("paid_at", sevenDaysAgoStr).not("invoices.treatment", "is", null),
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
    (treatmentRows ?? []).forEach((p: any) => {
      const name = p.invoices?.treatment;
      if (!name) return;
      treatmentWeek[name] = (treatmentWeek[name] ?? 0) + Number(p.amount);
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
      lowStockItems: lowStockItems.slice(0, 10),
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
      lowStockCount: lowStockItems.length,
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

  const goToDetail = async (d: Detail) => {
    setActiveTile(null);
    setDetail(d);
    setDetailExtra(null);
    if (!d) return;

    if (d.kind === "locality") {
      setDetailLoading(true);
      const { data: rows } = await supabase
        .from("patients")
        .select("full_name, phone")
        .eq("clinic_id", clinicId)
        .eq("locality", d.locality)
        .limit(30);
      setDetailExtra(rows ?? []);
      setDetailLoading(false);
    } else if (d.kind === "status") {
      setDetailLoading(true);
      const statusMap: Record<string, string> = {
        Scheduled: "scheduled", Completed: "completed", Cancelled: "cancelled", "No-show": "no_show",
      };
      const today = new Date().toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from("appointments")
        .select("appointment_time, patients(full_name)")
        .eq("clinic_id", clinicId)
        .eq("appointment_date", today)
        .eq("status", statusMap[d.status])
        .limit(30);
      setDetailExtra(rows ?? []);
      setDetailLoading(false);
    }
  };

  const closeAll = () => {
    setActiveTile(null);
    setDetail(null);
    setDetailExtra(null);
  };

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

      {open && (
        <div className="fixed inset-0 z-50 bg-sand overflow-y-auto">
          <div className="p-4 max-w-5xl mx-auto min-h-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-semibold">Today's Snapshot</h2>
              <button onClick={() => setOpen(false)} className="text-ink/50 hover:text-ink text-2xl leading-none" aria-label="Close">
                ×
              </button>
            </div>

            {!data ? (
              <p className="text-sm text-ink/60"><Spinner size={14} className="mr-1.5" />Loading…</p>
            ) : (
              <div className="space-y-3">
                <div className="card p-5 shadow-md flex items-center gap-5">
                  <div className="shrink-0 flex flex-col items-center">
                    <svg width="88" height="88" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" stroke="#E4DED2" strokeWidth="10" fill="none" />
                      <circle
                        cx="50" cy="50" r="42"
                        stroke={data.healthScore >= 70 ? TEAL_SHADES[1] : CLAY}
                        strokeWidth="10" fill="none"
                        strokeDasharray={2 * Math.PI * 42}
                        strokeDashoffset={2 * Math.PI * 42 - (Math.max(0, Math.min(100, data.healthScore)) / 100) * (2 * Math.PI * 42)}
                        strokeLinecap="round" transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="58" textAnchor="middle" fontSize="32" fontWeight="700" fill="#1C2321">{data.healthScore}</text>
                    </svg>
                    <p className="text-xs font-medium mt-1">{data.healthLabel}</p>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {data.alerts.map((a, i) => {
                      const isGood = a.severity === "healthy";
                      return (
                        <span key={i} className={`text-sm rounded-full px-3 py-1.5 ${isGood ? "bg-teal/10 text-teal" : "bg-clay/10 text-clay"}`}>
                          {isGood ? "🟢" : "🔴"} {a.text}
                        </span>
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="card p-5">
                    <div className="flex items-center justify-between">
                      <span className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-teal/10">💰</span>
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-teal/10 text-teal">today</span>
                    </div>
                    <p className="text-xs text-ink/50 mt-3">Revenue today</p>
                    <p className="font-display text-2xl md:text-3xl font-semibold text-ink mt-1">{formatCurrency(data.revenue)}</p>
                  </div>
                  <div className="card p-5">
                    <div className="flex items-center justify-between">
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${data.pendingDuesTotal > 0 ? "bg-clay/10" : "bg-teal/10"}`}>⏳</span>
                      {data.pendingDuesTotal > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-clay/10 text-clay">pending</span>
                      )}
                    </div>
                    <p className="text-xs text-ink/50 mt-3">Pending dues</p>
                    <p className={`font-display text-2xl md:text-3xl font-semibold mt-1 ${data.pendingDuesTotal > 0 ? "text-clay" : "text-ink"}`}>{formatCurrency(data.pendingDuesTotal)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Tile icon="📅" label="Appointments today" value={String(data.totalAppts)} onClick={() => setActiveTile("appointments")} accentIndex={0} />
                  <Tile
                    icon="📈"
                    label="Revenue, 7 days"
                    value={formatCurrency(data.revenueTrend.reduce((s, d) => s + d.amount, 0))}
                    onClick={() => setActiveTile("revenueTrend")}
                    sparkline={data.revenueTrend.map((d) => ({ x: d.day, y: d.amount }))}
                    accentIndex={1}
                  />
                  <Tile
                    icon="🗓️"
                    label="Appts this week"
                    value={String(data.weeklyAppointments.reduce((s, d) => s + d.count, 0))}
                    onClick={() => setActiveTile("weeklyAppts")}
                    sparkline={data.weeklyAppointments.map((d) => ({ x: d.day, y: d.count }))}
                    accentIndex={2}
                  />
                  <Tile icon="💳" label="Payment methods" value={`${data.paymentMethods.length} types`} onClick={() => setActiveTile("paymentMethods")} accentIndex={3} />
                  <Tile icon="👨‍⚕️" label="Business by doctor" value={`${data.byDoctor.length} doctors`} sub={data.byDoctor[0] ? `Top: ${data.byDoctor[0].name}` : undefined} onClick={() => setActiveTile("byDoctor")} wide accentIndex={0} />
                  <Tile icon="🦷" label="Top treatments" value={data.topTreatmentsWeek[0]?.treatment ?? "No data yet"} sub={data.topTreatmentsWeek[0] ? formatCurrency(data.topTreatmentsWeek[0].revenue) : undefined} onClick={() => setActiveTile("treatments")} accentIndex={1} />
                  <Tile icon="📍" label="Patient localities" value={`${data.topLocalities.length} areas`} sub={data.topLocalities[0]?.locality} onClick={() => setActiveTile("localities")} accentIndex={2} />
                  <Tile icon="📦" label="Low stock" value={String(data.lowStockCount)} alert={data.lowStockCount > 0} onClick={() => setActiveTile("lowStock")} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Level 1: list/chart popups ===== */}

      <Modal open={activeTile === "appointments"} onClose={() => setActiveTile(null)} title="Appointments today — tap a slice">
        {data && (
          <>
            {pieData.length === 0 ? (
              <p className="text-sm text-ink/40 py-6 text-center">No appointments today yet</p>
            ) : (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}
                      onClick={(entry: any) => goToDetail({ kind: "status", status: entry.name })}
                      cursor="pointer"
                    >
                      {pieData.map((entry) => (<Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              {pieData.map((d) => (
                <button key={d.name} onClick={() => goToDetail({ kind: "status", status: d.name })} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: STATUS_COLORS[d.name] }} />
                  {d.name}: {d.value}
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal open={activeTile === "revenueTrend"} onClose={() => setActiveTile(null)} title="Revenue, last 7 days — tap a point">
        {data && (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={data.revenueTrend} onClick={(e: any) => {
                const point = e?.activePayload?.[0]?.payload;
                if (point) goToDetail({ kind: "day", date: point.date });
              }}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="amount" stroke={TEAL_SHADES[1]} strokeWidth={2.5} dot={{ r: 4, cursor: "pointer" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Modal>

      <Modal open={activeTile === "weeklyAppts"} onClose={() => setActiveTile(null)} title="Appointments this week — tap a day">
        {data && (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data.weeklyAppointments}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry: any) => goToDetail({ kind: "day", date: entry.date })}>
                  {data.weeklyAppointments.map((entry) => (
                    <Cell key={entry.date} fill={TEAL_SHADES[1]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Modal>

      <Modal open={activeTile === "paymentMethods"} onClose={() => setActiveTile(null)} title="Payment methods (30 days) — tap a method">
        {data && (
          <>
            {data.paymentMethods.length === 0 ? (
              <p className="text-sm text-ink/40 py-6 text-center">No payments yet</p>
            ) : (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={data.paymentMethods} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}
                      onClick={(entry: any) => goToDetail({ kind: "method", name: entry.name })}
                      cursor="pointer"
                    >
                      {data.paymentMethods.map((entry) => (<Cell key={entry.name} fill={METHOD_COLORS[entry.name]} />))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              {data.paymentMethods.map((d) => (
                <button key={d.name} onClick={() => goToDetail({ kind: "method", name: d.name })} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: METHOD_COLORS[d.name] }} />
                  {d.name}: {formatCurrency(d.value)}
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal open={activeTile === "byDoctor"} onClose={() => setActiveTile(null)} title="Business by doctor — tap a doctor">
        {data && (
          <div className="space-y-2">
            {data.byDoctor.map((d) => (
              <button
                key={d.id}
                onClick={() => goToDetail({ kind: "doctor", id: d.id })}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left bg-sand hover:bg-teal/10 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-ink/50">{d.specialty}</p>
                </div>
                <p className="font-display text-sm font-semibold whitespace-nowrap">{formatCurrency(d.revenue)}</p>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={activeTile === "treatments"} onClose={() => setActiveTile(null)} title="Top treatments (7 days) — tap one">
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
                    <Bar
                      dataKey="revenue" radius={[0, 4, 4, 0]} cursor="pointer"
                      onClick={(entry: any) => goToDetail({ kind: "treatment", treatment: entry.treatment })}
                    >
                      {data.topTreatmentsWeek.map((entry, i) => (<Cell key={entry.treatment} fill={TEAL_SHADES[i % TEAL_SHADES.length]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal open={activeTile === "localities"} onClose={() => setActiveTile(null)} title="Where patients come from — tap an area">
        {data && (
          <>
            {data.topLocalities.length === 0 ? (
              <p className="text-sm text-ink/40 py-4 text-center">No locality data yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.topLocalities.map((loc, i) => (
                  <button
                    key={loc.locality}
                    onClick={() => goToDetail({ kind: "locality", locality: loc.locality })}
                    className="rounded-xl p-3 bg-teal text-white text-left hover:opacity-90 transition"
                    style={{ opacity: 1 - i * 0.08 }}
                  >
                    <p className="font-display text-2xl font-semibold">{loc.count}</p>
                    <p className="text-xs opacity-90 truncate">{loc.locality}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal open={activeTile === "lowStock"} onClose={() => setActiveTile(null)} title="Low stock items">
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

      {/* ===== Level 2: focused drill-down detail popups ===== */}

      <Modal
        open={detail?.kind === "doctor"}
        onClose={closeAll}
        title={detail?.kind === "doctor" ? data?.byDoctor.find((d) => d.id === detail.id)?.name ?? "" : ""}
      >
        {data && detail?.kind === "doctor" && (() => {
          const doc = data.byDoctor.find((d) => d.id === detail.id);
          const labs = data.labReferrals.filter((r) => r.doctor === doc?.name);
          return (
            <div className="space-y-4">
              <p className="text-sm text-ink/60">{doc?.specialty}</p>
              <div className="rounded-xl p-4 bg-teal text-white text-center">
                <p className="text-xs opacity-80">Business generated</p>
                <p className="font-display text-2xl font-semibold">{formatCurrency(doc?.revenue ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink/70 mb-2">Lab referrals</p>
                {labs.length === 0 ? (
                  <p className="text-sm text-ink/40">No lab referrals yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {labs.map((r) => (
                      <div key={r.lab} className="flex items-center justify-between text-sm bg-sand rounded-lg px-3 py-2">
                        <span>{r.lab}</span>
                        <span className="font-semibold text-clay">{r.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={detail?.kind === "day"}
        onClose={closeAll}
        title={detail?.kind === "day" ? new Date(detail.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }) : ""}
      >
        {data && detail?.kind === "day" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4 bg-teal text-white text-center">
              <p className="font-display text-2xl font-semibold">
                {formatCurrency(data.revenueTrend.find((d) => d.date === detail.date)?.amount ?? 0)}
              </p>
              <p className="text-xs opacity-80 mt-1">revenue</p>
            </div>
            <div className="rounded-xl p-4 bg-teal text-white text-center">
              <p className="font-display text-2xl font-semibold">
                {data.weeklyAppointments.find((d) => d.date === detail.date)?.count ?? 0}
              </p>
              <p className="text-xs opacity-80 mt-1">appointments</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={detail?.kind === "treatment"}
        onClose={closeAll}
        title={detail?.kind === "treatment" ? detail.treatment : ""}
      >
        {data && detail?.kind === "treatment" && (() => {
          const t = data.topTreatmentsWeek.find((x) => x.treatment === detail.treatment);
          const weekTotal = data.topTreatmentsWeek.reduce((s, x) => s + x.revenue, 0);
          const pct = weekTotal > 0 ? ((t?.revenue ?? 0) / weekTotal) * 100 : 0;
          return (
            <div className="rounded-xl p-4 bg-teal text-white text-center">
              <p className="font-display text-2xl font-semibold">{formatCurrency(t?.revenue ?? 0)}</p>
              <p className="text-xs opacity-80 mt-1">{pct.toFixed(0)}% of this week's treatment revenue</p>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={detail?.kind === "method"}
        onClose={closeAll}
        title={detail?.kind === "method" ? detail.name : ""}
      >
        {data && detail?.kind === "method" && (() => {
          const m = data.paymentMethods.find((x) => x.name === detail.name);
          const total = data.paymentMethods.reduce((s, x) => s + x.value, 0);
          const pct = total > 0 ? ((m?.value ?? 0) / total) * 100 : 0;
          return (
            <div className="rounded-xl p-4 bg-teal text-white text-center">
              <p className="font-display text-2xl font-semibold">{formatCurrency(m?.value ?? 0)}</p>
              <p className="text-xs opacity-80 mt-1">{pct.toFixed(0)}% of payments, last 30 days</p>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={detail?.kind === "locality"}
        onClose={closeAll}
        title={detail?.kind === "locality" ? detail.locality : ""}
      >
        {detailLoading ? (
          <p className="text-sm text-ink/60"><Spinner size={14} className="mr-1.5" />Loading…</p>
        ) : (
          <ul className="space-y-1.5">
            {(detailExtra ?? []).map((p: any, i: number) => (
              <li key={i} className="text-sm bg-sand rounded-lg px-3 py-2 flex justify-between">
                <span>{p.full_name}</span>
                <span className="text-ink/50">{p.phone}</span>
              </li>
            ))}
            {(detailExtra ?? []).length === 0 && <p className="text-sm text-ink/40">No patients found</p>}
          </ul>
        )}
      </Modal>

      <Modal
        open={detail?.kind === "status"}
        onClose={closeAll}
        title={detail?.kind === "status" ? `${detail.status} today` : ""}
      >
        {detailLoading ? (
          <p className="text-sm text-ink/60"><Spinner size={14} className="mr-1.5" />Loading…</p>
        ) : (
          <ul className="space-y-1.5">
            {(detailExtra ?? []).map((a: any, i: number) => (
              <li key={i} className="text-sm bg-sand rounded-lg px-3 py-2 flex justify-between">
                <span>{a.patients?.full_name ?? "Unknown"}</span>
                <span className="text-ink/50">{a.appointment_time?.slice(0, 5) ?? ""}</span>
              </li>
            ))}
            {(detailExtra ?? []).length === 0 && <p className="text-sm text-ink/40">None</p>}
          </ul>
        )}
      </Modal>
    </>
  );
}
