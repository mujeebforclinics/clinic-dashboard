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
  lowStockItems: { id: string; item_name: string; qty: number; reorder_level: number }[];
  pendingDuesTotal: number;
  revenueTrend: { day: string; amount: number }[];
  weeklyAppointments: { day: string; count: number }[];
  topLocalities: { locality: string; count: number }[];
  paymentMethods: { name: string; value: number }[];
  collectionRatePct: number;
  byDoctor: { name: string; specialty: string; revenue: number; patients: number }[];
  labReferrals: { doctor: string; lab: string; count: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "#1D7874",
  Completed: "#1C2321",
  Cancelled: "#B5563C",
  "No-show": "#D8B4A0",
};

const METHOD_COLORS: Record<string, string> = {
  Cash: "#1D7874",
  UPI: "#6D5DD3",
  Card: "#D6537A",
};

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
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 70 ? "#1D7874" : clamped >= 40 ? "#D97706" : "#B5563C";

  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={radius} stroke="#E4DED2" strokeWidth="10" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="700" fill="#1C2321">
          {clamped.toFixed(0)}%
        </text>
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
    ] = await Promise.all([
      supabase.from("appointments").select("status").eq("clinic_id", clinicId).eq("appointment_date", today),
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).gte("paid_at", today),
      supabase.from("inventory_items").select("id, item_name, reorder_level, inventory_batches(quantity)").eq("clinic_id", clinicId),
      supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId).in("status", ["unpaid", "partial"]),
      supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId),
      supabase.from("payments").select("amount, paid_at").eq("clinic_id", clinicId).gte("paid_at", sevenDaysAgoStr),
      supabase.from("appointments").select("appointment_date").eq("clinic_id", clinicId).gte("appointment_date", sevenDaysAgoStr),
      supabase.from("staff_notes").select("id, message, urgency, created_at").eq("clinic_id", clinicId).eq("is_read", false).order("created_at", { ascending: false }),
      supabase.from("patients").select("locality").eq("clinic_id", clinicId).not("locality", "is", null),
      supabase.from("payments").select("amount, payment_method").eq("clinic_id", clinicId).gte("paid_at", thirtyDaysAgoStr),
      supabase.from("doctors").select("id, name, specialty").eq("clinic_id", clinicId),
      supabase.from("invoices").select("doctor_id, total_amount, payments(amount), doctors(name)").eq("clinic_id", clinicId),
      supabase.from("appointments").select("doctor_id, lab_name, doctors(name)").eq("clinic_id", clinicId).eq("referred_to_lab", true).not("lab_name", "is", null),
    ]);

    const counts = { scheduled: 0, completed: 0, cancelled: 0, noShow: 0 };
    (appts ?? []).forEach((a: any) => {
      if (a.status === "scheduled") counts.scheduled++;
      else if (a.status === "completed") counts.completed++;
      else if (a.status === "cancelled") counts.cancelled++;
      else if (a.status === "no_show") counts.noShow++;
    });

    const revenueToday = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);

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
    const weeklyAppointments = Object.entries(apptsByDay).map(([day, count]) => ({
      day: DAY_LABELS[new Date(day).getDay()],
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
    const paymentMethods = Object.entries(methodTotals)
      .map(([name, value]) => ({ name, value }))
      .filter((m) => m.value > 0);

    // Revenue + patient count per doctor
    const doctorRevenue: Record<string, number> = {};
    const doctorPatientSets: Record<string, Set<string>> = {};
    (doctorInvoices ?? []).forEach((inv: any) => {
      if (!inv.doctor_id) return;
      const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      doctorRevenue[inv.doctor_id] = (doctorRevenue[inv.doctor_id] ?? 0) + paid;
    });
    const byDoctor = (doctorRows ?? [])
      .map((d: any) => ({
        name: d.name,
        specialty: d.specialty ?? "General",
        revenue: doctorRevenue[d.id] ?? 0,
        patients: 0,
      }))
      .sort((a: any, b: any) => b.revenue - a.revenue);

    // Lab referrals grouped by doctor + lab
    const labCounts: Record<string, { doctor: string; lab: string; count: number }> = {};
    (labReferralRows ?? []).forEach((r: any) => {
      const doctorName = r.doctors?.name ?? "Unassigned";
      const lab = r.lab_name ?? "Unknown lab";
      const key = `${doctorName}|${lab}`;
      if (!labCounts[key]) labCounts[key] = { doctor: doctorName, lab, count: 0 };
      labCounts[key].count++;
    });
    const labReferrals = Object.values(labCounts).sort((a, b) => b.count - a.count).slice(0, 6);

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
      topLocalities,
      paymentMethods,
      collectionRatePct,
      byDoctor,
      labReferrals,
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Owner quick view"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full bg-teal text-white shadow-lg flex items-center justify-center hover:opacity-90 transition"
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
        <div className="p-5 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-semibold">Today's Snapshot</h2>
            <button onClick={() => setOpen(false)} className="text-ink/50 hover:text-ink text-2xl leading-none" aria-label="Close">
              ×
            </button>
          </div>

          {!data ? (
            <p className="text-sm text-ink/60">Loading…</p>
          ) : (
            <div className="space-y-5">
              {notes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 mb-1.5">
                    Notes ({notes.length})
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {notes.map((n) => (
                      <div
                        key={n.id}
                        className={`flex items-start justify-between gap-3 rounded-lg px-4 py-2.5 ${
                          n.urgency === "urgent" ? "bg-clay/10 border border-clay/30" : "bg-teal/10 border border-teal/30"
                        }`}
                      >
                        <div>
                          <span className={`text-xs font-semibold uppercase tracking-wide ${n.urgency === "urgent" ? "text-clay" : "text-teal"}`}>
                            {n.urgency === "urgent" ? "Urgent" : "Note"}
                          </span>
                          <p className="text-sm mt-0.5">{n.message}</p>
                        </div>
                        <button onClick={() => dismissNote(n.id)} className="text-xs text-ink/50 hover:text-ink whitespace-nowrap">
                          Dismiss
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4 bg-teal text-white">
                  <p className="text-xs opacity-80">Revenue today</p>
                  <p className="font-display text-2xl font-semibold mt-1">{formatCurrency(data.revenueToday)}</p>
                </div>
                <div className={`rounded-xl p-4 text-white ${data.pendingDuesTotal > 0 ? "bg-clay" : "bg-sage"}`}>
                  <p className="text-xs opacity-80">Pending dues</p>
                  <p className="font-display text-2xl font-semibold mt-1">{formatCurrency(data.pendingDuesTotal)}</p>
                </div>
              </div>

              <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
                <ProgressRing
                  pct={data.collectionRatePct}
                  label="Collection rate"
                  sub="of all billed amount collected"
                />
                <div className="flex gap-3">
                  <div className="rounded-xl px-4 py-3 bg-violet text-white text-center">
                    <p className="font-display text-xl font-semibold">{data.totalToday}</p>
                    <p className="text-[11px] opacity-80">appts today</p>
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-rose text-white text-center">
                    <p className="font-display text-xl font-semibold">{data.lowStockItems.length}</p>
                    <p className="text-[11px] opacity-80">low stock</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card p-4">
                  <p className="text-sm text-ink/60 mb-2">Appointments today ({data.totalToday})</p>
                  {pieData.length === 0 ? (
                    <p className="text-sm text-ink/40 py-6 text-center">No appointments today yet</p>
                  ) : (
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
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
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_COLORS[d.name] }} />
                        {d.name}: {d.value}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="card p-4">
                  <p className="text-sm text-ink/60 mb-2">Revenue, last 7 days</p>
                  <div style={{ width: "100%", height: 160 }}>
                    <ResponsiveContainer>
                      <LineChart data={data.revenueTrend}>
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip />
                        <Line type="monotone" dataKey="amount" stroke="#1D7874" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-4">
                  <p className="text-sm text-ink/60 mb-2">Appointments this week</p>
                  <div style={{ width: "100%", height: 160 }}>
                    <ResponsiveContainer>
                      <BarChart data={data.weeklyAppointments}>
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip />
                        <Bar dataKey="count" fill="#6D5DD3" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-4">
                  <p className="text-sm text-ink/60 mb-2">Payment methods (30 days)</p>
                  {data.paymentMethods.length === 0 ? (
                    <p className="text-sm text-ink/40 py-6 text-center">No payments yet</p>
                  ) : (
                    <div style={{ width: "100%", height: 160 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={data.paymentMethods} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                            {data.paymentMethods.map((entry) => (
                              <Cell key={entry.name} fill={METHOD_COLORS[entry.name]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-ink/60">
                    {data.paymentMethods.map((d) => (
                      <span key={d.name} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: METHOD_COLORS[d.name] }} />
                        {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {data.byDoctor.length > 0 && (
                <div className="card p-4">
                  <p className="text-sm text-ink/60 mb-3">Business by doctor</p>
                  <div className="space-y-2">
                    {data.byDoctor.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: DOCTOR_COLORS[i % DOCTOR_COLORS.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.name}</p>
                          <p className="text-xs text-violet">{d.specialty}</p>
                        </div>
                        <p className="font-display text-sm font-semibold whitespace-nowrap">
                          {formatCurrency(d.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.labReferrals.length > 0 && (
                <div className="card p-4">
                  <p className="text-sm text-ink/60 mb-3">Lab referrals by doctor</p>
                  <div className="space-y-1.5">
                    {data.labReferrals.map((r, i) => (
                      <div key={`${r.doctor}-${r.lab}`} className="flex items-center justify-between text-sm bg-rose/5 border border-rose/20 rounded-lg px-3 py-2">
                        <span>
                          <span className="text-violet font-medium">{r.doctor}</span>
                          <span className="text-ink/50"> → </span>
                          <span>{r.lab}</span>
                        </span>
                        <span className="font-semibold text-rose">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card p-4">
                <p className="text-sm text-ink/60 mb-3">Where patients come from</p>
                {data.topLocalities.length === 0 ? (
                  <p className="text-sm text-ink/40 py-4 text-center">
                    No locality data yet — add a locality when creating patients
                  </p>
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
              </div>

              <div className="card p-4">
                <p className="text-sm text-ink/60 mb-2">Low stock ({data.lowStockItems.length})</p>
                {data.lowStockItems.length === 0 ? (
                  <p className="text-sm text-ink/40 py-2">All stocked up 👍</p>
                ) : (
                  <ul className="space-y-1">
                    {data.lowStockItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-sm bg-clay/10 text-clay rounded-lg px-3 py-2">
                        <span>{item.item_name}</span>
                        <span className="font-medium">{item.qty}/{item.reorder_level}</span>
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
