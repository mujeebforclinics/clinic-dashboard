"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Appointment, Patient } from "@/lib/types";

export default function AppointmentsTab({ clinicId }: { clinicId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [referredToLab, setReferredToLab] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: appts }, { data: pts }] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, patients(full_name)")
        .eq("clinic_id", clinicId)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: true }),
      supabase.from("patients").select("*").eq("clinic_id", clinicId),
    ]);
    setAppointments((appts as any) ?? []);
    setPatients(pts ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    setSaving(true);
    await supabase.from("appointments").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      appointment_date: date,
      appointment_time: time || null,
      notes,
      referred_to_lab: referredToLab,
      status: "scheduled",
    });
    setSaving(false);
    setNotes("");
    setTime("");
    setReferredToLab(false);
    setShowForm(false);
    load();
  };

  const updateStatus = async (id: string, status: Appointment["status"]) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    load();
  };

  const statusColor: Record<string, string> = {
    scheduled: "bg-sage/15 text-sage",
    completed: "bg-ink/10 text-ink/70",
    cancelled: "bg-clay/10 text-clay",
    no_show: "bg-clay/10 text-clay",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Appointments</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Book appointment"}
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
