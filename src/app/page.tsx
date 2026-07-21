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

const PIE_COLORS = ["#10b981", "#f5c451", "#f87171", "#fbbf24", "#34d399", "#5eead4", "#fb923c"];

export default function DashboardPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
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
  }, [range]);

  const o = data?.overview;
  const netProfit = o?.netProfit ?? 0;
  const revenue = o?.revenue ?? 0;
  const margin = revenue ? (netProfit / revenue) * 100 : 0;
  const profitPositive = netProfit >= 0;

  // Profit formula ke tukde (revenue se kya kya minus hua).
  const costParts = [
    { label: "COGS", value: o?.cogs ?? 0, color: "#f5c451" },
    { label: "Ad Spend", value: o?.adSpend ?? 0, color: "#5eead4" },
    { label: "COD", value: o?.codCharges ?? 0, color: "#fb923c" },
    { label: "Shipping", value: o?.shipping ?? 0, color: "#f87171" },
    { label: "Expenses", value: o?.otherExpenses ?? 0, color: "#a78bfa" },
  ].filter((p) => p.value > 0);
  const totalCosts = costParts.reduce((s, p) => s + p.value, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Business ki poori tasveer — ek nazar mein"
        action={<RangeTabs value={range} onChange={setRange} />}
      />

      {error && (
        <div className="card p-4 mb-6 border-bad/40 bg-bad/10 text-sm">
          <strong className="text-bad">Data load nahi hua.</strong>{" "}
          <span className="text-muted">{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="text-muted text-sm py-20 text-center">Loading…</div>
      ) : (
        <>
          {/* Hero: Net Profit banner with formula breakdown */}
          <div
            className="card p-6 mb-4 relative overflow-hidden"
            style={{
              backgroundImage: profitPositive
                ? "radial-gradient(120% 140% at 0% 0%, rgba(16,185,129,0.16), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(245,196,81,0.10), transparent 50%)"
                : "radial-gradient(120% 140% at 0% 0%, rgba(248,113,113,0.16), transparent 55%)",
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted">Net Profit</div>
                <div
                  className={`text-4xl font-display font-bold mt-1 ${
                    profitPositive ? "text-good" : "text-bad"
                  }`}
                >
                  {fmtPKR(netProfit)}
                </div>
                <div className="text-sm text-muted mt-1">
                  Revenue {fmtPKR(revenue)} · Margin{" "}
                  <span className={profitPositive ? "text-good" : "text-bad"}>
                    {margin.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-xs text-muted">Gross Profit</div>
                  <div className="text-xl font-semibold mt-0.5">{fmtCompact(o?.grossProfit ?? 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Total Costs</div>
                  <div className="text-xl font-semibold mt-0.5">{fmtCompact(totalCosts)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">ROAS</div>
                  <div className="text-xl font-semibold mt-0.5">{(o?.roas ?? 0).toFixed(2)}x</div>
                </div>
              </div>
            </div>

            {/* Cost composition bar */}
            {totalCosts > 0 && (
              <div className="mt-5">
                <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-panel2">
                  {costParts.map((p) => (
                    <div
                      key={p.label}
                      style={{ width: `${(p.value / totalCosts) * 100}%`, background: p.color }}
                      title={`${p.label}: ${fmtPKR(p.value)}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {costParts.map((p) => (
                    <div key={p.label} className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      {p.label} <span className="text-text">{fmtCompact(p.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Key stats — finance first */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Total Revenue"
              value={fmtPKR(revenue)}
              sub={`${fmtNum(o?.orders ?? 0)} orders`}
              icon="💰"
              tone="brand"
            />
            <StatCard
              label="Cash Balance"
              value={fmtPKR(o?.cashBalance ?? 0)}
              sub={`In ${fmtCompact(o?.cashIn ?? 0)} · Out ${fmtCompact(o?.cashOut ?? 0)}`}
              icon="💵"
              tone={(o?.cashBalance ?? 0) >= 0 ? "good" : "warn"}
            />
            <StatCard
              label="Ad Spend (Meta)"
              value={fmtPKR(o?.adSpend ?? 0)}
              sub={`ROAS ${(o?.roas ?? 0).toFixed(2)}x`}
              icon="📣"
              tone="accent"
            />
            <StatCard
              label="Avg Order Value"
              value={fmtPKR(o?.aov ?? 0)}
              sub={`COD ${fmtCompact(o?.codCharges ?? 0)}`}
              icon="🧮"
              tone="brand"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Card title="Revenue vs Profit (daily)" className="lg:col-span-2">
              {data?.series.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.series}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232e31" />
                    <XAxis dataKey="date" stroke="#8b95ad" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                    <YAxis stroke="#8b95ad" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => fmtPKR(v)}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#rev)" strokeWidth={2} name="Revenue" />
                    <Area type="monotone" dataKey="profit" stroke="#34d399" fill="url(#prof)" strokeWidth={2} name="Profit" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="Abhi data nahi hai. Orders ya ad spend add karo." />
              )}
            </Card>

            <Card title="Kharcha kahan gaya?">
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
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtPKR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="Koi expense record nahi." />
              )}
            </Card>
          </div>

          <Card title="Ad Spend (daily)">
            {data?.series.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232e31" />
                  <XAxis dataKey="date" stroke="#8b95ad" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                  <YAxis stroke="#8b95ad" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtPKR(v)} cursor={{ fill: "#232e3155" }} />
                  <Bar dataKey="adSpend" fill="#f5c451" radius={[6, 6, 0, 0]} name="Ad Spend" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="Meta ads data nahi mila." />
            )}
          </Card>
        </>
      )}
    </>
  );
}

const tooltipStyle = {
  background: "#111726",
  border: "1px solid #232e31",
  borderRadius: 12,
  color: "#e6e9f0",
  fontSize: 12,
};
