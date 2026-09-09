"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/format";

export default function OverviewTab({ clinicId }: { clinicId: string }) {
  const [todayRevenue, setTodayRevenue] = useState<number | null>(null);
  const [yesterdayRevenue, setYesterdayRevenue] = useState<number | null>(null);
  const [weekRevenue, setWeekRevenue] = useState<number | null>(null);
  const [monthRevenue, setMonthRevenue] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [newPatients, setNewPatients] = useState<number | null>(null);
  const [returningPatients, setReturningPatients] = useState<number | null>(null);
  const [outstandingTotal, setOutstandingTotal] = useState<number | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [labReferrals, setLabReferrals] = useState<number | null>(null);

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
      { data: yesterdayPayments },
      { data: weekPayments },
      { data: monthPayments },
      { count: apptCount },
      { data: todaysAppts },
      { data: invoices },
      { data: items },
      { count: labCount },
    ] = await Promise.all([
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", today),
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", yesterday).lt("paid_at", today),
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", weekStartStr),
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", monthStartStr),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("appointment_date", today),
      supabase.from("appointments").select("patient_id").eq("clinic_id", clinicId).eq("appointment_date", today),
      supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId).in("status", ["unpaid", "partial"]),
      supabase.from("inventory_items").select("id, reorder_level, inventory_batches(quantity)").eq("clinic_id", clinicId),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("referred_to_lab", true),
    ]);

    const sum = (rows: any[] | null) => (rows ?? []).reduce((s, p) => s + Number(p.amount), 0);
    setTodayRevenue(sum(todayPayments));
    setYesterdayRevenue(sum(yesterdayPayments));
    setWeekRevenue(sum(weekPayments));
    setMonthRevenue(sum(monthPayments));
    setTodayCount(apptCount ?? 0);
    setLabReferrals(labCount ?? 0);

    // New vs returning: for each patient with an appointment today, check
    // whether they had any appointment before today.
    const patientIds = Array.from(new Set((todaysAppts ?? []).map((a: any) => a.patient_id)));
    if (patientIds.length > 0) {
      const { data: priorAppts } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("clinic_id", clinicId)
        .lt("appointment_date", today)
        .in("patient_id", patientIds);
      const returningIds = new Set((priorAppts ?? []).map((a: any) => a.patient_id));
      setReturningPatients(returningIds.size);
      setNewPatients(patientIds.length - returningIds.size);
    } else {
      setReturningPatients(0);
      setNewPatients(0);
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

  // Trend: compare today's revenue so far to yesterday's full-day revenue.
  // Green = up or flat, yellow = modest drop, red = steep drop.
  let trendColor = "text-ink/60";
  let trendBg = "bg-ink/5";
  let trendLabel = "—";
  if (todayRevenue !== null && yesterdayRevenue !== null && yesterdayRevenue > 0) {
    const pctChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    if (pctChange >= 0) {
      trendColor = "text-teal";
      trendBg = "bg-teal/10";
      trendLabel = `▲ ${pctChange.toFixed(0)}% vs yesterday`;
    } else if (pctChange >= -25) {
      trendColor = "text-amber-700";
      trendBg = "bg-amber-100";
      trendLabel = `▼ ${Math.abs(pctChange).toFixed(0)}% vs yesterday`;
    } else {
      trendColor = "text-clay";
      trendBg = "bg-clay/10";
      trendLabel = `▼ ${Math.abs(pctChange).toFixed(0)}% vs yesterday`;
    }
  }

  return (
    <div className="space-y-5">
      {/* Hero: today's collection — the one bold element */}
      <div className="card p-6 md:p-8">
        <p className="text-sm text-ink/60 mb-1">Today's collection</p>
        <div className="flex items-end gap-3 flex-wrap">
          <p className="font-display text-4xl md:text-5xl font-semibold">
            {todayRevenue === null ? "…" : formatCurrency(todayRevenue)}
          </p>
          <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${trendBg} ${trendColor}`}>
            {trendLabel}
          </span>
        </div>
        <div className="flex gap-6 mt-4 text-sm text-ink/60">
          <span>This week: <strong className="text-ink">{weekRevenue === null ? "…" : formatCurrency(weekRevenue)}</strong></span>
          <span>This month: <strong className="text-ink">{monthRevenue === null ? "…" : formatCurrency(monthRevenue)}</strong></span>
        </div>
      </div>

      {/* Secondary stats — varied accents tied to meaning, not identical cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 border-l-4 border-l-teal">
          <p className="text-sm text-ink/60">Today's appointments</p>
          <p className="font-display text-2xl font-semibold mt-1">
            {todayCount === null ? "…" : todayCount}
          </p>
        </div>
        <div className="card p-5 border-l-4 border-l-sage">
          <p className="text-sm text-ink/60">New / Returning today</p>
          <p className="font-display text-2xl font-semibold mt-1">
            {newPatients === null ? "…" : `${newPatients} / ${returningPatients}`}
          </p>
        </div>
        <div
          className={`card p-5 border-l-4 ${
            (outstandingTotal ?? 0) > 0 ? "border-l-clay" : "border-l-sage"
          }`}
        >
          <p className="text-sm text-ink/60">Outstanding dues</p>
          <p className="font-display text-2xl font-semibold mt-1">
            {outstandingTotal === null ? "…" : formatCurrency(outstandingTotal)}
          </p>
        </div>
        <div
          className={`card p-5 border-l-4 ${
            (lowStockCount ?? 0) > 0 ? "border-l-clay" : "border-l-sage"
          }`}
        >
          <p className="text-sm text-ink/60">Low stock items</p>
          <p className="font-display text-2xl font-semibold mt-1">
            {lowStockCount === null ? "…" : lowStockCount}
          </p>
        </div>
      </div>

      <div className="card p-5 border-l-4 border-l-teal inline-flex items-center gap-3 w-auto">
        <span className="text-sm text-ink/60">Referred to lab (all time)</span>
        <span className="font-display text-xl font-semibold">
          {labReferrals === null ? "…" : labReferrals}
        </span>
      </div>
    </div>
  );
}
