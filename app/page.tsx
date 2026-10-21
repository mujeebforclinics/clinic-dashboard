import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Muexa | Clinic software that runs your clinic and grows it",
  description:
    "Appointments, patients, billing and inventory in one calm dashboard, plus Google reviews, local SEO and ads. Start free.",
};

// Add your Muexa contact here (a Muexa email or a WhatsApp link).
// While empty, the "Talk to us" buttons are hidden.
const CONTACT_HREF = "";

const RUN = [
  { t: "Appointments", d: "Every doctor, every slot, one calendar. See no shows before they cost you." },
  { t: "Patients", d: "Records, visit history and revenue per patient. Find anyone in seconds." },
  { t: "Billing", d: "Invoices, payments and dues. Know who owes you what, today." },
  { t: "Inventory", d: "Stock levels, batches and expiry alerts so nothing runs out or expires." },
  { t: "Owner view", d: "One screen for the numbers that matter, on your phone, wherever you are." },
  { t: "Notes for the owner", d: "Your team leaves you a note. You see it. Nothing gets lost in WhatsApp." },
];

const GROW = [
  { t: "Google reviews", d: "Ask patients with one tap, track your rating, reply to every review." },
  { t: "Google visibility", d: "A clear checklist to help your clinic show up when people search nearby." },
  { t: "Ads that you can measure", d: "Log spend, enquiries and bookings. Know the cost of every new patient." },
  { t: "Content plan", d: "Plan, approve and track posts for Instagram, Facebook and your Google profile." },
];

const STEPS = [
  { n: "01", t: "We set it up for you", d: "Tell us about your clinic. We create your account and import your patient list." },
  { n: "02", t: "Your team works as usual", d: "Nothing new to learn. Appointments and bills go in the way they always did." },
  { n: "03", t: "You see everything", d: "Open one screen and know how your clinic is doing, in under a minute." },
];

const FAQ = [
  { q: "Is it really free to start?", a: "Yes. Start free and see it on your own clinic first." },
  { q: "Will you move my existing patients over?", a: "Yes. Send us your list and we import it for you." },
  { q: "Will my staff need training?", a: "Very little. It follows the way a front desk already works." },
  { q: "Can you guarantee the first spot on Google?", a: "No one honestly can. We help you do the things that improve your chances, and show you the progress." },
];

function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(closest-side,#2dd4bf55,transparent)" }} />
      <div className="absolute top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(closest-side,#ff7a6655,transparent)" }} />
    </div>
  );
}

