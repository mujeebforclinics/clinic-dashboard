"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NoteForOwner({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSaving(true);
    await supabase.from("staff_notes").insert({
      clinic_id: clinicId,
      message: message.trim(),
      urgency,
    });
    setSaving(false);
    setSent(true);
    setMessage("");
    setUrgency("normal");
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 1200);
  };

  return (
    <div className="relative">
      <button className="btn-ghost text-sm" onClick={() => setOpen(!open)}>
        + Note for owner
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 card p-4 z-30 shadow-lg">
          {sent ? (
            <p className="text-sm text-teal font-medium">Sent ✓</p>
          ) : (
            <>
              <textarea
                className="input mb-2"
                rows={3}
                placeholder="e.g. Ran out of numbing gel, patient waiting on call-back…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setUrgency("normal")}
                  className={`flex-1 text-xs py-1.5 rounded-lg border ${
                    urgency === "normal"
                      ? "bg-teal/10 border-teal text-teal font-medium"
                      : "border-line text-ink/60"
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setUrgency("urgent")}
                  className={`flex-1 text-xs py-1.5 rounded-lg border ${
                    urgency === "urgent"
                      ? "bg-clay/10 border-clay text-clay font-medium"
                      : "border-line text-ink/60"
                  }`}
                >
                  Urgent
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={saving || !message.trim()}
                className="btn-primary w-full text-sm"
              >
                {saving ? "Sending…" : "Send to owner"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
