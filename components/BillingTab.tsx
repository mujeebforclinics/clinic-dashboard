"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Invoice, Patient } from "@/lib/types";

export default function BillingTab({ clinicId }: { clinicId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const load = async () => {
    const [{ data: inv }, { data: pts }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, patients(full_name), payments(amount)")
        .eq("clinic_id", clinicId)
        .order("invoice_date", { ascending: false }),
      supabase.from("patients").select("*").eq("clinic_id", clinicId),
    ]);
    setInvoices((inv as any) ?? []);
    setPatients(pts ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !amount) return;
    setSaving(true);
    await supabase.from("invoices").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      total_amount: Number(amount),
      status: "unpaid",
    });
    setSaving(false);
    setAmount("");
    setShowForm(false);
    load();
  };

  const paidSoFar = (inv: Invoice) =>
    (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const recordPayment = async (invoice: Invoice) => {
    if (!payAmount) return;
    const amt = Number(payAmount);
    await supabase.from("payments").insert({
      clinic_id: clinicId,
      invoice_id: invoice.id,
      amount: amt,
      payment_method: payMethod,
    });

    const newPaid = paidSoFar(invoice) + amt;
    const newStatus =
      newPaid >= Number(invoice.total_amount) ? "paid" : "partial";
    await supabase
      .from("invoices")
      .update({ status: newStatus })
      .eq("id", invoice.id);

    setPayingId(null);
    setPayAmount("");
    load();
  };

  const statusColor: Record<string, string> = {
    paid: "bg-sage/15 text-sage",
    partial: "bg-clay/10 text-clay",
    unpaid: "bg-clay/15 text-clay",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Billing</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New invoice"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-5 mb-5 grid grid-cols-2 gap-3">
          <select
            className="input col-span-2"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
          >
            <option value="">Select patient</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
          <input
            className="input col-span-2"
            type="number"
            placeholder="Total amount (₹)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-primary col-span-2"
          >
            {saving ? "Creating…" : "Create invoice"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-line">
        {invoices.length === 0 && (
          <p className="p-5 text-sm text-ink/60">
            No invoices yet — create your first one above.
          </p>
        )}
        {invoices.map((inv) => {
          const paid = paidSoFar(inv);
          const balance = Number(inv.total_amount) - paid;
          return (
            <div key={inv.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {inv.patients?.full_name ?? "Unknown"}
                  </p>
                  <p className="text-sm text-ink/60">
                    {inv.invoice_date} · ₹{inv.total_amount} total · ₹
                    {balance.toFixed(0)} due
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[inv.status]}`}
                  >
                    {inv.status}
                  </span>
                  {inv.status !== "paid" && (
                    <button
                      className="btn-ghost text-xs px-2 py-1"
                      onClick={() =>
                        setPayingId(payingId === inv.id ? null : inv.id)
                      }
                    >
                      Record payment
                    </button>
                  )}
                </div>
              </div>

              {payingId === inv.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="input"
                    type="number"
                    placeholder="Amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                  <select
                    className="input"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                  <button
                    className="btn-primary whitespace-nowrap"
                    onClick={() => recordPayment(inv)}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
