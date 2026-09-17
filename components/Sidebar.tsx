"use client";

import type { TabKey } from "@/lib/types";

const NAV: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "appointments", label: "Appointments", icon: "📅" },
  { key: "patients", label: "Patients", icon: "🧑‍🤝‍🧑" },
  { key: "billing", label: "Billing", icon: "💳" },
  { key: "inventory", label: "Inventory", icon: "📦" },
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
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 shrink-0 bg-ink text-white flex flex-col z-50 transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <span className="w-9 h-9 rounded-xl bg-teal flex items-center justify-center font-display font-semibold text-sm shrink-0">
            {clinicName.trim().slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm truncate">{clinicName}</p>
            <p className="text-xs text-white/40 truncate">{clinicType || "Clinic"}</p>
          </div>
          <button
            className="ml-auto lg:hidden text-white/60 text-2xl leading-none px-1"
            onClick={onClose}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">
            Menu
          </p>
          {NAV.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? "bg-teal text-white shadow-sm"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-[11px] text-white/30 leading-relaxed">
            Clinic Intelligence
          </p>
        </div>
      </aside>
    </>
  );
}
