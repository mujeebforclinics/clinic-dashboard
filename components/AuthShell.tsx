import Link from "next/link";

const POINTS = [
  "Today's visits, patients and doctors in one place",
  "Invoices, payments and dues, largest first",
  "Low stock flagged before it becomes a problem",
  "Where your patients come from, on a map",
];

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-sand">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#06141d] text-white p-12">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-teal/30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-[480px] w-[480px] rounded-full bg-violet/25 blur-[120px]" />
        <Link href="/" className="relative flex items-center gap-3">
          <img src="/muexa.png" alt="Muexa" className="h-11 w-11 rounded-xl" />
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-[0.2em]">MUEXA</div>
            <div className="text-xs text-white/60">Clinic Intelligence</div>
          </div>
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Run your clinic with <span className="text-[#2dd4bf] italic font-display">less work.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-white/80">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2dd4bf] text-[#06141d]">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l4 4 8-9" /></svg>
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">Start free. We set it up for you.</p>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/muexa.png" alt="Muexa" className="h-10 w-10 rounded-xl" />
            <div className="leading-tight">
              <div className="font-bold tracking-[0.18em]">MUEXA</div>
              <div className="text-xs text-ink/60">Clinic Intelligence</div>
            </div>
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-ink/60">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <p className="mt-6 text-center text-sm text-ink/60">{footer}</p>
        </div>
      </section>
    </main>
  );
}
