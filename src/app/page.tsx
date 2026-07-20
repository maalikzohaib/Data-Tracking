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
    otherExpenses: number;
    grossProfit: number;
    netProfit: number;
    roas: number;
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
          {/* Top stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Total Revenue"
              value={fmtPKR(o?.revenue ?? 0)}
              sub={`${fmtNum(o?.orders ?? 0)} orders`}
              icon="💰"
              tone="brand"
            />
            <StatCard
              label="Net Profit"
              value={fmtPKR(o?.netProfit ?? 0)}
              sub={`Gross ${fmtCompact(o?.grossProfit ?? 0)}`}
              icon="📈"
              tone={(o?.netProfit ?? 0) >= 0 ? "good" : "bad"}
            />
            <StatCard
              label="Ad Spend (Meta)"
              value={fmtPKR(o?.adSpend ?? 0)}
              sub={`ROAS ${(o?.roas ?? 0).toFixed(2)}x`}
              icon="📣"
              tone="accent"
            />
            <StatCard
              label="Cash Balance"
              value={fmtPKR(o?.cashBalance ?? 0)}
              sub={`Inventory ${fmtCompact(o?.inventoryValue ?? 0)}`}
              icon="💵"
              tone={(o?.cashBalance ?? 0) >= 0 ? "good" : "warn"}
            />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatCard label="Avg Order Value" value={fmtPKR(o?.aov ?? 0)} icon="🧮" tone="brand" />
            <StatCard label="COGS" value={fmtPKR(o?.cogs ?? 0)} icon="📦" tone="warn" />
            <StatCard label="COD Charges" value={fmtPKR(o?.codCharges ?? 0)} icon="🚚" tone="accent" />
            <StatCard
              label="Low Stock Items"
              value={fmtNum(o?.lowStockCount ?? 0)}
              sub={`Pending COD ${fmtCompact(o?.pendingCod ?? 0)}`}
              icon="⚠️"
              tone={(o?.lowStockCount ?? 0) > 0 ? "bad" : "good"}
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
                <EmptyState text="Abhi data nahi hai. Settings se sync chalao." />
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
