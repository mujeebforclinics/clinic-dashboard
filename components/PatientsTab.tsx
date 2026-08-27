"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Patient } from "@/lib/types";

export default function PatientsTab({ clinicId }: { clinicId: string }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("patients")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    setPatients(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from("patients").insert({
      clinic_id: clinicId,
      full_name: name,
      phone,
      age: age ? Number(age) : null,
      gender,
    });
    setSaving(false);
    setName("");
    setPhone("");
    setAge("");
    setGender("");
    setShowForm(false);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Patients</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add patient"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-5 mb-5 grid grid-cols-2 gap-3">
          <input
            className="input col-span-2"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="input"
            placeholder="Age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
          <select
            className="input"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="">Gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary col-span-2"
          >
            {saving ? "Saving…" : "Save patient"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-line">
        {patients.length === 0 && (
          <p className="p-5 text-sm text-ink/60">
            No patients yet — add your first one above.
          </p>
        )}
        {patients.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{p.full_name}</p>
              <p className="text-sm text-ink/60">
                {p.phone || "No phone"} · {p.age ? `${p.age} yrs` : "—"} ·{" "}
                {p.gender || "—"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
