"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Section = "reviews" | "seo" | "ads" | "content";

type Review = {
  id: string;
  author_name: string | null;
  rating: number;
  comment: string | null;
  reply_text: string | null;
  replied_at: string | null;
  created_at: string;
};
type SeoTask = { id: string; title: string; category: string; status: "todo" | "doing" | "done" };
type Campaign = {
  id: string;
  name: string;
  channel: string;
  budget: number | null;
  spend: number | null;
  leads: number | null;
  bookings: number | null;
  status: string;
};
type Post = { id: string; platform: string; caption: string | null; status: string; scheduled_for: string | null };

const STARTER_SEO: { title: string; category: string }[] = [
  { title: "Claim and verify your Google Business Profile", category: "google_profile" },
  { title: "Add opening hours, phone, address and services", category: "google_profile" },
  { title: "Upload at least 10 real clinic photos (with consent where people appear)", category: "google_profile" },
  { title: "Ask every happy patient for a Google review", category: "reviews" },
  { title: "Reply to every review, good or bad", category: "reviews" },
  { title: "One website page for each treatment you offer", category: "website" },
  { title: "One page for each area you serve", category: "website" },
  { title: "Make sure the website loads fast on mobile", category: "website" },
  { title: "Post twice a week on Instagram or Google profile", category: "content" },
];

const money = (n: number | null | undefined) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;

function useRows<T>(table: string, clinicId: string, order = "created_at") {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from(table)
      .select("*")
      .eq("clinic_id", clinicId)
      .order(order, { ascending: false });
    if (err) {
      // Table missing until the growth SQL has been run
      if (err.code === "42P01" || err.code === "PGRST205" || /does not exist|schema cache/i.test(err.message)) {
        setSetupNeeded(true);
      } else {
        setError(err.message);
      }
    } else {
      setRows((data ?? []) as T[]);
      setSetupNeeded(false);
      setError(null);
    }
    setLoading(false);
  }, [table, clinicId, order]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, setupNeeded, error, reload: load };
}

function Setup() {
  return (
    <div className="card p-8 text-center max-w-lg mx-auto">
      <p className="font-display text-lg font-semibold mb-1">Growth is almost ready</p>
      <p className="text-sm text-ink/60">
        This part of your account is being switched on. Please check back shortly, or contact Muexa and we will finish
        the setup for you.
      </p>
    </div>
  );
}

function Empty({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center">
      <p className="font-display font-semibold">{title}</p>
      <p className="text-sm text-ink/55 mt-1 mb-4 max-w-md mx-auto">{text}</p>
      {children}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-ink/45 font-semibold">{label}</p>
      <p className="font-display text-2xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs text-ink/45 mt-0.5">{hint}</p>}
    </div>
  );
}

const Stars = ({ n }: { n: number }) => (
  <span className="text-[#f5a623] tracking-tight" aria-label={`${n} out of 5`}>
    {"★".repeat(n)}
    <span className="text-line">{"★".repeat(5 - n)}</span>
  </span>
);

