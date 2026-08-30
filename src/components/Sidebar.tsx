"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  {
    label: "Overview",
    items: [
      { href: "/orders", label: "Orders / Sales", icon: "🛒" },
      { href: "/dashboard", label: "Dashboard", icon: "📊" },
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
      { href: "/cod", label: "COD Charges", icon: "🚚" },
    ],
  },
  {
    label: "Extra",
    items: [
      { href: "/inventory", label: "Inventory", icon: "📦" },
      { href: "/settings", label: "Settings", icon: "⚙️" },
    ],
  },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  // Hide on login page
  if (pathname === "/login") return null;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-out Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-panel border-r border-border shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border bg-panel2">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="font-display font-bold leading-tight tracking-tight text-text">
                Navigation
              </div>
              <div className="text-[11px] text-muted">Select a section</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-panel border border-transparent hover:border-border transition"
            title="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                {g.label}
              </div>
              <div className="space-y-1">
                {g.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                        active
                          ? "text-white shadow-glow bg-brand font-semibold"
                          : "text-muted hover:text-text hover:bg-panel2"
                      }`}
                      style={
                        active
                          ? {
                              backgroundImage:
                                "linear-gradient(135deg, #10b981, #059669)",
                            }
                          : undefined
                      }
                    >
                      <span className="text-lg">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-border bg-panel2 text-[11px] text-muted flex items-center justify-between">
          <span>Business Tracker v1.0</span>
          <span className="text-brand-light font-semibold">Online</span>
        </div>
      </aside>
    </>
  );
}

function LogoMark() {
  return (
    <div
      className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold shadow-glow font-display"
      style={{ backgroundImage: "linear-gradient(135deg, #10b981, #f5c451)" }}
    >
      B
    </div>
  );
}
