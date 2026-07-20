"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageHeader, Card, EmptyState, StatCard } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtCompact, fmtDate } from "@/lib/format";

type Flow = {
  id: string;
  type: string;
  source: string;
  amount: number;
  note: string | null;
  happenedAt: string;
  balance: number;
};

export default function CashflowPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: "in", source: "Manual", amount: "", note: "" });

  const load = () =>
    apiGet<{ flows: Flow[] }>("/api/cashflow")
      .then((d) => setFlows(d.flows || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!form.amount) return;
    await apiSend("/api/cashflow", "POST", {
      type: form.type,
      source: form.source,
      amount: parseFloat(form.amount),
      note: form.note || undefined,
    });
    setForm({ type: "in", source: "Manual", amount: "", note: "" });
    load();
  }

  const cashIn = flows.filter((f) => f.type === "in").reduce((s, f) => s + f.amount, 0);
  const cashOut = flows.filter((f) => f.type === "out").reduce((s, f) => s + f.amount, 0);
  const balance = cashIn - cashOut;

  // Balance-over-time chart (oldest -> newest).
  const chart = [...flows]
    .reverse()
    .map((f) => ({ date: f.happenedAt.slice(5, 10), balance: Math.round(f.balance) }));

  return (
    <>
      <PageHeader title="Cash Flow" subtitle="Har cash-in aur cash-out ka ledger (auto + manual)" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Cash In" value={fmtPKR(cashIn)} icon="⬇️" tone="good" />
        <StatCard label="Cash Out" value={fmtPKR(cashOut)} icon="⬆️" tone="bad" />
        <StatCard label="Net Balance" value={fmtPKR(balance)} icon="💵" tone={balance >= 0 ? "brand" : "warn"} />
      </div>

      <Card title="Balance Over Time" className="mb-4">
        {chart.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#232b41" />
              <XAxis dataKey="date" stroke="#8b95ad" fontSize={11} />
              <YAxis stroke="#8b95ad" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtPKR(v)} />
              <Area type="monotone" dataKey="balance" stroke="#22d3ee" fill="url(#bal)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Abhi koi cash movement nahi." />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Manual Cash Entry" className="h-fit">
          <div className="space-y-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="in">Cash In</option>
                <option value="out">Cash Out</option>
              </select>
            </div>
            <div>
              <label className="label">Source</label>
              <input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Opening balance" />
            </div>
            <div>
              <label className="label">Amount (PKR)</label>
              <input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Note</label>
              <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btn-primary w-full" onClick={add}>
              Add Entry
            </button>
          </div>
        </Card>

        <Card title="Ledger" className="lg:col-span-2">
          {loading ? (
            <div className="text-muted text-sm py-10 text-center">Loading…</div>
          ) : flows.length === 0 ? (
            <EmptyState text="Ledger khali hai." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="py-3 px-2">Source</th>
                    <th className="py-3 px-2">Note</th>
                    <th className="py-3 px-2 text-right">In</th>
                    <th className="py-3 px-2 text-right">Out</th>
                    <th className="py-3 px-2 text-right">Balance</th>
                    <th className="py-3 px-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((f) => (
                    <tr key={f.id} className="border-b border-border/50 hover:bg-panel2/50">
                      <td className="py-3 px-2">
                        <span className="pill bg-panel2 text-muted">{f.source}</span>
                      </td>
                      <td className="py-3 px-2 text-muted">{f.note || "—"}</td>
                      <td className="py-3 px-2 text-right text-good">{f.type === "in" ? fmtPKR(f.amount) : "—"}</td>
                      <td className="py-3 px-2 text-right text-bad">{f.type === "out" ? fmtPKR(f.amount) : "—"}</td>
                      <td className="py-3 px-2 text-right font-semibold">{fmtPKR(f.balance)}</td>
                      <td className="py-3 px-2 text-right text-muted">{fmtDate(f.happenedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

const tooltipStyle = {
  background: "#111726",
  border: "1px solid #232b41",
  borderRadius: 12,
  color: "#e6e9f0",
  fontSize: 12,
};
