"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const groups = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: "📊" },
      { href: "/orders", label: "Orders / Sales", icon: "🛒" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/profit", label: "Profit Report", icon: "💰" },
      { href: "/expenses", label: "Expenses", icon: "🧾" },
      { href: "/cashflow", label: "Cash Flow", icon: "💵" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/meta", label: "Meta Ads", icon: "📈" },
      { href: "/inventory", label: "Inventory", icon: "📦" },
      { href: "/cod", label: "COD Charges", icon: "🚚" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: "⚙️" }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-panel border-b border-border">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="font-semibold">Business Tracker</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn-ghost px-3 py-1.5"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col
        border-r border-border transition-transform
        ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{
          backgroundImage:
            "linear-gradient(180deg, #0d1424 0%, #0a0e1a 100%)",
        }}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-border">
          <LogoMark />
          <div>
            <div className="font-semibold leading-tight">Business Tracker</div>
            <div className="text-[11px] text-muted">Shopify · Meta · PKR</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {g.label}
              </div>
              <div className="space-y-1">
                {g.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition
                      ${
                        active
                          ? "text-white shadow-glow"
                          : "text-muted hover:text-text hover:bg-panel2"
                      }`}
                      style={
                        active
                          ? {
                              backgroundImage:
                                "linear-gradient(135deg, #6366f1, #4f46e5)",
                            }
                          : undefined
                      }
                    >
                      <span className="text-base">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border text-[11px] text-muted">
          Auto-sync every hour · v1.0
        </div>
      </aside>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

function LogoMark() {
  return (
    <div
      className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold shadow-glow"
      style={{ backgroundImage: "linear-gradient(135deg, #6366f1, #22d3ee)" }}
    >
      B
    </div>
  );
}
