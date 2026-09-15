"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Patient } from "@/lib/types";
import Spinner from "@/components/Spinner";

export default function PatientsTab({ clinicId }: { clinicId: string }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [locality, setLocality] = useState("");
  const [address, setAddress] = useState("");
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
          <input
            className="input"
            placeholder="Locality (e.g. Saket, GK-1)"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
          />
          <input
            className="input col-span-2"
            placeholder="Full address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="col-span-2 text-xs text-ink/50 -mt-1">
            Locality helps the owner see where patients are coming from on the Snapshot panel.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary col-span-2"
          >
            {saving ? (<><Spinner size={14} className="mr-1.5" />Saving</>) : "Save patient"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-line">
        {patients.length === 0 && (
          <p className="p-5 text-sm text-ink/60">
            No patients yet. Add your first one above.
          </p>
        )}
        {patients.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{p.full_name}</p>
              <p className="text-sm text-ink/60">
                {p.phone || "No phone"} · {p.age ? `${p.age} yrs` : "—"} ·{" "}
                {p.gender || "-"}
                {p.locality && (
                  <>
                    {" "}· <span className="text-violet font-medium">{p.locality}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
