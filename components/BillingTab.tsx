"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/format";
import type { Invoice, Patient, Doctor } from "@/lib/types";
import Spinner from "@/components/Spinner";

const TREATMENTS = [
  "Consultation", "Scaling & Polishing", "Cavity Filling", "Root Canal Treatment",
  "Tooth Extraction", "Braces Adjustment", "Teeth Whitening", "Dental X-Ray",
  "Crown Fitting", "Wisdom Tooth Removal", "Fluoride Treatment", "Denture Fitting",
  "Dental Implant", "Porcelain Veneers", "Invisalign Session", "Gum Treatment",
  "Night Guard Fitting",
];

export default function BillingTab({ clinicId }: { clinicId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [treatment, setTreatment] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: inv }, { data: pts }, { data: docs }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, patients(full_name), doctors(name), payments(id, amount, payment_method, paid_at)")
        .eq("clinic_id", clinicId)
        .order("invoice_date", { ascending: false })
        .limit(200),
      supabase.from("patients").select("*").eq("clinic_id", clinicId),
      supabase.from("doctors").select("*").eq("clinic_id", clinicId).order("name"),
    ]);
    setInvoices((inv as any) ?? []);
    setPatients(pts ?? []);
    setDoctors(docs ?? []);
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
      doctor_id: doctorId || null,
      treatment: treatment || null,
      total_amount: Number(amount),
      status: "unpaid",
    });
    setSaving(false);
    setAmount("");
    setTreatment("");
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
      doctor_id: invoice.doctor_id ?? null,
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
    paid: "bg-teal/15 text-teal",
    partial: "bg-amber-100 text-amber-700",
    unpaid: "bg-clay/15 text-clay",
  };

  return (
    <div className="lg:h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="font-display text-xl font-semibold">Billing</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New invoice"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-5 mb-5 grid grid-cols-2 gap-3 shrink-0">
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
          <select
            className="input col-span-2"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">Treating doctor (optional)</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.specialty ? ` - ${d.specialty}` : ""}
              </option>
            ))}
          </select>
          <select
            className="input col-span-2"
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
          >
            <option value="">Treatment (optional)</option>
            {TREATMENTS.map((t) => (
              <option key={t} value={t}>{t}</option>
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
            {saving ? (<><Spinner size={14} className="mr-1.5" />Creating</>) : "Create invoice"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-line lg:flex-1 lg:min-h-0 overflow-y-auto">
        {invoices.length === 0 && (
          <p className="p-5 text-sm text-ink/60">
            No invoices yet. Create your first one above.
          </p>
        )}
        {invoices.map((inv) => {
          const paid = paidSoFar(inv);
          const balance = Number(inv.total_amount) - paid;
          const paymentCount = (inv.payments ?? []).length;
          return (
            <div key={inv.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {inv.patients?.full_name ?? "Unknown"}
                    {inv.doctors?.name && (
                      <span className="text-violet text-xs font-normal ml-2">
                        {inv.doctors.name}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink/60">
                    {inv.invoice_date} · {formatCurrency(Number(inv.total_amount))} total ·{" "}
                    {formatCurrency(balance)} due
                    {inv.treatment && (
                      <> · <span className="text-teal">{inv.treatment}</span></>
                    )}
                    {paymentCount > 0 && (
                      <button
                        className="ml-2 text-teal underline underline-offset-2"
                        onClick={() =>
                          setExpandedId(expandedId === inv.id ? null : inv.id)
                        }
                      >
                        {paymentCount} payment{paymentCount > 1 ? "s" : ""}
                      </button>
                    )}
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

              {expandedId === inv.id && (
                <ul className="mt-3 space-y-1 bg-sand rounded-lg p-3">
                  {(inv.payments ?? []).map((p: any) => (
                    <li key={p.id} className="text-sm flex justify-between">
                      <span className="text-ink/60">
                        {new Date(p.paid_at).toLocaleDateString()} · {p.payment_method}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(Number(p.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

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