/* ---------------------------- Reviews ---------------------------- */
function Reviews({ clinicId }: { clinicId: string }) {
  const { rows, loading, setupNeeded, error, reload } = useRows<Review>("google_reviews", clinicId);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ author_name: "", rating: 5, comment: "" });
  const [reply, setReply] = useState<Record<string, string>>({});
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  const avg = useMemo(() => (rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0), [rows]);
  const unreplied = rows.filter((r) => !r.reply_text).length;

  if (loading) return <p className="text-sm text-ink/50">Loading…</p>;
  if (setupNeeded) return <Setup />;

  const add = async () => {
    const { error: err } = await supabase.from("google_reviews").insert({
      clinic_id: clinicId,
      author_name: form.author_name || null,
      rating: form.rating,
      comment: form.comment || null,
    });
    if (!err) {
      setForm({ author_name: "", rating: 5, comment: "" });
      setAdding(false);
      reload();
    }
  };
  const saveReply = async (id: string) => {
    const text = (reply[id] ?? "").trim();
    if (!text) return;
    await supabase.from("google_reviews").update({ reply_text: text, replied_at: new Date().toISOString() }).eq("id", id);
    reload();
  };

  const msg = `Hi, thank you for visiting us. If you were happy with your visit, a quick Google review would mean a lot to our team.${
    link ? " " + link : ""
  }`;

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="text-sm text-clay">{error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Average rating" value={rows.length ? avg.toFixed(1) : "None yet"} hint={rows.length ? `${rows.length} reviews logged` : "Log your first review"} />
        <Stat label="Waiting for a reply" value={String(unreplied)} hint="Reply within 48 hours" />
        <div className="col-span-2 sm:col-span-1">
          <Stat label="5 star reviews" value={String(rows.filter((r) => r.rating === 5).length)} />
        </div>
      </div>

      <div className="card p-5">
        <p className="font-display font-semibold">Ask patients for a review</p>
        <p className="text-sm text-ink/55 mb-3">Paste your Google review link, then copy this message into WhatsApp.</p>
        <input className="input w-full mb-3" placeholder="Your Google review link" value={link} onChange={(e) => setLink(e.target.value)} />
        <div className="rounded-xl bg-sand p-3 text-sm text-ink/75">{msg}</div>
        <button
          className="btn-primary mt-3"
          onClick={() => {
            navigator.clipboard?.writeText(msg).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
        >
          {copied ? "Copied" : "Copy message"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-display font-semibold">Reviews</p>
        <button className="btn-ghost text-sm" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancel" : "Log a review"}
        </button>
      </div>

      {adding && (
        <div className="card p-5 grid gap-3">
          <input className="input" placeholder="Reviewer name" value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
          <select className="input" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n} stars</option>
            ))}
          </select>
          <textarea className="input" rows={3} placeholder="What did they write?" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          <button className="btn-primary justify-self-start" onClick={add}>Save review</button>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="No reviews logged yet" text="Log the reviews your clinic already has on Google so you can see your rating and reply to each one in one place." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Stars n={r.rating} />
                <span className="text-sm font-medium">{r.author_name || "Patient"}</span>
              </div>
              {r.comment && <p className="text-sm text-ink/70">{r.comment}</p>}
              {r.reply_text ? (
                <p className="mt-3 text-sm rounded-xl bg-teal/10 text-ink/75 p-3">
                  <span className="font-semibold">Your reply: </span>{r.reply_text}
                </p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input className="input flex-1" placeholder="Write a reply" value={reply[r.id] ?? ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} />
                  <button className="btn-primary" onClick={() => saveReply(r.id)}>Reply</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ SEO ------------------------------ */
function Seo({ clinicId }: { clinicId: string }) {
  const { rows, loading, setupNeeded, reload } = useRows<SeoTask>("seo_tasks", clinicId);
  if (loading) return <p className="text-sm text-ink/50">Loading…</p>;
  if (setupNeeded) return <Setup />;

  const done = rows.filter((r) => r.status === "done").length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;

  const seed = async () => {
    await supabase.from("seo_tasks").insert(STARTER_SEO.map((t) => ({ ...t, clinic_id: clinicId, status: "todo" })));
    reload();
  };
  const toggle = async (t: SeoTask) => {
    await supabase.from("seo_tasks").update({ status: t.status === "done" ? "todo" : "done" }).eq("id", t.id);
    reload();
  };

  return (
    <div className="space-y-5">
      {rows.length === 0 ? (
        <Empty title="Get found on Google" text="Start with a checklist of the steps that matter most for local clinics. Tick each one off as it is done.">
          <button className="btn-primary" onClick={seed}>Add starter checklist</button>
        </Empty>
      ) : (
        <>
          <div className="card p-5">
            <div className="flex items-end justify-between mb-2">
              <p className="font-display font-semibold">Google visibility checklist</p>
              <p className="text-sm text-ink/55">{done} of {rows.length} done</p>
            </div>
            <div className="h-2 rounded-full bg-sand overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-teal to-[#2dd4bf]" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="card divide-y divide-line">
            {rows.map((t) => (
              <label key={t.id} className="flex items-start gap-3 p-4 cursor-pointer">
                <input type="checkbox" className="mt-1 accent-[#0EAA98]" checked={t.status === "done"} onChange={() => toggle(t)} />
                <span className={`text-sm ${t.status === "done" ? "line-through text-ink/40" : "text-ink/80"}`}>{t.title}</span>
              </label>
            ))}
          </div>
        </>
      )}
      <p className="text-xs text-ink/45">Good local SEO improves your chances of showing up in Google Maps. No one can promise a fixed position.</p>
    </div>
  );
}

/* ------------------------------ Ads ------------------------------ */
function Ads({ clinicId }: { clinicId: string }) {
  const { rows, loading, setupNeeded, reload } = useRows<Campaign>("campaigns", clinicId);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: "", channel: "google_ads", budget: "", spend: "", leads: "", bookings: "" });
  if (loading) return <p className="text-sm text-ink/50">Loading…</p>;
  if (setupNeeded) return <Setup />;

  const tot = rows.reduce(
    (a, r) => ({ spend: a.spend + (r.spend ?? 0), leads: a.leads + (r.leads ?? 0), bookings: a.bookings + (r.bookings ?? 0) }),
    { spend: 0, leads: 0, bookings: 0 }
  );
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const save = async () => {
    if (!f.name.trim()) return;
    await supabase.from("campaigns").insert({
      clinic_id: clinicId,
      name: f.name.trim(),
      channel: f.channel,
      budget: num(f.budget),
      spend: num(f.spend),
      leads: num(f.leads),
      bookings: num(f.bookings),
      status: "active",
    });
    setF({ name: "", channel: "google_ads", budget: "", spend: "", leads: "", bookings: "" });
    setAdding(false);
    reload();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Spend" value={money(tot.spend)} />
        <Stat label="Enquiries" value={String(tot.leads)} />
        <Stat label="Bookings" value={String(tot.bookings)} />
        <Stat label="Cost per booking" value={tot.bookings ? money(tot.spend / tot.bookings) : "None yet"} />
      </div>
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold">Campaigns</p>
        <button className="btn-ghost text-sm" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "Add campaign"}</button>
      </div>
      {adding && (
        <div className="card p-5 grid sm:grid-cols-2 gap-3">
          <input className="input sm:col-span-2" placeholder="Campaign name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
            <option value="google_ads">Google Ads</option>
            <option value="meta_ads">Facebook and Instagram Ads</option>
            <option value="instagram">Instagram</option>
            <option value="email">Email</option>
          </select>
          <input className="input" inputMode="numeric" placeholder="Budget" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Spent so far" value={f.spend} onChange={(e) => setF({ ...f, spend: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Enquiries" value={f.leads} onChange={(e) => setF({ ...f, leads: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Bookings" value={f.bookings} onChange={(e) => setF({ ...f, bookings: e.target.value })} />
          <button className="btn-primary justify-self-start" onClick={save}>Save campaign</button>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty title="No campaigns yet" text="Add each ad campaign you run, with what you spent and how many bookings it brought. You will see which one is worth the money." />
      ) : (
        <div className="card divide-y divide-line">
          {rows.map((c) => (
            <div key={c.id} className="p-4 flex flex-wrap items-center gap-x-6 gap-y-1">
              <div className="min-w-[10rem] flex-1">
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-ink/45">{c.channel.replace("_", " ")}</p>
              </div>
              <p className="text-sm text-ink/70">{money(c.spend)} spent</p>
              <p className="text-sm text-ink/70">{c.leads ?? 0} enquiries</p>
              <p className="text-sm font-medium text-teal">{c.bookings ?? 0} bookings</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Content ---------------------------- */
function Content({ clinicId }: { clinicId: string }) {
  const { rows, loading, setupNeeded, reload } = useRows<Post>("content_posts", clinicId);
  const [f, setF] = useState({ platform: "instagram", caption: "" });
  if (loading) return <p className="text-sm text-ink/50">Loading…</p>;
  if (setupNeeded) return <Setup />;

  const add = async () => {
    if (!f.caption.trim()) return;
    await supabase.from("content_posts").insert({ clinic_id: clinicId, platform: f.platform, caption: f.caption.trim(), status: "draft" });
    setF({ ...f, caption: "" });
    reload();
  };
  const setStatus = async (id: string, status: string) => {
    await supabase.from("content_posts").update({ status }).eq("id", id);
    reload();
  };
  const labels: Record<string, string> = { draft: "Draft", needs_approval: "Needs approval", approved: "Approved", posted: "Posted" };

  return (
    <div className="space-y-5">
      <div className="card p-5 grid gap-3">
        <p className="font-display font-semibold">Plan a post</p>
        <select className="input" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
          <option value="google_profile">Google profile</option>
        </select>
        <textarea className="input" rows={3} placeholder="Write the caption" value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} />
        <button className="btn-primary justify-self-start" onClick={add}>Add to plan</button>
      </div>
      {rows.length === 0 ? (
        <Empty title="Your content plan is empty" text="Add the posts you want to publish. Move each one from draft to approved to posted." />
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/45">{p.platform.replace("_", " ")}</span>
                <select className="input !py-1 !px-2 text-sm w-auto" value={p.status} onChange={(e) => setStatus(p.id, e.target.value)}>
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-ink/75 whitespace-pre-wrap">{p.caption}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Shell ----------------------------- */
const SECTIONS: { key: Section; label: string }[] = [
  { key: "reviews", label: "Google reviews" },
  { key: "seo", label: "Google visibility" },
  { key: "ads", label: "Ads" },
  { key: "content", label: "Content" },
];

export default function GrowthTab({ clinicId }: { clinicId: string }) {
  const [section, setSection] = useState<Section>("reviews");
  return (
    <div className="space-y-5 pb-10">
      <div role="tablist" className="flex gap-1 p-1 rounded-2xl bg-white border border-line w-full sm:w-fit overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={section === s.key}
            onClick={() => setSection(s.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              section === s.key ? "bg-ink text-white shadow" : "text-ink/60 hover:bg-sand"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "reviews" && <Reviews clinicId={clinicId} />}
      {section === "seo" && <Seo clinicId={clinicId} />}
      {section === "ads" && <Ads clinicId={clinicId} />}
      {section === "content" && <Content clinicId={clinicId} />}
    </div>
  );
}
