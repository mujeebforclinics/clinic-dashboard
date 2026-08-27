"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function OverviewTab({ clinicId }: { clinicId: string }) {
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [revenueMonth, setRevenueMonth] = useState<number | null>(null);
  const [unpaidCount, setUnpaidCount] = useState<number | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);

  const loadStats = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const [{ count: apptCount }, { data: payments }, { count: unpaid }, { data: items }] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("appointment_date", today),
        supabase
          .from("payments")
          .select("amount")
          .eq("clinic_id", clinicId)
          .gte("paid_at", monthStartStr),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .in("status", ["unpaid", "partial"]),
        supabase
          .from("inventory_items")
          .select("id, reorder_level, inventory_batches(quantity)")
          .eq("clinic_id", clinicId),
      ]);

    setTodayCount(apptCount ?? 0);
    setRevenueMonth(
      (payments ?? []).reduce((sum, p: any) => sum + Number(p.amount), 0)
    );
    setUnpaidCount(unpaid ?? 0);

    const low = (items ?? []).filter((item: any) => {
      const totalQty = (item.inventory_batches ?? []).reduce(
        (s: number, b: any) => s + (b.quantity ?? 0),
        0
      );
      return totalQty <= (item.reorder_level ?? 0);
    });
    setLowStockCount(low.length);
  };

  useEffect(() => {
    loadStats();

    const channel = supabase
      .channel("overview-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        loadStats
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        loadStats
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        loadStats
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_batches" },
        loadStats
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const cards = [
    { label: "Today's appointments", value: todayCount },
    { label: "Revenue this month", value: revenueMonth, prefix: "₹" },
    { label: "Unpaid invoices", value: unpaidCount },
    { label: "Low stock items", value: lowStockCount },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="card p-5">
          <p className="text-sm text-ink/60">{c.label}</p>
          <p className="font-display text-3xl font-semibold mt-1">
            {c.value === null ? "…" : `${c.prefix ?? ""}${c.value}`}
          </p>
        </div>
      ))}
    </div>
  );
}