function Preview() {
  const bars = [38, 52, 44, 68, 60, 82, 74];
  return (
    <div className="relative mx-auto mt-14 max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="rounded-2xl bg-[#f4f7f6] p-5 text-[#0B2636]">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold">Welcome back</p>
          <span className="text-xs rounded-full bg-[#0EAA98]/15 text-[#0EAA98] px-3 py-1 font-medium">Today</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Collected today", "₹56,800"],
            ["Still owed", "₹86,400"],
            ["Appointments", "24"],
            ["Low stock", "2 items"],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white p-3 border border-[#dfe6e8]">
              <p className="text-[11px] uppercase tracking-wide text-[#0B2636]/45 font-semibold">{l}</p>
              <p className="text-xl font-semibold mt-1">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-white border border-[#dfe6e8] p-4">
          <p className="text-sm font-medium mb-3">This week</p>
          <div className="flex items-end gap-3 h-24">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#0EAA98] to-[#2dd4bf]" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative bg-[#06141d] text-white font-body overflow-hidden">
      <Glow />

      <header className="relative z-10 max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/muexa.png" alt="" className="w-8 h-8 rounded-lg" />
          <span className="font-display font-semibold text-lg tracking-tight">Muexa</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3 text-sm">
          <a href="#run" className="hidden md:inline px-3 py-2 text-white/60 hover:text-white">Run</a>
          <a href="#grow" className="hidden md:inline px-3 py-2 text-white/60 hover:text-white">Grow</a>
          <a href="#faq" className="hidden md:inline px-3 py-2 text-white/60 hover:text-white">FAQ</a>
          <Link href="/login" className="px-3 py-2 text-white/80 hover:text-white">Log in</Link>
          <Link href="/signup" className="rounded-xl bg-[#2dd4bf] text-[#06141d] font-semibold px-4 py-2 hover:brightness-110 transition">
            Start free
          </Link>
        </nav>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-5 pt-16 sm:pt-24 pb-10 text-center">
        <p className="inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs tracking-wide text-[#2dd4bf] font-medium">
          CLINIC INTELLIGENCE
        </p>
        <h1 className="font-display mt-6 text-4xl sm:text-6xl font-semibold leading-[1.05] tracking-tight">
          Run your clinic with <span className="italic text-[#2dd4bf]">less work.</span>
          <br className="hidden sm:block" /> Grow it with more patients.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-white/65 leading-relaxed">
          Appointments, patients, billing and stock in one calm dashboard. Then Google reviews, local search and ads, so the
          right patients find you.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup" className="rounded-xl bg-[#2dd4bf] text-[#06141d] font-semibold px-7 py-3.5 shadow-lg shadow-[#2dd4bf]/25 hover:brightness-110 transition">
            Start free
          </Link>
          {CONTACT_HREF && (<a href={CONTACT_HREF} className="rounded-xl border border-white/20 px-7 py-3.5 font-medium text-white/90 hover:bg-white/5 transition">Talk to us</a>)}
        </div>
        <p className="mt-4 text-sm text-white/40">See it on your own clinic first.</p>
        <Preview />
      </section>

      <section id="run" className="relative z-10 max-w-6xl mx-auto px-5 py-20">
        <p className="text-[#2dd4bf] text-sm font-medium">Run the clinic</p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-2 max-w-xl">Everything your front desk does, in one place.</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {RUN.map((x) => (
            <div key={x.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/[0.07] transition">
              <div className="w-9 h-9 rounded-xl bg-[#2dd4bf]/15 text-[#2dd4bf] flex items-center justify-center mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf]" />
              </div>
              <p className="font-display font-semibold text-lg">{x.t}</p>
              <p className="text-sm text-white/60 mt-1.5 leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="grow" className="relative z-10 max-w-6xl mx-auto px-5 py-20">
        <div className="rounded-3xl border border-white/10 p-8 sm:p-12" style={{ background: "linear-gradient(135deg,rgba(45,212,191,.10),rgba(255,122,102,.08))" }}>
          <p className="text-[#ff7a66] text-sm font-medium">Grow the clinic</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-2 max-w-xl">Get found. Get reviewed. Get booked.</h2>
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {GROW.map((x) => (
              <div key={x.t} className="rounded-2xl bg-[#06141d]/60 border border-white/10 p-6">
                <p className="font-display font-semibold text-lg">{x.t}</p>
                <p className="text-sm text-white/60 mt-1.5 leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-5 py-20">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold max-w-xl">Live in days, not months.</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 p-6">
              <p className="font-display italic text-[#2dd4bf] text-2xl">{s.n}</p>
              <p className="font-display font-semibold text-lg mt-3">{s.t}</p>
              <p className="text-sm text-white/60 mt-1.5 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="relative z-10 max-w-3xl mx-auto px-5 py-20">
        <h2 className="font-display text-3xl font-semibold text-center">Questions owners ask</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <summary className="cursor-pointer list-none flex justify-between gap-4 font-medium">
                {f.q}
                <span className="text-[#2dd4bf] group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-4xl mx-auto px-5 pb-24">
        <div className="rounded-3xl p-10 sm:p-14 text-center" style={{ background: "linear-gradient(135deg,#0EAA98,#2F7BE8)" }}>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold">Ready to see your clinic in one screen?</h2>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="rounded-xl bg-white text-[#06141d] font-semibold px-7 py-3.5 hover:bg-white/90 transition">
              Start free
            </Link>
            {CONTACT_HREF && (<a href={CONTACT_HREF} className="rounded-xl border border-white/40 px-7 py-3.5 font-medium hover:bg-white/10 transition">Talk to us</a>)}
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-sm text-white/40">
        Muexa Clinic Intelligence
      </footer>
    </main>
  );
}
