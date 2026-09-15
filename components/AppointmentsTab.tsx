"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Appointment, Patient, Doctor } from "@/lib/types";
import Spinner from "@/components/Spinner";
import Modal from "@/components/Modal";
import { formatCurrency } from "@/lib/format";

export default function AppointmentsTab({ clinicId }: { clinicId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [referredToLab, setReferredToLab] = useState(false);
  const [labName, setLabName] = useState("");
  const [saving, setSaving] = useState(false);

  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState("");
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [doctorError, setDoctorError] = useState("");

  const [profileDoctor, setProfileDoctor] = useState<Doctor | null>(null);
  const [profileStats, setProfileStats] = useState<{
    apptCount: number;
    patientCount: number;
    revenue: number;
    labReferrals: { lab: string; count: number }[];
  } | null>(null);

  const openDoctorProfile = async (d: Doctor) => {
    setProfileDoctor(d);
    setProfileStats(null);
    const [{ data: appts }, { data: invs }, { data: labRows }] = await Promise.all([
      supabase.from("appointments").select("patient_id").eq("clinic_id", clinicId).eq("doctor_id", d.id),
      supabase.from("invoices").select("total_amount, payments(amount)").eq("clinic_id", clinicId).eq("doctor_id", d.id),
      supabase.from("appointments").select("lab_name").eq("clinic_id", clinicId).eq("doctor_id", d.id).eq("referred_to_lab", true).not("lab_name", "is", null),
    ]);
    const revenue = (invs ?? []).reduce((sum: number, inv: any) => {
      return sum + (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    }, 0);
    const uniquePatients = new Set((appts ?? []).map((a: any) => a.patient_id));
    const labCounts: Record<string, number> = {};
    (labRows ?? []).forEach((r: any) => {
      const lab = r.lab_name ?? "Unknown";
      labCounts[lab] = (labCounts[lab] ?? 0) + 1;
    });
    setProfileStats({
      apptCount: (appts ?? []).length,
      patientCount: uniquePatients.size,
      revenue,
      labReferrals: Object.entries(labCounts).map(([lab, count]) => ({ lab, count })),
    });
  };

  const load = async () => {
    const [{ data: appts }, { data: pts }, { data: docs }] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, patients(full_name), doctors(name, specialty)")
        .eq("clinic_id", clinicId)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: true })
        .limit(200),
      supabase.from("patients").select("*").eq("clinic_id", clinicId),
      supabase.from("doctors").select("*").eq("clinic_id", clinicId).order("name"),
    ]);
    setAppointments((appts as any) ?? []);
    setPatients(pts ?? []);
    setDoctors(docs ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctorName.trim()) return;
    setDoctorError("");

    const isDuplicate = doctors.some(
      (d) => d.name.trim().toLowerCase() === newDoctorName.trim().toLowerCase()
    );
    if (isDuplicate) {
      setDoctorError(`"${newDoctorName.trim()}" is already added.`);
      return;
    }

    setSavingDoctor(true);
    await supabase.from("doctors").insert({
      clinic_id: clinicId,
      name: newDoctorName.trim(),
      specialty: newDoctorSpecialty.trim() || null,
    });
    setSavingDoctor(false);
    setNewDoctorName("");
    setNewDoctorSpecialty("");
    load();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    setSaving(true);
    await supabase.from("appointments").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      doctor_id: doctorId || null,
      appointment_date: date,
      appointment_time: time || null,
      notes,
      referred_to_lab: referredToLab,
      lab_name: referredToLab ? labName || null : null,
      status: "scheduled",
    });
    setSaving(false);
    setNotes("");
    setTime("");
    setReferredToLab(false);
    setLabName("");
    setShowForm(false);
    load();
  };

  const updateStatus = async (id: string, status: Appointment["status"]) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    load();
  };

  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rDate, setRDate] = useState("");
  const [rTime, setRTime] = useState("");
  const [rDoctorId, setRDoctorId] = useState("");
  const [reschedSaving, setReschedSaving] = useState(false);

  const openReschedule = (a: Appointment) => {
    setReschedulingAppt(a);
    setRDate(a.appointment_date);
    setRTime(a.appointment_time?.slice(0, 5) ?? "");
    setRDoctorId(a.doctor_id ?? "");
  };

  const saveReschedule = async () => {
    if (!reschedulingAppt) return;
    setReschedSaving(true);
    await supabase
      .from("appointments")
      .update({
        appointment_date: rDate,
        appointment_time: rTime || null,
        doctor_id: rDoctorId || null,
      })
      .eq("id", reschedulingAppt.id);
    setReschedSaving(false);
    setReschedulingAppt(null);
    load();
  };

  const statusColor: Record<string, string> = {
    scheduled: "bg-teal/15 text-teal",
    completed: "bg-ink/10 text-ink/70",
    cancelled: "bg-clay/10 text-clay",
    no_show: "bg-clay/10 text-clay",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-xl font-semibold">Appointments</h2>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowDoctorForm(!showDoctorForm)}>
            {showDoctorForm ? "Close" : "+ Manage doctors"}
          </button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Book appointment"}
          </button>
        </div>
      </div>

      {showDoctorForm && (
        <div className="card p-5 mb-5">
          <p className="font-medium text-sm mb-3">Doctors at this clinic</p>
          <div className="space-y-1 mb-4">
            {doctors.length === 0 && (
              <p className="text-sm text-ink/60">No doctors added yet.</p>
            )}
            {doctors.map((d) => (
              <button
                key={d.id}
                onClick={() => openDoctorProfile(d)}
                className="w-full flex items-center justify-between text-sm bg-sand rounded-lg px-3 py-2 hover:bg-violet/10 transition text-left"
              >
                <span>{d.name}</span>
                {d.specialty && <span className="text-violet text-xs font-medium">{d.specialty}</span>}
              </button>
            ))}
          </div>
          <form onSubmit={handleAddDoctor} className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Doctor name"
              value={newDoctorName}
              onChange={(e) => setNewDoctorName(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="Specialty (e.g. Orthodontist)"
              value={newDoctorSpecialty}
              onChange={(e) => setNewDoctorSpecialty(e.target.value)}
            />
            {doctorError && (
              <p className="col-span-2 text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">
                {doctorError}
              </p>
            )}
            <button type="submit" disabled={savingDoctor} className="btn-primary col-span-2">
              {savingDoctor ? (<><Spinner size={14} className="mr-1.5" />Adding</>) : "Add doctor"}
            </button>
          </form>
        </div>
      )}

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
          <select
            className="input col-span-2"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">Select doctor (optional)</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.specialty ? ` - ${d.specialty}` : ""}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <input
            className="input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <input
            className="input col-span-2"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <label className="col-span-2 flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={referredToLab}
              onChange={(e) => setReferredToLab(e.target.checked)}
              className="w-4 h-4"
            />
            Referred to lab
          </label>
          {referredToLab && (
            <input
              className="input col-span-2"
              placeholder="Lab name"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
            />
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary col-span-2"
          >
            {saving ? (<><Spinner size={14} className="mr-1.5" />Booking</>) : "Book appointment"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-line">
        {appointments.length === 0 && (
          <p className="p-5 text-sm text-ink/60">
            No appointments yet. Book your first one above.
          </p>
        )}
        {appointments.map((a) => (
          <div key={a.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{a.patients?.full_name ?? "Unknown"}</p>
              <p className="text-sm text-ink/60">
                {a.appointment_date} {a.appointment_time?.slice(0, 5) ?? ""}
                {a.doctors?.name && (
                  <> · <span className="text-violet">{a.doctors.name}</span></>
                )}
                {a.lab_name && (
                  <> · <span className="text-rose">Lab: {a.lab_name}</span></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[a.status]}`}
              >
                {a.status.replace("_", " ")}
              </span>
              {a.status === "scheduled" && (
                <>
                  <button
                    className="btn-ghost text-xs px-2 py-1"
                    onClick={() => openReschedule(a)}
                  >
                    Reschedule
                  </button>
                  <button
                    className="btn-ghost text-xs px-2 py-1"
                    onClick={() => updateStatus(a.id, "completed")}
                  >
                    Mark done
                  </button>
                  <button
                    className="btn-ghost text-xs px-2 py-1"
                    onClick={() => updateStatus(a.id, "cancelled")}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!reschedulingAppt}
        onClose={() => setReschedulingAppt(null)}
        title="Reschedule appointment"
      >
        {reschedulingAppt && (
          <div className="space-y-3">
            <p className="text-sm text-ink/60">
              {reschedulingAppt.patients?.full_name ?? "Patient"}
            </p>
            <input
              className="input"
              type="date"
              value={rDate}
              onChange={(e) => setRDate(e.target.value)}
            />
            <input
              className="input"
              type="time"
              value={rTime}
              onChange={(e) => setRTime(e.target.value)}
            />
            <select
              className="input"
              value={rDoctorId}
              onChange={(e) => setRDoctorId(e.target.value)}
            >
              <option value="">No doctor assigned</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.specialty ? ` - ${d.specialty}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={saveReschedule}
              disabled={reschedSaving}
              className="btn-primary w-full"
            >
              {reschedSaving ? (<><Spinner size={14} className="mr-1.5" />Saving</>) : "Save changes"}
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={!!profileDoctor}
        onClose={() => setProfileDoctor(null)}
        title={profileDoctor?.name ?? ""}
      >
        {profileDoctor && (
          <div className="space-y-4">
            <p className="text-sm text-violet font-medium">{profileDoctor.specialty}</p>
            {!profileStats ? (
              <p className="text-sm text-ink/60"><Spinner size={14} className="mr-1.5" />Loading profile…</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-teal/10 rounded-lg p-3 text-center">
                    <p className="font-display text-lg font-semibold text-teal">{formatCurrency(profileStats.revenue)}</p>
                    <p className="text-[10px] text-ink/50">revenue</p>
                  </div>
                  <div className="bg-violet/10 rounded-lg p-3 text-center">
                    <p className="font-display text-lg font-semibold text-violet">{profileStats.patientCount}</p>
                    <p className="text-[10px] text-ink/50">patients</p>
                  </div>
                  <div className="bg-sage/10 rounded-lg p-3 text-center">
                    <p className="font-display text-lg font-semibold text-sage">{profileStats.apptCount}</p>
                    <p className="text-[10px] text-ink/50">appointments</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink/70 mb-2">Lab referrals</p>
                  {profileStats.labReferrals.length === 0 ? (
                    <p className="text-sm text-ink/40">No lab referrals yet</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {profileStats.labReferrals.map((r) => (
                        <li key={r.lab} className="text-sm bg-rose/5 border border-rose/20 rounded-lg px-3 py-2 flex justify-between">
                          <span>{r.lab}</span>
                          <span className="font-semibold text-rose">{r.count}</span>
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
