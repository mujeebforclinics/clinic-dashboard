"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Appointment, Patient, Doctor } from "@/lib/types";

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
              <div key={d.id} className="flex items-center justify-between text-sm bg-sand rounded-lg px-3 py-2">
                <span>{d.name}</span>
                {d.specialty && <span className="text-violet text-xs font-medium">{d.specialty}</span>}
              </div>
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
            <button type="submit" disabled={savingDoctor} className="btn-primary col-span-2">
              {savingDoctor ? "Adding…" : "Add doctor"}
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
                {d.name}{d.specialty ? ` — ${d.specialty}` : ""}
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
            {saving ? "Booking…" : "Book appointment"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-line">
        {appointments.length === 0 && (
          <p className="p-5 text-sm text-ink/60">
            No appointments yet — book your first one above.
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
    </div>
  );
}
