"use client";

import type { ReactNode } from "react";
import type { TabKey } from "@/lib/types";

const I = (d: string) => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const ICONS: Record<TabKey, ReactNode> = {
  overview: I("M3 13h7V4H3v9zm0 7h7v-5H3v5zm11 0h7V11h-7v9zm0-16v5h7V4h-7z"),
  appointments: I("M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"),
  patients: I("M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0"),
  billing: I("M3 7h18v12H3zM3 11h18M7 15h3"),
  inventory: I("M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"),
  growth: I("M3 17l6-6 4 4 8-8M15 7h6v6"),
};

const GROUPS: { label: string; items: { key: TabKey; label: string; badge?: string }[] }[] = [
  {
    label: "Run the clinic",
    items: [
      { key: "overview", label: "Overview" },
      { key: "appointments", label: "Appointments" },
      { key: "patients", label: "Patients" },
      { key: "billing", label: "Billing" },
      { key: "inventory", label: "Inventory" },
    ],
  },
  {
    label: "Grow the clinic",
    items: [{ key: "growth", label: "Growth", badge: "New" }],
  },
];

export default function Sidebar({
  activeTab,
  onSelect,
  open,
  onClose,
  clinicName,
  clinicType,
}: {
  activeTab: TabKey;
  onSelect: (key: TabKey) => void;
  open: boolean;
  onClose: () => void;
  clinicName: string;
  clinicType: string | null;
}) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 shrink-0 text-white flex flex-col z-50 transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={{ background: "linear-gradient(180deg,#06141d 0%,#0B2636 100%)" }}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal to-[#2dd4bf] flex items-center justify-center font-display font-semibold text-sm shrink-0 shadow-lg shadow-teal/30">
            {clinicName.trim().slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm truncate">{clinicName}</p>
            <p className="text-xs text-white/40 truncate">{clinicType || "Clinic"}</p>
          </div>
          <button className="ml-auto lg:hidden text-white/60 text-2xl leading-none px-1" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Main">
          {GROUPS.map((g) => (
            <div key={g.label} className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">{g.label}</p>
              <div className="space-y-1">
                {g.items.map((item) => {
                  const active = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => onSelect(item.key)}
                      aria-current={active ? "page" : undefined}
                      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-[#2dd4bf]" />}
                      <span className={active ? "text-[#2dd4bf]" : ""}>{ICONS[item.key]}</span>
                      {item.label}
                      {item.badge && (
                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-clay/90 text-white">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-2">
          <img src="/muexa.png" alt="" className="w-5 h-5 rounded" />
          <p className="text-[11px] text-white/40 leading-relaxed">Muexa Clinic Intelligence</p>
        </div>
      </aside>
    </>
  );
}
