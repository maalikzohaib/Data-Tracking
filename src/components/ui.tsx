"use client";

import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6 pt-14 lg:pt-0">
      <div>
        <h1
          className="text-2xl font-display font-bold bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(135deg, #e8efec, #34d399)" }}
        >
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  tone?: "brand" | "good" | "bad" | "warn" | "accent";
}) {
  const tones: Record<string, string> = {
    brand: "linear-gradient(135deg, #10b981, #059669)",
    good: "linear-gradient(135deg, #34d399, #059669)",
    bad: "linear-gradient(135deg, #f87171, #dc2626)",
    warn: "linear-gradient(135deg, #f5c451, #d97706)",
    accent: "linear-gradient(135deg, #f5c451, #e0a92e)",
  };
  return (
    <div className="card p-5 relative overflow-hidden group hover:-translate-y-0.5 transition">
      <div
        className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-2xl"
        style={{ backgroundImage: tones[tone] }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-display font-bold mt-1.5 tabular-nums">{value}</div>
          {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
        </div>
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center text-lg shadow-glow"
          style={{ backgroundImage: tones[tone] }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Pill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-good/15 text-good",
    delivered: "bg-good/15 text-good",
    pending: "bg-warn/15 text-warn",
    unfulfilled: "bg-warn/15 text-warn",
    fulfilled: "bg-good/15 text-good",
    returned: "bg-bad/15 text-bad",
    refunded: "bg-bad/15 text-bad",
    cancelled: "bg-bad/15 text-bad",
  };
  const cls = map[status?.toLowerCase()] || "bg-panel2 text-muted";
  return <span className={`pill ${cls}`}>{status || "—"}</span>;
}

export function RangeTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = [
    { v: "7d", l: "7 Days" },
    { v: "30d", l: "30 Days" },
    { v: "90d", l: "90 Days" },
    { v: "all", l: "All" },
  ];
  return (
    <div className="inline-flex rounded-xl bg-panel2 border border-border p-1">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            value === o.v ? "text-white" : "text-muted hover:text-text"
          }`}
          style={
            value === o.v
              ? { backgroundImage: "linear-gradient(135deg, #10b981, #059669)" }
              : undefined
          }
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-muted text-sm">
      <div className="text-3xl mb-2 opacity-50">📭</div>
      {text}
    </div>
  );
}
