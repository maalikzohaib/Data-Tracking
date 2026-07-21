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
import { apiGet, apiSend } from "@/lib/client";
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
type Budget = {
  id: string;
  name: string;
  platform: string;
  amount: number;
  period: string;
  note: string | null;
};
type BudgetSummary = {
  totalBudget: number;
  spent: number;
  remaining: number;
  usedPct: number;
};

export default function MetaPage() {
  const [daily, setDaily] = useState<Daily[]>([]);
  const [weekly, setWeekly] = useState<Weekly[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"daily" | "weekly">("daily");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bsum, setBsum] = useState<BudgetSummary | null>(null);
  const [bform, setBform] = useState({ name: "", amount: "", period: "monthly", note: "" });
  const [bsaving, setBsaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [sform, setSform] = useState({ date: today, spend: "", revenue: "", purchases: "" });
  const [ssaving, setSsaving] = useState(false);

  const loadBudgets = () =>
    apiGet<{ budgets: Budget[]; summary: BudgetSummary }>("/api/adbudget").then((d) => {
      setBudgets(d.budgets || []);
      setBsum(d.summary);
    });

  const loadMeta = () =>
    apiGet<{ daily: Daily[]; weekly: Weekly[] }>("/api/meta?days=90").then((d) => {
      setDaily(d.daily || []);
      setWeekly(d.weekly || []);
    });

  useEffect(() => {
    // Page khulte hi pehle Meta se fresh data kheech lo, phir dikhao.
    (async () => {
      try {
        await fetch("/api/meta/sync", { method: "POST" });
      } catch {
        // agar sync fail ho to jo DB mein hai wahi dikha do
      }
      await Promise.all([loadMeta(), loadBudgets()]);
      setLoading(false);
    })();
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  async function refreshMeta() {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch("/api/meta/sync", { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        setRefreshMsg(`✅ ${j.days} din ka data Meta se aa gaya`);
        await Promise.all([loadMeta(), loadBudgets()]);
      } else {
        setRefreshMsg(`❌ ${String(j.error).slice(0, 120)}`);
      }
    } catch (e) {
      setRefreshMsg(`❌ ${String(e)}`);
    }
    setRefreshing(false);
  }

  async function addSpend() {
    if (!sform.date || !sform.spend) return;
    setSsaving(true);
    await apiSend("/api/meta", "POST", {
      date: sform.date,
      spend: parseFloat(sform.spend),
      ...(sform.revenue ? { revenue: parseFloat(sform.revenue) } : {}),
      ...(sform.purchases ? { purchases: parseInt(sform.purchases, 10) } : {}),
    });
    setSform({ date: today, spend: "", revenue: "", purchases: "" });
    await Promise.all([loadMeta(), loadBudgets()]);
    setSsaving(false);
  }

  async function delSpend(id: string) {
    await apiSend(`/api/meta?id=${id}`, "DELETE");
    await Promise.all([loadMeta(), loadBudgets()]);
  }

  async function addBudget() {
    if (!bform.name || !bform.amount) return;
    setBsaving(true);
    await apiSend("/api/adbudget", "POST", {
      name: bform.name,
      amount: parseFloat(bform.amount),
      period: bform.period,
      note: bform.note || undefined,
    });
    setBform({ name: "", amount: "", period: "monthly", note: "" });
    await loadBudgets();
    setBsaving(false);
  }

  async function delBudget(id: string) {
    await apiSend(`/api/adbudget?id=${id}`, "DELETE");
    loadBudgets();
  }

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
      <PageHeader
        title="Meta Ads"
        subtitle="Facebook / Instagram ads — Meta se live fetch hota hai"
        action={
          <div className="flex items-center gap-3">
            {refreshMsg && <span className="text-xs text-muted">{refreshMsg}</span>}
            <button className="btn-primary" onClick={refreshMeta} disabled={refreshing}>
              {refreshing ? "Fetching…" : "🔄 Refresh from Meta"}
            </button>
          </div>
        }
      />

      {loading && (
        <div className="card p-3 mb-4 text-sm text-muted">
          Meta se latest data laa rahe hain…
        </div>
      )}

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
              <CartesianGrid strokeDasharray="3 3" stroke="#232e31" />
              <XAxis dataKey="label" stroke="#8b95ad" fontSize={11} />
              <YAxis yAxisId="left" stroke="#8b95ad" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
              <YAxis yAxisId="right" orientation="right" stroke="#8b95ad" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar yAxisId="left" dataKey="spend" fill="#f5c451" radius={[4, 4, 0, 0]} name="Spend" />
              <Bar yAxisId="left" dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
              <Line yAxisId="right" type="monotone" dataKey="roas" stroke="#34d399" strokeWidth={2} name="ROAS (x)" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Meta ads data nahi mila. Settings se sync chalao ya token check karo." />
        )}
      </Card>

      {/* Ad Budget vs Spent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card title="Naya Ad Budget" className="lg:col-span-1 h-fit">
          <div className="space-y-3">
            <div>
              <label className="label">Name / Period</label>
              <input
                className="input"
                placeholder="e.g. July 2026"
                value={bform.name}
                onChange={(e) => setBform({ ...bform, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Budget (PKR)</label>
              <input
                className="input"
                type="number"
                placeholder="0"
                value={bform.amount}
                onChange={(e) => setBform({ ...bform, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Period</label>
              <select
                className="input"
                value={bform.period}
                onChange={(e) => setBform({ ...bform, period: e.target.value })}
              >
                {["daily", "weekly", "monthly", "campaign"].map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary w-full" onClick={addBudget} disabled={bsaving}>
              {bsaving ? "Saving…" : "Add Budget"}
            </button>
          </div>
        </Card>

        <Card title="Budget vs Spent (Meta actual)" className="lg:col-span-2">
          {bsum && bsum.totalBudget > 0 ? (
            <div className="mb-5">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="text-xs text-muted">Total Allocated</div>
                  <div className="text-xl font-bold">{fmtPKR(bsum.totalBudget)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Spent / Remaining</div>
                  <div className="text-sm font-semibold">
                    {fmtPKR(bsum.spent)} <span className="text-muted">/</span>{" "}
                    <span className={bsum.remaining > 0 ? "text-good" : "text-bad"}>
                      {fmtPKR(bsum.remaining)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-panel2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${bsum.usedPct}%`,
                    backgroundImage:
                      bsum.usedPct >= 90
                        ? "linear-gradient(90deg,#f87171,#dc2626)"
                        : "linear-gradient(90deg,#10b981,#f5c451)",
                  }}
                />
              </div>
              <div className="text-xs text-muted mt-1.5">{bsum.usedPct.toFixed(0)}% used</div>
            </div>
          ) : (
            <EmptyState text="Koi budget set nahi. Left form se add karo." />
          )}

          {budgets.length > 0 && (
            <div className="space-y-2">
              {budgets.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl bg-panel2 border border-border px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium">{b.name}</div>
                    <div className="text-xs text-muted capitalize">
                      {b.platform} · {b.period}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{fmtPKR(b.amount)}</span>
                    <button
                      className="text-bad hover:underline text-xs"
                      onClick={() => delBudget(b.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Manual Ad Spend Entry */}
      <Card
        title="Manual Ad Spend"
        className="mb-4"
      >
        <p className="text-xs text-muted mb-4">
          Jab account se ads ke paise detect hon, yahan add karo. Ye cash-out ledger aur budget mein
          apne aap count ho jayega. (Auto-sync bhi isi ko update karta hai.)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              value={sform.date}
              onChange={(e) => setSform({ ...sform, date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Spend (PKR)</label>
            <input
              className="input"
              type="number"
              placeholder="0"
              value={sform.spend}
              onChange={(e) => setSform({ ...sform, spend: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Revenue (optional)</label>
            <input
              className="input"
              type="number"
              placeholder="0"
              value={sform.revenue}
              onChange={(e) => setSform({ ...sform, revenue: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Purchases (optional)</label>
            <input
              className="input"
              type="number"
              placeholder="0"
              value={sform.purchases}
              onChange={(e) => setSform({ ...sform, purchases: e.target.value })}
            />
          </div>
          <button className="btn-primary" onClick={addSpend} disabled={ssaving}>
            {ssaving ? "Saving…" : "Add / Update"}
          </button>
        </div>
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
                style={tab === t ? { backgroundImage: "linear-gradient(135deg,#10b981,#059669)" } : undefined}
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
                    <th className="py-3 px-2"></th>
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
                      <td className="py-3 px-2 text-right">
                        <button className="text-bad hover:underline text-xs" onClick={() => delSpend(d.id)}>
                          Delete
                        </button>
                      </td>
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
  border: "1px solid #232e31",
  borderRadius: 12,
  color: "#e6e9f0",
  fontSize: 12,
};
