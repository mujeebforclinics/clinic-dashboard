"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Modal from "@/components/Modal";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-violet/10 text-violet",
  completed: "bg-teal/10 text-teal",
  cancelled: "bg-clay/10 text-clay",
  no_show: "bg-rose/10 text-rose",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

function TrendPill({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 ${up ? "bg-teal/10 text-teal" : "bg-clay/10 text-clay"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block text-xs font-semibold rounded-full px-2.5 py-1 ${STATUS_STYLE[status] ?? "bg-sand text-ink/60"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-line px-3 py-2">
      <p className="text-[11px] text-ink/40 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-ink">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function OverviewTab({ clinicId }: { clinicId: string }) {
  const [todayRevenue, setTodayRevenue] = useState<number | null>(null);
  const [weekRevenue, setWeekRevenue] = useState<number | null>(null);
  const [monthRevenue, setMonthRevenue] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [apptTrendPct, setApptTrendPct] = useState<number | null>(null);
  const [newNames, setNewNames] = useState<string[]>([]);
  const [returningNames, setReturningNames] = useState<string[]>([]);
  const [outstandingTotal, setOutstandingTotal] = useState<number | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [labReferrals, setLabReferrals] = useState<number | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<{ day: string; amount: number }[]>([]);
  const [showPatientList, setShowPatientList] = useState(false);
  const [recentAppts, setRecentAppts] = useState<any[]>([]);
  const [apptSearch, setApptSearch] = useState("");
  const [apptModalOpen, setApptModalOpen] = useState(false);

  const loadStats = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const [
      { data: todayPayments },
      { data: weekPayments },
      { data: monthPayments },
      { count: apptCount },
      { count: apptCountYesterday },
      { data: todaysAppts },
      { data: invoices },
      { data: items },
      { count: labCount },
      { data: trendPayments },
      { data: recent },
    ] = await Promise.all([
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", today),
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", weekStartStr),
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", monthStartStr),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("appointment_date", today),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("appointment_date", yesterday),
      supabase.from("appointments").select("patient_id, patients(full_name)").eq("clinic_id", clinicId).eq("appointment_date", today),
      supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId).in("status", ["unpaid", "partial"]),
      supabase.from("inventory_items").select("id, reorder_level, inventory_batches(quantity)").eq("clinic_id", clinicId),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("referred_to_lab", true),
      supabase.from("payments").select("amount, paid_at").eq("clinic_id", clinicId).gte("paid_at", weekStartStr),
      supabase
        .from("appointments")
        .select("id, appointment_date, appointment_time, status, patients(full_name), doctors(name)")
        .eq("clinic_id", clinicId)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false })
        .limit(8),
    ]);

    setRecentAppts(recent ?? []);

    const sum = (rows: any[] | null) => (rows ?? []).reduce((s, p) => s + Number(p.amount), 0);
    setTodayRevenue(sum(todayPayments));
    setWeekRevenue(sum(weekPayments));
    setMonthRevenue(sum(monthPayments));
    setTodayCount(apptCount ?? 0);
    setLabReferrals(labCount ?? 0);

    const y = apptCountYesterday ?? 0;
    setApptTrendPct(y > 0 ? (((apptCount ?? 0) - y) / y) * 100 : null);

    const byDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      byDay[d.toISOString().slice(0, 10)] = 0;
    }
    (trendPayments ?? []).forEach((p: any) => {
      const day = p.paid_at.slice(0, 10);
      if (day in byDay) byDay[day] += Number(p.amount);
    });
    setRevenueTrend(Object.entries(byDay).map(([date, amount]) => ({ day: DAY_LABELS[new Date(date).getDay()], amount })));

    const uniqueToday = Array.from(
      new Map((todaysAppts ?? []).map((a: any) => [a.patient_id, a.patients?.full_name ?? "Unknown"])).entries()
    );
    const patientIds = uniqueToday.map(([id]) => id);
    if (patientIds.length > 0) {
      const { data: priorAppts } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("clinic_id", clinicId)
        .lt("appointment_date", today)
        .in("patient_id", patientIds);
      const returningIds = new Set((priorAppts ?? []).map((a: any) => a.patient_id));
      setReturningNames(uniqueToday.filter(([id]) => returningIds.has(id)).map(([, name]) => name));
      setNewNames(uniqueToday.filter(([id]) => !returningIds.has(id)).map(([, name]) => name));
    } else {
      setReturningNames([]);
      setNewNames([]);
    }

    const outstanding = (invoices ?? []).reduce((sum: number, inv: any) => {
      const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      return sum + (Number(inv.total_amount) - paid);
    }, 0);
    setOutstandingTotal(outstanding);

    const low = (items ?? []).filter((item: any) => {
      const qty = (item.inventory_batches ?? []).reduce((s: number, b: any) => s + (b.quantity ?? 0), 0);
      return qty <= (item.reorder_level ?? 0);
    });
    setLowStockCount(low.length);
  };

  useEffect(() => {
    loadStats();
    const channel = supabase
      .channel("overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_batches" }, loadStats)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const filteredAppts = recentAppts.filter((a) =>
    (a.patients?.full_name ?? "").toLowerCase().includes(apptSearch.trim().toLowerCase())
  );

  return (
    <div className="lg:h-full flex flex-col gap-4">
      {/* Stat cards row - white cards, pastel icon badges, trend pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="card p-5">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-violet/10">📅</span>
          <p className="text-sm text-ink/50 mt-3">Today's Appointments</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="font-display text-2xl font-semibold text-ink">{todayCount === null ? "…" : todayCount}</p>
            <TrendPill pct={apptTrendPct} />
          </div>
          <p className="text-xs text-ink/40 mt-1">From yesterday</p>
        </div>

        <button
          onClick={() => setShowPatientList(!showPatientList)}
          className="card p-5 text-left hover:shadow-lg transition"
        >
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-teal/10">🧑</span>
          <p className="text-sm text-ink/50 mt-3">New Patients Today</p>
          <p className="font-display text-2xl font-semibold text-ink mt-1">{newNames.length}</p>
          <p className="text-xs text-ink/40 mt-1">{returningNames.length} returning · tap for names</p>
        </button>

        <div className="card p-5">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-rose/10">💰</span>
          <p className="text-sm text-ink/50 mt-3">This Month</p>
          <p className="font-display text-2xl font-semibold text-ink mt-1">
            {monthRevenue === null ? "…" : formatCurrency(monthRevenue)}
          </p>
          <div className="flex items-end gap-1 h-6 mt-2">
            {revenueTrend.length === 0
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex-1 bg-rose/10 rounded-sm h-1.5" />
                ))
              : revenueTrend.map((d, i) => {
                  const max = Math.max(1, ...revenueTrend.map((r) => r.amount));
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-rose/25 rounded-sm"
                      style={{ height: `${Math.max(10, (d.amount / max) * 100)}%` }}
                    />
                  );
                })}
          </div>
        </div>

        <div className="card p-5">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${(lowStockCount ?? 0) > 0 ? "bg-clay/10" : "bg-teal/10"}`}>📦</span>
          <p className="text-sm text-ink/50 mt-3">Low Stock Items</p>
          <p className={`font-display text-2xl font-semibold mt-1 ${(lowStockCount ?? 0) > 0 ? "text-clay" : "text-ink"}`}>
            {lowStockCount === null ? "…" : lowStockCount}
          </p>
          <p className="text-xs text-ink/40 mt-1">{(lowStockCount ?? 0) > 0 ? "Needs reordering" : "All stocked up"}</p>
        </div>
      </div>

      {/* Main chart panel + side cards - fills the remaining height, no page scroll */}
      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2 flex flex-col lg:min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base bg-teal/10">📊</span>
              <p className="font-display text-lg font-semibold">Revenue Overview</p>
            </div>
            <span className="text-xs text-ink/50 bg-sand rounded-full px-3 py-1.5">Last 7 days</span>
          </div>

          <div className="flex gap-8 mb-3 shrink-0">
            <div>
              <p className="text-xs text-ink/50">This week</p>
              <p className="font-display text-xl font-semibold text-ink">{weekRevenue === null ? "…" : formatCurrency(weekRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50">This month</p>
              <p className="font-display text-xl font-semibold text-ink">{monthRevenue === null ? "…" : formatCurrency(monthRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50">Today</p>
              <p className="font-display text-xl font-semibold text-teal">{todayRevenue === null ? "…" : formatCurrency(todayRevenue)}</p>
            </div>
          </div>

          <div className="h-[220px] lg:h-auto lg:flex-1 lg:min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1D7874" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1D7874" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#1D7874" strokeWidth={2.5} fill="url(#revFill)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:min-h-0">
          {/* Light card */}
          <div className="card p-5 shrink-0">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${(outstandingTotal ?? 0) > 0 ? "bg-clay/10" : "bg-teal/10"}`}>⏳</span>
            <p className="text-sm text-ink/50 mt-3">Pending Dues</p>
            <p className={`font-display text-2xl font-semibold mt-1 ${(outstandingTotal ?? 0) > 0 ? "text-clay" : "text-ink"}`}>
              {outstandingTotal === null ? "…" : formatCurrency(outstandingTotal)}
            </p>
            <p className="text-xs text-ink/40 mt-1">Across all patients</p>
          </div>

          {/* Dark contrast card */}
          <div className="rounded-2xl p-5 bg-ink text-white shadow-md shrink-0">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-white/10">🧪</span>
            <p className="text-sm text-white/60 mt-3">Referred to Lab</p>
            <p className="font-display text-2xl font-semibold mt-1">{labReferrals === null ? "…" : labReferrals}</p>
            <p className="text-xs text-white/50 mt-1">All time</p>
          </div>

          {/* Recent appointments - opens as a popup instead of pushing the page down */}
          <button
            onClick={() => setApptModalOpen(true)}
            className="card p-5 text-left hover:shadow-lg transition lg:flex-1 lg:min-h-0 flex flex-col justify-between"
          >
            <div>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-violet/10">🗓️</span>
              <p className="text-sm text-ink/50 mt-3">Recent Appointments</p>
              <p className="font-display text-2xl font-semibold text-ink mt-1">{recentAppts.length}</p>
            </div>
            <p className="text-xs text-violet mt-2">Tap to view &amp; search →</p>
          </button>
        </div>
      </div>

      {/* Popup: new vs returning patient names */}
      <Modal open={showPatientList} onClose={() => setShowPatientList(false)} title="Patients seen today">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-teal mb-2">New today ({newNames.length})</p>
            {newNames.length === 0 ? <p className="text-sm text-ink/40">None yet</p> : (
              <ul className="text-sm space-y-1">{newNames.map((n, i) => <li key={i} className="text-ink/80">{n}</li>)}</ul>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-violet mb-2">Returning today ({returningNames.length})</p>
            {returningNames.length === 0 ? <p className="text-sm text-ink/40">None yet</p> : (
              <ul className="text-sm space-y-1">{returningNames.map((n, i) => <li key={i} className="text-ink/80">{n}</li>)}</ul>
            )}
          </div>
        </div>
      </Modal>

      {/* Popup: full recent appointments table with search */}
      <Modal open={apptModalOpen} onClose={() => setApptModalOpen(false)} title="Recent Appointments">
        <input
          className="input mb-3"
          placeholder="Search patient…"
          value={apptSearch}
          onChange={(e) => setApptSearch(e.target.value)}
        />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-xs text-ink/40 uppercase tracking-wide border-b border-line">
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium">Patient</th>
                <th className="px-5 py-2 font-medium">Doctor</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppts.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0 hover:bg-sand/60 transition">
                  <td className="px-5 py-3 text-ink/70 whitespace-nowrap">
                    {new Date(a.appointment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {a.appointment_time ? `, ${a.appointment_time.slice(0, 5)}` : ""}
                  </td>
                  <td className="px-5 py-3 font-medium text-ink whitespace-nowrap">
                    {a.patients?.full_name ?? "-"}
                  </td>
                  <td className="px-5 py-3 text-ink/70 whitespace-nowrap">{a.doctors?.name ?? "Unassigned"}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={a.status} />
                  </td>
                </tr>
              ))}
              {filteredAppts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-ink/40">
                    No appointments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
