"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { PageHeader, Card, EmptyState, StatCard } from "@/components/ui";
import { apiGet } from "@/lib/client";
import { fmtPKR, fmtCompact, fmtNum, fmtDate } from "@/lib/format";

type Daily = {
  id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  reach: number;
};
type Weekly = {
  week: string;
  spend: number;
  revenue: number;
  purchases: number;
  clicks: number;
  impressions: number;
};

export default function MetaPage() {
  const [daily, setDaily] = useState<Daily[]>([]);
  const [weekly, setWeekly] = useState<Weekly[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    apiGet<{ daily: Daily[]; weekly: Weekly[] }>("/api/meta?days=90")
      .then((d) => {
        setDaily(d.daily || []);
        setWeekly(d.weekly || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalSpend = daily.reduce((s, d) => s + d.spend, 0);
  const totalRev = daily.reduce((s, d) => s + d.revenue, 0);
  const totalPurch = daily.reduce((s, d) => s + d.purchases, 0);
  const roas = totalSpend ? totalRev / totalSpend : 0;
  const cpp = totalPurch ? totalSpend / totalPurch : 0;

  const chartData = [...daily].reverse().map((d) => ({
    label: d.date.slice(5),
    spend: Math.round(d.spend),
    revenue: Math.round(d.revenue),
    roas: d.spend ? +(d.revenue / d.spend).toFixed(2) : 0,
  }));

  return (
    <>
      <PageHeader title="Meta Ads" subtitle="Facebook / Instagram ads — daily & weekly (auto-synced)" />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Spend" value={fmtPKR(totalSpend)} icon="📣" tone="accent" />
        <StatCard label="Ad Revenue" value={fmtPKR(totalRev)} icon="💰" tone="brand" />
        <StatCard label="ROAS" value={`${roas.toFixed(2)}x`} sub={`${fmtNum(totalPurch)} purchases`} icon="📈" tone={roas >= 1 ? "good" : "bad"} />
        <StatCard label="Cost / Purchase" value={fmtPKR(cpp)} icon="🎯" tone="warn" />
      </div>

      <Card title="Spend vs Revenue vs ROAS" className="mb-4">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232b41" />
              <XAxis dataKey="label" stroke="#8b95ad" fontSize={11} />
              <YAxis yAxisId="left" stroke="#8b95ad" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
              <YAxis yAxisId="right" orientation="right" stroke="#8b95ad" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar yAxisId="left" dataKey="spend" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Spend" />
              <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue" />
              <Line yAxisId="right" type="monotone" dataKey="roas" stroke="#34d399" strokeWidth={2} name="ROAS (x)" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Meta ads data nahi mila. Settings se sync chalao ya token check karo." />
        )}
      </Card>

      <Card
        title="Reports"
        action={
          <div className="inline-flex rounded-xl bg-panel2 border border-border p-1">
            {(["daily", "weekly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition ${
                  tab === t ? "text-white" : "text-muted"
                }`}
                style={tab === t ? { backgroundImage: "linear-gradient(135deg,#6366f1,#4f46e5)" } : undefined}
              >
                {t}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="text-muted text-sm py-10 text-center">Loading…</div>
        ) : tab === "daily" ? (
          daily.length === 0 ? (
            <EmptyState text="Koi daily record nahi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="py-3 px-2">Date</th>
                    <th className="py-3 px-2 text-right">Spend</th>
                    <th className="py-3 px-2 text-right">Revenue</th>
                    <th className="py-3 px-2 text-right">ROAS</th>
                    <th className="py-3 px-2 text-right">Purchases</th>
                    <th className="py-3 px-2 text-right">Clicks</th>
                    <th className="py-3 px-2 text-right">Impressions</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-panel2/50">
                      <td className="py-3 px-2">{fmtDate(d.date)}</td>
                      <td className="py-3 px-2 text-right">{fmtPKR(d.spend)}</td>
                      <td className="py-3 px-2 text-right">{fmtPKR(d.revenue)}</td>
                      <td className="py-3 px-2 text-right font-medium">
                        {d.spend ? (d.revenue / d.spend).toFixed(2) : "0"}x
                      </td>
                      <td className="py-3 px-2 text-right">{d.purchases}</td>
                      <td className="py-3 px-2 text-right text-muted">{fmtNum(d.clicks)}</td>
                      <td className="py-3 px-2 text-right text-muted">{fmtNum(d.impressions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : weekly.length === 0 ? (
          <EmptyState text="Koi weekly record nahi." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-3 px-2">Week</th>
                  <th className="py-3 px-2 text-right">Spend</th>
                  <th className="py-3 px-2 text-right">Revenue</th>
                  <th className="py-3 px-2 text-right">ROAS</th>
                  <th className="py-3 px-2 text-right">Purchases</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((w) => (
                  <tr key={w.week} className="border-b border-border/50 hover:bg-panel2/50">
                    <td className="py-3 px-2 font-medium">{w.week}</td>
                    <td className="py-3 px-2 text-right">{fmtPKR(w.spend)}</td>
                    <td className="py-3 px-2 text-right">{fmtPKR(w.revenue)}</td>
                    <td className="py-3 px-2 text-right font-medium">
                      {w.spend ? (w.revenue / w.spend).toFixed(2) : "0"}x
                    </td>
                    <td className="py-3 px-2 text-right">{w.purchases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
