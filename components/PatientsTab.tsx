"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency, formatPatientId } from "@/lib/format";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import type { Patient } from "@/lib/types";

type PatientVisit = {
  id: string;
  appointment_date: string;
  status: string;
  notes: string | null;
  doctors: { name: string } | null;
};

type PatientInvoice = {
  id: string;
  invoice_date: string;
  total_amount: number;
  status: string;
  treatment: string | null;
  payments: { amount: number }[];
};

export default function PatientsTab({
  clinicId,
  clinicName,
}: {
  clinicId: string;
  clinicName: string;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [locality, setLocality] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [patientInvoices, setPatientInvoices] = useState<PatientInvoice[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = async (searchQuery?: string) => {
    setSearching(true);
    let q = supabase
      .from("patients")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100);

    const trimmed = (searchQuery ?? "").trim();
    if (trimmed) {
      // If it looks like a patient ID (PREFIX-1234) or plain number, try matching patient_number too
      const numMatch = trimmed.match(/(\d+)/);
      if (numMatch) {
        const num = Number(numMatch[1]) - 1000;
        q = supabase
          .from("patients")
          .select("*")
          .eq("clinic_id", clinicId)
          .or(`full_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,patient_number.eq.${num}`)
          .limit(100);
      } else {
        q = supabase
          .from("patients")
          .select("*")
          .eq("clinic_id", clinicId)
          .or(`full_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
          .limit(100);
      }
    }

    const { data } = await q;
    setPatients(data ?? []);
    setSearching(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  useEffect(() => {
    const t = setTimeout(() => load(query), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from("patients").insert({
      clinic_id: clinicId,
      full_name: name,
      phone,
      age: age ? Number(age) : null,
      gender,
      locality,
      address,
    });
    setSaving(false);
    setName("");
    setPhone("");
    setAge("");
    setGender("");
    setLocality("");
    setAddress("");
    setShowForm(false);
    load(query);
  };

  const openPatient = async (p: Patient) => {
    setSelectedPatient(p);
    setLoadingDetail(true);
    const [{ data: appts }, { data: invs }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, appointment_date, status, notes, doctors(name)")
        .eq("clinic_id", clinicId)
        .eq("patient_id", p.id)
        .order("appointment_date", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, invoice_date, total_amount, status, treatment, payments(amount)")
        .eq("clinic_id", clinicId)
        .eq("patient_id", p.id)
        .order("invoice_date", { ascending: false }),
    ]);
    setVisits((appts as any) ?? []);
    setPatientInvoices((invs as any) ?? []);
    setLoadingDetail(false);
  };

  const totalRevenue = patientInvoices.reduce(
    (sum, inv) => sum + (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0),
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-xl font-semibold">Patients</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add patient"}
        </button>
      </div>

      <div className="mb-4">
        <input
          className="input"
          placeholder="Search by name, phone, or patient ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-5 mb-5 grid grid-cols-2 gap-3">
          <input className="input col-span-2" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input" placeholder="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
          <input className="input" placeholder="Locality (e.g. Saket, GK-1)" value={locality} onChange={(e) => setLocality(e.target.value)} />
          <input className="input col-span-2" placeholder="Full address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
          <button type="submit" disabled={saving} className="btn-primary col-span-2">
            {saving ? (<><Spinner size={14} className="mr-1.5" />Saving</>) : "Save patient"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-line">
        {searching && <p className="p-5 text-sm text-ink/60"><Spinner size={14} className="mr-1.5" />Searching…</p>}
        {!searching && patients.length === 0 && (
          <p className="p-5 text-sm text-ink/60">No patients found.</p>
        )}
        {!searching &&
          patients.map((p) => (
            <button
              key={p.id}
              onClick={() => openPatient(p)}
              className="w-full text-left p-4 flex items-center justify-between hover:bg-sand transition"
            >
              <div>
                <p className="font-medium">
                  {p.full_name}{" "}
                  <span className="text-xs text-teal font-normal">
                    {formatPatientId(clinicName, p.patient_number)}
                  </span>
                </p>
                <p className="text-sm text-ink/60">
                  {p.phone || "No phone"} · {p.age ? `${p.age} yrs` : "-"} · {p.gender || "-"}
                  {p.locality && <> · <span className="text-violet font-medium">{p.locality}</span></>}
                </p>
              </div>
            </button>
          ))}
      </div>

      <Modal
        open={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient?.full_name ?? ""}
      >
        {selectedPatient && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-sand rounded-lg p-3">
                <p className="text-ink/50 text-xs">Patient ID</p>
                <p className="font-medium">{formatPatientId(clinicName, selectedPatient.patient_number)}</p>
              </div>
              <div className="bg-sand rounded-lg p-3">
                <p className="text-ink/50 text-xs">Phone</p>
                <p className="font-medium">{selectedPatient.phone || "-"}</p>
              </div>
              <div className="bg-sand rounded-lg p-3">
                <p className="text-ink/50 text-xs">Age / Gender</p>
                <p className="font-medium">{selectedPatient.age ?? "-"} / {selectedPatient.gender ?? "-"}</p>
              </div>
              <div className="bg-teal/10 rounded-lg p-3">
                <p className="text-teal text-xs">Total revenue</p>
                <p className="font-display font-semibold text-teal">
                  {loadingDetail ? "…" : formatCurrency(totalRevenue)}
                </p>
              </div>
            </div>

            {loadingDetail ? (
              <p className="text-sm text-ink/60"><Spinner size={14} className="mr-1.5" />Loading history…</p>
            ) : (
              <>
                <div>
                  <p className="text-sm font-semibold text-ink/70 mb-2">Visit history</p>
                  {visits.length === 0 ? (
                    <p className="text-sm text-ink/40">No visits yet</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {visits.map((v) => (
                        <li key={v.id} className="text-sm bg-sand rounded-lg px-3 py-2 flex justify-between">
                          <span>{v.appointment_date} {v.doctors?.name && `· ${v.doctors.name}`}</span>
                          <span className="text-xs text-ink/50">{v.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-ink/70 mb-2">Billing history</p>
                  {patientInvoices.length === 0 ? (
                    <p className="text-sm text-ink/40">No invoices yet</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {patientInvoices.map((inv) => (
                        <li key={inv.id} className="text-sm bg-sand rounded-lg px-3 py-2 flex justify-between">
                          <span>{inv.invoice_date} {inv.treatment && `· ${inv.treatment}`}</span>
                          <span className="font-medium">{formatCurrency(Number(inv.total_amount))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
