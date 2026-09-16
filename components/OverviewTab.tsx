"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function TrendPill({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 ${up ? "bg-teal/10 text-teal" : "bg-clay/10 text-clay"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
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
    ]);

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

  return (
    <div className="space-y-5">
      {/* Stat cards row - white cards, pastel icon badges, trend pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${(lowStockCount ?? 0) > 0 ? "bg-clay/10" : "bg-teal/10"}`}>📦</span>
          <p className="text-sm text-ink/50 mt-3">Low Stock Items</p>
          <p className={`font-display text-2xl font-semibold mt-1 ${(lowStockCount ?? 0) > 0 ? "text-clay" : "text-ink"}`}>
            {lowStockCount === null ? "…" : lowStockCount}
          </p>
          <p className="text-xs text-ink/40 mt-1">{(lowStockCount ?? 0) > 0 ? "Needs reordering" : "All stocked up"}</p>
        </div>
      </div>

      {showPatientList && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-4 bg-teal/5 border border-teal/20">
            <p className="text-sm font-medium text-teal mb-2">New today ({newNames.length})</p>
            {newNames.length === 0 ? <p className="text-sm text-ink/40">None yet</p> : (
              <ul className="text-sm space-y-1">{newNames.map((n, i) => <li key={i} className="text-ink/80">{n}</li>)}</ul>
            )}
          </div>
          <div className="card p-4 bg-violet/5 border border-violet/20">
            <p className="text-sm font-medium text-violet mb-2">Returning today ({returningNames.length})</p>
            {returningNames.length === 0 ? <p className="text-sm text-ink/40">None yet</p> : (
              <ul className="text-sm space-y-1">{returningNames.map((n, i) => <li key={i} className="text-ink/80">{n}</li>)}</ul>
            )}
          </div>
        </div>
      )}

      {/* Main chart panel + side cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base bg-teal/10">📊</span>
              <p className="font-display text-lg font-semibold">Revenue Overview</p>
            </div>
            <span className="text-xs text-ink/50 bg-sand rounded-full px-3 py-1.5">Last 7 days</span>
          </div>

          <div className="flex gap-8 mb-4">
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

          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1D7874" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1D7874" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="amount" stroke="#1D7874" strokeWidth={2.5} fill="url(#revFill)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          {/* Light card */}
          <div className="card p-5">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${(outstandingTotal ?? 0) > 0 ? "bg-clay/10" : "bg-teal/10"}`}>⏳</span>
            <p className="text-sm text-ink/50 mt-3">Pending Dues</p>
            <p className={`font-display text-2xl font-semibold mt-1 ${(outstandingTotal ?? 0) > 0 ? "text-clay" : "text-ink"}`}>
              {outstandingTotal === null ? "…" : formatCurrency(outstandingTotal)}
            </p>
            <p className="text-xs text-ink/40 mt-1">Across all patients</p>
          </div>

          {/* Dark contrast card */}
          <div className="rounded-2xl p-5 bg-ink text-white shadow-md">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-white/10">🧪</span>
            <p className="text-sm text-white/60 mt-3">Referred to Lab</p>
            <p className="font-display text-2xl font-semibold mt-1">{labReferrals === null ? "…" : labReferrals}</p>
            <p className="text-xs text-white/50 mt-1">All time</p>
          </div>
        </div>
      </div>
    </div>
  );
}
