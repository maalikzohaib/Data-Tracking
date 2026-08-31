"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { DollarSign, Wallet, Megaphone, Calculator } from "lucide-react";
import { PageHeader, StatCard, Card, RangeTabs, EmptyState } from "@/components/ui";
import { fmtPKR, fmtCompact, fmtNum } from "@/lib/format";

type StatsResponse = {
  overview: {
    revenue: number;
    orders: number;
    aov: number;
    cogs: number;
    adSpend: number;
    codCharges: number;
    shipping: number;
    otherExpenses: number;
    grossProfit: number;
    netProfit: number;
    roas: number;
    cashIn: number;
    cashOut: number;
    cashBalance: number;
    inventoryValue: number;
    lowStockCount: number;
    pendingCod: number;
  };
  series: { date: string; revenue: number; adSpend: number; profit: number }[];
  breakdown: { name: string; value: number }[];
};

const PIE_COLORS = ["#000000", "#3f3f46", "#71717a", "#a1a1aa", "#c1fbd4", "#d4f9e0", "#d4d4d8"];

const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--text)",
  fontSize: 12,
  fontFamily: "Inter, sans-serif",
};

export default function DashboardPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/meta/sync", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        fetch(`/api/stats?range=${range}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.error) setError(d.hint || d.error);
            else {
              setData(d);
              setError(null);
            }
          })
          .catch((e) => setError(String(e)))
          .finally(() => setLoading(false));
      });
  }, [range]);

  const o = data?.overview;
  const netProfit = o?.netProfit ?? 0;
  const revenue = o?.revenue ?? 0;
  const margin = revenue ? (netProfit / revenue) * 100 : 0;
  const profitPositive = netProfit >= 0;

  const costParts = [
    { label: "COGS", value: o?.cogs ?? 0, color: "#3f3f46" },
    { label: "Ad Spend", value: o?.adSpend ?? 0, color: "#71717a" },
    { label: "COD", value: o?.codCharges ?? 0, color: "#a1a1aa" },
    { label: "Shipping", value: o?.shipping ?? 0, color: "#d4d4d8" },
    { label: "Expenses", value: o?.otherExpenses ?? 0, color: "#c1fbd4" },
  ].filter((p) => p.value > 0);
  const totalCosts = costParts.reduce((s, p) => s + p.value, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Business overview and key metrics"
        action={<RangeTabs value={range} onChange={setRange} />}
      />

      {error && (
        <div className="card p-4 mb-6 border-bad/40 bg-bad/8 text-sm">
          <strong className="text-bad">Failed to load stats data.</strong>{" "}
          <span className="text-muted">{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="text-muted text-caption py-20 text-center">Loading…</div>
      ) : (
        <>
          {/* Hero: Net Profit banner */}
          <div
            className={`card p-6 mb-5 ${
              profitPositive ? "bg-pistachio" : "bg-bad/8"
            }`}
            style={{ borderColor: profitPositive ? "#c1fbd4" : undefined }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-eyebrow uppercase tracking-wider text-shade-60 font-medium">Net Profit</div>
                <div
                  className={`text-4xl font-semibold mt-1.5 ${
                    profitPositive ? "text-black" : "text-bad"
                  }`}
                  style={{ fontWeight: 330, letterSpacing: "0.5px" }}
                >
                  {fmtPKR(netProfit)}
                </div>
                <div className="text-caption text-shade-60 mt-1.5">
                  Revenue {fmtPKR(revenue)} · Margin{" "}
                  <span className={`font-semibold ${profitPositive ? "text-black" : "text-bad"}`}>
                    {margin.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex gap-8">
                <div>
                  <div className="text-micro text-shade-50 font-medium">Gross Profit</div>
                  <div className="text-xl font-semibold mt-0.5 text-black">{fmtCompact(o?.grossProfit ?? 0)}</div>
                </div>
                <div>
                  <div className="text-micro text-shade-50 font-medium">Total Costs</div>
                  <div className="text-xl font-semibold mt-0.5 text-black">{fmtCompact(totalCosts)}</div>
                </div>
                <div>
                  <div className="text-micro text-shade-50 font-medium">ROAS</div>
                  <div className="text-xl font-semibold mt-0.5 text-black">{(o?.roas ?? 0).toFixed(2)}x</div>
                </div>
              </div>
            </div>

            {totalCosts > 0 && (
              <div className="mt-5">
                <div className="flex h-2 w-full rounded-pill overflow-hidden bg-white/60">
                  {costParts.map((p) => (
                    <div
                      key={p.label}
                      style={{ width: `${(p.value / totalCosts) * 100}%`, background: p.color }}
                      title={`${p.label}: ${fmtPKR(p.value)}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                  {costParts.map((p) => (
                    <div key={p.label} className="flex items-center gap-1.5 text-micro text-shade-60">
                      <span className="h-2 w-2 rounded-pill" style={{ background: p.color }} />
                      {p.label} <span className="text-black font-medium">{fmtCompact(p.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <StatCard
              label="Total Revenue"
              value={fmtPKR(revenue)}
              sub={`${fmtNum(o?.orders ?? 0)} orders`}
              icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />}
              tone="brand"
            />
            <StatCard
              label="Cash Balance"
              value={fmtPKR(o?.cashBalance ?? 0)}
              sub={`In ${fmtCompact(o?.cashIn ?? 0)} · Out ${fmtCompact(o?.cashOut ?? 0)}`}
              icon={<Wallet className="w-5 h-5 stroke-[1.75]" />}
              tone={(o?.cashBalance ?? 0) >= 0 ? "good" : "warn"}
            />
            <StatCard
              label="Ad Spend (Meta)"
              value={fmtPKR(o?.adSpend ?? 0)}
              sub={`ROAS ${(o?.roas ?? 0).toFixed(2)}x`}
              icon={<Megaphone className="w-5 h-5 stroke-[1.75]" />}
              tone="accent"
            />
            <StatCard
              label="Avg Order Value"
              value={fmtPKR(o?.aov ?? 0)}
              sub={`COD ${fmtCompact(o?.codCharges ?? 0)}`}
              icon={<Calculator className="w-5 h-5 stroke-[1.75]" />}
              tone="brand"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <Card title="Revenue vs Profit (daily)" className="lg:col-span-2">
              {data?.series.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.series}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#000000" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#000000" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c1fbd4" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#c1fbd4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                    <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => fmtPKR(v)}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#000000" fill="url(#rev)" strokeWidth={1.5} name="Revenue" />
                    <Area type="monotone" dataKey="profit" stroke="#16a34a" fill="url(#prof)" strokeWidth={1.5} name="Profit" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No data available yet." />
              )}
            </Card>

            <Card title="Expense Breakdown">
              {data?.breakdown.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.breakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={2}
                    >
                      {data.breakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => fmtPKR(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No expenses recorded." />
              )}
            </Card>
          </div>

          <Card title="Ad Spend (daily)">
            {data?.series.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                  <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => fmtPKR(v)}
                    cursor={{ fill: "var(--border)" }}
                  />
                  <Bar dataKey="adSpend" fill="var(--text)" radius={[6, 6, 0, 0]} name="Ad Spend" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No Meta ad data available." />
            )}
          </Card>
        </>
      )}
    </>
  );
}
