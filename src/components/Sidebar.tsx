"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  LayoutDashboard,
  TrendingUp,
  Receipt,
  Wallet,
  Megaphone,
  Truck,
  Package,
  Settings,
  X,
} from "lucide-react";

const groups = [
  {
    label: "Overview",
    items: [
      { href: "/orders", label: "Orders / Sales", icon: ShoppingCart },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/profit", label: "Profit Report", icon: TrendingUp },
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/cashflow", label: "Cash Flow", icon: Wallet },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/meta", label: "Meta Ads", icon: Megaphone },
      { href: "/cod", label: "COD Charges", icon: Truck },
    ],
  },
  {
    label: "Extra",
    items: [
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/settings", label: "Settings", icon: Settings },
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
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-out Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-panel border-r border-border transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ boxShadow: open ? "0 25px 50px -12px rgba(0,0,0,0.25)" : "none" }}
      >
        {/* Drawer Header */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-pill bg-text flex items-center justify-center text-bg font-semibold text-xs">
              B
            </div>
            <div>
              <div className="font-medium text-sm leading-tight text-text">
                Navigation
              </div>
              <div className="text-micro text-muted">Select a section</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-pill text-muted hover:text-text hover:bg-panel2 border border-transparent hover:border-border transition"
            title="Close menu"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-3 mb-2 text-eyebrow uppercase tracking-wider text-muted">
                {g.label}
              </div>
              <div className="space-y-0.5">
                {groupsNavItems(g.items, pathname, onClose)}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border text-micro text-muted flex items-center justify-between">
          <span>Business Tracker v1.0</span>
          <span className="text-good font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-good inline-block"></span>
            Online
          </span>
        </div>
      </aside>
    </>
  );
}

function groupsNavItems(
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[],
  pathname: string,
  onClose: () => void
) {
  return items.map((item) => {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={`flex items-center gap-3 rounded-pill px-4 py-2 text-sm font-medium transition-all ${
          active
            ? "bg-text text-bg"
            : "text-muted hover:text-text hover:bg-panel2"
        }`}
      >
        <Icon className="w-4 h-4 stroke-[1.75] shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  });
}
