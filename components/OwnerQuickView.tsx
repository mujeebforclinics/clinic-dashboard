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

type StaffNote = {
  id: string;
  message: string;
  urgency: "normal" | "urgent";
  created_at: string;
};

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
  revenueTrend: { day: string; amount: number }[];
  weeklyAppointments: { day: string; count: number }[];
};

const COLORS: Record<string, string> = {
  Scheduled: "#1D7874",
  Completed: "#1C2321",
  Cancelled: "#B5563C",
  "No-show": "#D8B4A0",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function OwnerQuickView({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [notes, setNotes] = useState<StaffNote[]>([]);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    const [
      { data: appts },
      { data: payments },
      { data: items },
      { data: invoices },
      { data: trendPayments },
      { data: weekAppts },
      { data: unreadNotes },
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
      supabase
        .from("payments")
        .select("amount, paid_at")
        .eq("clinic_id", clinicId)
        .gte("paid_at", sevenDaysAgoStr),
      supabase
        .from("appointments")
        .select("appointment_date")
        .eq("clinic_id", clinicId)
        .gte("appointment_date", sevenDaysAgoStr),
      supabase
        .from("staff_notes")
        .select("id, message, urgency, created_at")
        .eq("clinic_id", clinicId)
        .eq("is_read", false)
        .order("created_at", { ascending: false }),
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
    const revenueTrend = Object.entries(revenueByDay).map(([day, amount]) => ({
      day: DAY_LABELS[new Date(day).getDay()],
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
    const weeklyAppointments = Object.entries(apptsByDay).map(
      ([day, count]) => ({
        day: DAY_LABELS[new Date(day).getDay()],
        count,
      })
    );

    setNotes((unreadNotes as any) ?? []);
    setData({
      totalToday: (appts ?? []).length,
      scheduled: counts.scheduled,
      completed: counts.completed,
      cancelled: counts.cancelled,
      noShow: counts.noShow,
      revenueToday,
      lowStockItems,
      pendingDuesTotal,
      revenueTrend,
      weeklyAppointments,
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_notes" },
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
      <button
        onClick={() => setOpen(true)}
        aria-label="Owner quick view"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full bg-teal text-white shadow-lg flex items-center justify-center hover:opacity-90 transition"
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
        {notes.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-clay text-white text-[10px] font-bold flex items-center justify-center">
            {notes.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-sand shadow-2xl transition-transform duration-300 ease-out max-h-[92vh] overflow-y-auto rounded-b-2xl ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="p-5 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5">
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
            <div className="space-y-5">
              {notes.length > 0 && (
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 ${
                        n.urgency === "urgent"
                          ? "bg-clay/10 border border-clay/30"
                          : "bg-teal/10 border border-teal/30"
                      }`}
                    >
                      <div>
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            n.urgency === "urgent" ? "text-clay" : "text-teal"
                          }`}
                        >
                          {n.urgency === "urgent" ? "Urgent" : "Note"}
                        </span>
                        <p className="text-sm mt-0.5">{n.message}</p>
                      </div>
                      <button
                        onClick={() => dismissNote(n.id)}
                        className="text-xs text-ink/50 hover:text-ink whitespace-nowrap"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4">
                  <p className="text-xs text-ink/60">Revenue today</p>
                  <p className="font-display text-2xl font-semibold mt-1">
                    {formatCurrency(data.revenueToday)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-ink/60">Pending dues</p>
                  <p className="font-display text-2xl font-semibold mt-1">
                    {formatCurrency(data.pendingDuesTotal)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card p-4">
                  <p className="text-sm text-ink/60 mb-2">
                    Appointments today ({data.totalToday})
                  </p>
                  {pieData.length === 0 ? (
                    <p className="text-sm text-ink/40 py-6 text-center">
                      No appointments today yet
                    </p>
                  ) : (
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={40}
                            outerRadius={62}
                            paddingAngle={2}
                          >
                            {pieData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={COLORS[entry.name]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-ink/60">
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

                <div className="card p-4">
                  <p className="text-sm text-ink/60 mb-2">
                    Revenue, last 7 days
                  </p>
                  <div style={{ width: "100%", height: 160 }}>
                    <ResponsiveContainer>
                      <LineChart data={data.revenueTrend}>
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#1D7874"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-4 sm:col-span-2">
                  <p className="text-sm text-ink/60 mb-2">
                    Appointments this week
                  </p>
                  <div style={{ width: "100%", height: 160 }}>
                    <ResponsiveContainer>
                      <BarChart data={data.weeklyAppointments}>
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip />
                        <Bar dataKey="count" fill="#1D7874" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
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
