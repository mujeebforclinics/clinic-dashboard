"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type Snapshot = {
  totalToday: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  revenueToday: number;
  lowStockItems: {
    id: string;
    item_name: string;
    qty: number;
    reorder_level: number;
  }[];
  pendingDuesTotal: number;
};

const COLORS: Record<string, string> = {
  Scheduled: "#5C7A6E",
  Completed: "#1C2321",
  Cancelled: "#B5563C",
  "No-show": "#D8B4A0",
};

export default function OwnerQuickView({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);

    const [
      { data: appts },
      { data: payments },
      { data: items },
      { data: invoices },
    ] = await Promise.all([
      supabase
        .from("appointments")
        .select("status")
        .eq("clinic_id", clinicId)
        .eq("appointment_date", today),
      supabase
        .from("payments")
        .select("amount")
        .eq("clinic_id", clinicId)
        .gte("paid_at", today),
      supabase
        .from("inventory_items")
        .select("id, item_name, reorder_level, inventory_batches(quantity)")
        .eq("clinic_id", clinicId),
      supabase
        .from("invoices")
        .select("total_amount, payments(amount)")
        .eq("clinic_id", clinicId)
        .in("status", ["unpaid", "partial"]),
    ]);

    const counts = { scheduled: 0, completed: 0, cancelled: 0, noShow: 0 };
    (appts ?? []).forEach((a: any) => {
      if (a.status === "scheduled") counts.scheduled++;
      else if (a.status === "completed") counts.completed++;
      else if (a.status === "cancelled") counts.cancelled++;
      else if (a.status === "no_show") counts.noShow++;
    });

    const revenueToday = (payments ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount),
      0
    );

    const lowStockItems = (items ?? [])
      .map((item: any) => {
        const qty = (item.inventory_batches ?? []).reduce(
          (s: number, b: any) => s + (b.quantity ?? 0),
          0
        );
        return {
          id: item.id,
          item_name: item.item_name,
          qty,
          reorder_level: item.reorder_level ?? 0,
        };
      })
      .filter((i: any) => i.qty <= i.reorder_level)
      .slice(0, 5);

    const pendingDuesTotal = (invoices ?? []).reduce(
      (sum: number, inv: any) => {
        const paid = (inv.payments ?? []).reduce(
          (s: number, p: any) => s + Number(p.amount),
          0
        );
        return sum + (Number(inv.total_amount) - paid);
      },
      0
    );

    setData({
      totalToday: (appts ?? []).length,
      scheduled: counts.scheduled,
      completed: counts.completed,
      cancelled: counts.cancelled,
      noShow: counts.noShow,
      revenueToday,
      lowStockItems,
      pendingDuesTotal,
    });
  };

  useEffect(() => {
    if (!open) return;
    load();

    const channel = supabase
      .channel("owner-quick-view")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_batches" },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        load
      )
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

  return (
    <>
      {/* Floating button - visible on every tab */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Owner quick view"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full bg-clay text-white shadow-lg flex items-center justify-center hover:opacity-90 transition"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M7 14l3-3 3 3 5-5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dim background when open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-sand z-50 shadow-2xl transition-transform duration-300 ease-out overflow-y-auto ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-semibold">
              Today's Snapshot
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="text-ink/50 hover:text-ink text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {!data ? (
            <p className="text-sm text-ink/60">Loading…</p>
          ) : (
            <div className="space-y-6">
              <div className="card p-4">
                <p className="text-sm text-ink/60 mb-2">
                  Appointments today ({data.totalToday})
                </p>
                {pieData.length === 0 ? (
                  <p className="text-sm text-ink/40 py-6 text-center">
                    No appointments today yet
                  </p>
                ) : (
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={COLORS[entry.name]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink/60">
                  {pieData.map((d) => (
                    <span key={d.name} className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: COLORS[d.name] }}
                      />
                      {d.name}: {d.value}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4">
                  <p className="text-xs text-ink/60">Revenue today</p>
                  <p className="font-display text-2xl font-semibold mt-1">
                    ₹{data.revenueToday.toFixed(0)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-ink/60">Pending dues</p>
                  <p className="font-display text-2xl font-semibold mt-1">
                    ₹{data.pendingDuesTotal.toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="card p-4">
                <p className="text-sm text-ink/60 mb-2">
                  Low stock ({data.lowStockItems.length})
                </p>
                {data.lowStockItems.length === 0 ? (
                  <p className="text-sm text-ink/40 py-2">All stocked up 👍</p>
                ) : (
                  <ul className="space-y-1">
                    {data.lowStockItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-sm bg-clay/10 text-clay rounded-lg px-3 py-2"
                      >
                        <span>{item.item_name}</span>
                        <span className="font-medium">
                          {item.qty}/{item.reorder_level}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
