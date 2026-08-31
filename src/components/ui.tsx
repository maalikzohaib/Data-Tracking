"use client";

import { ReactNode } from "react";
import { Inbox } from "lucide-react";

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
    <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
      <div>
        <h1 className="text-heading-xl text-text tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-caption text-muted mt-1">{subtitle}</p>}
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
  icon: ReactNode;
  tone?: "brand" | "good" | "bad" | "warn" | "accent";
}) {
  const iconBg: Record<string, string> = {
    brand: "bg-text text-bg",
    good: "bg-aloe text-black",
    bad: "bg-bad/10 text-bad",
    warn: "bg-warn/10 text-warn",
    accent: "bg-pistachio text-black",
  };
  return (
    <div className="card p-5 group hover:-translate-y-0.5 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-eyebrow text-muted uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-semibold mt-2 tabular-nums text-text">{value}</div>
          {sub && <div className="text-micro text-muted mt-1">{sub}</div>}
        </div>
        <div
          className={`h-10 w-10 rounded-shopify-lg flex items-center justify-center shrink-0 ${iconBg[tone]}`}
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
    <div className={`card p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-5">
          {title && <h3 className="text-heading-md text-text">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Pill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-aloe text-black",
    completed: "bg-aloe text-black",
    delivered: "bg-aloe text-black",
    fulfilled: "bg-aloe text-black",
    shipped: "bg-pistachio text-black",
    processing: "bg-warn/15 text-warn",
    pending: "bg-warn/15 text-warn",
    unfulfilled: "bg-warn/15 text-warn",
    returned: "bg-bad/15 text-bad",
    refunded: "bg-bad/15 text-bad",
    cancelled: "bg-bad/15 text-bad",
  };
  const cls = map[status?.toLowerCase()] || "bg-shade-30 text-text";
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
    <div className="inline-flex rounded-pill bg-panel2 border border-border p-1">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-pill transition-all ${
            value === o.v
              ? "bg-text text-bg"
              : "text-muted hover:text-text"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-muted text-caption flex flex-col items-center justify-center">
      <Inbox className="w-8 h-8 mb-2 opacity-40 stroke-[1.5]" />
      <span>{text}</span>
    </div>
  );
}
