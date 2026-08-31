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
import { ArrowDownLeft, ArrowUpRight, Wallet, Landmark } from "lucide-react";
import { PageHeader, Card, EmptyState, StatCard } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtCompact, fmtDate } from "@/lib/format";

type Flow = {
  id: string;
  type: string;
  source: string;
  amount: number;
  note: string | null;
  refId: string | null;
  happenedAt: string;
  balance: number;
};

const AUTO_SOURCES = ["Sales", "Ads", "Shipping", "Expense", "Loan", "Loan Repayment", "COD"];

type Loan = {
  id: string;
  lender: string;
  principal: number;
  repaid: number;
  note: string | null;
  borrowedAt: string;
};

type LoanSummary = { totalBorrowed: number; totalRepaid: number; outstanding: number };

const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--text)",
  fontSize: 12,
  fontFamily: "Inter, sans-serif",
};

export default function CashflowPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: "in", source: "Manual", amount: "", note: "" });
  const [saving, setSaving] = useState(false);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [lsum, setLsum] = useState<LoanSummary | null>(null);
  const [lform, setLform] = useState({ lender: "", principal: "", note: "" });
  const [lsaving, setLsaving] = useState(false);
  const [repay, setRepay] = useState<{ id: string; lender: string; repaid: string; principal: number } | null>(null);

  const load = () =>
    apiGet<{ flows: Flow[] }>("/api/cashflow").then((d) => setFlows(d.flows || []));
  const loadLoans = () =>
    apiGet<{ loans: Loan[]; summary: LoanSummary }>("/api/loans").then((d) => {
      setLoans(d.loans || []);
      setLsum(d.summary);
    });

  useEffect(() => {
    Promise.all([load(), loadLoans()]).finally(() => setLoading(false));
  }, []);

  async function add() {
    if (!form.amount) return;
    setSaving(true);
    await apiSend("/api/cashflow", "POST", {
      type: form.type,
      source: form.source || "Manual",
      amount: parseFloat(form.amount),
      note: form.note || undefined,
    });
    setForm({ type: "in", source: "Manual", amount: "", note: "" });
    await load();
    setSaving(false);
  }

  async function addLoan() {
    if (!lform.lender || !lform.principal) return;
    setLsaving(true);
    await apiSend("/api/loans", "POST", {
      lender: lform.lender,
      principal: parseFloat(lform.principal),
      note: lform.note || undefined,
    });
    setLform({ lender: "", principal: "", note: "" });
    await Promise.all([load(), loadLoans()]);
    setLsaving(false);
  }

  async function saveRepay() {
    if (!repay) return;
    await apiSend("/api/loans", "PATCH", {
      id: repay.id,
      repaid: repay.repaid ? parseFloat(repay.repaid) : 0,
    });
    setRepay(null);
    await Promise.all([load(), loadLoans()]);
  }

  async function delLoan(id: string) {
    await apiSend(`/api/loans?id=${id}`, "DELETE");
    await Promise.all([load(), loadLoans()]);
  }

  async function delFlow(id: string) {
    await apiSend(`/api/cashflow?id=${id}`, "DELETE");
    await load();
  }

  const cashIn = flows.filter((f) => f.type === "in").reduce((s, f) => s + f.amount, 0);
  const cashOut = flows.filter((f) => f.type === "out").reduce((s, f) => s + f.amount, 0);
  const balance = cashIn - cashOut;

  const chart = [...flows]
    .reverse()
    .map((f) => ({ date: f.happenedAt.slice(5, 10), balance: Math.round(f.balance) }));

  return (
    <>
      <PageHeader title="Cash Flow" subtitle="Aap ke paas asal mein kitna cash hai — har paisa jo aaya ya gaya" />

      {/* Explanation banner */}
      <div className="card p-5 mb-6 text-sm text-muted leading-relaxed">
        <span className="text-text font-medium">Cash Flow kya hai?</span> Ye aap ka asal paisa track karta hai —
        jo bhi <span className="text-good">andar aaya</span> (sales, loan) aur jo{" "}
        <span className="text-bad">bahar gaya</span> (ads, inventory, shipping, expense). Net balance = aap ke haath/account
        mein is waqt kitna cash hona chahiye. <span className="text-text">Profit se alag hai</span> — loan cash to badhata
        hai par profit nahi.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Cash In" value={fmtPKR(cashIn)} icon={<ArrowDownLeft className="w-5 h-5 stroke-[2]" />} tone="good" />
        <StatCard label="Cash Out" value={fmtPKR(cashOut)} icon={<ArrowUpRight className="w-5 h-5 stroke-[2]" />} tone="bad" />
        <StatCard label="Net Balance" value={fmtPKR(balance)} icon={<Wallet className="w-5 h-5 stroke-[1.75]" />} tone={balance >= 0 ? "brand" : "warn"} />
        <StatCard
          label="Loan Outstanding"
          value={fmtPKR(lsum?.outstanding ?? 0)}
          sub={`Borrowed ${fmtCompact(lsum?.totalBorrowed ?? 0)}`}
          icon={<Landmark className="w-5 h-5 stroke-[1.75]" />}
          tone={(lsum?.outstanding ?? 0) > 0 ? "warn" : "good"}
        />
      </div>

      <Card title="Balance Over Time" className="mb-5">
        {chart.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--text)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--text)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} />
              <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtPKR(v)} />
              <Area type="monotone" dataKey="balance" stroke="var(--text)" fill="url(#bal)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Abhi koi cash movement nahi." />
        )}
      </Card>

      {/* Manual cash entry + ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <Card title="Manual Cash Entry" className="h-fit">
          <p className="text-micro text-muted mb-4">
            Opening balance ya koi cash jo kahin aur se track nahi hua.
          </p>
          <div className="space-y-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="in">Cash In (andar aaya)</option>
                <option value="out">Cash Out (bahar gaya)</option>
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
            <button className="btn-primary w-full" onClick={add} disabled={saving}>
              {saving ? "Saving…" : "Add Entry"}
            </button>
          </div>
        </Card>

        <Card title="Ledger" className="lg:col-span-2">
          {loading ? (
            <div className="text-muted text-caption py-10 text-center">Loading…</div>
          ) : flows.length === 0 ? (
            <EmptyState text="Ledger khali hai." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-eyebrow text-muted uppercase border-b border-border">
                    <th className="py-3 px-2">Source</th>
                    <th className="py-3 px-2">Note</th>
                    <th className="py-3 px-2 text-right">In</th>
                    <th className="py-3 px-2 text-right">Out</th>
                    <th className="py-3 px-2 text-right">Balance</th>
                    <th className="py-3 px-2 text-right">Date</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((f) => {
                    const isManual = !f.refId && !AUTO_SOURCES.includes(f.source);
                    return (
                      <tr key={f.id} className="border-b border-border hover:bg-panel2/50">
                        <td className="py-3 px-2">
                          <span className="pill bg-shade-30 text-text">{f.source}</span>
                        </td>
                        <td className="py-3 px-2 text-muted">{f.note || "—"}</td>
                        <td className="py-3 px-2 text-right text-good">{f.type === "in" ? fmtPKR(f.amount) : "—"}</td>
                        <td className="py-3 px-2 text-right text-bad">{f.type === "out" ? fmtPKR(f.amount) : "—"}</td>
                        <td className="py-3 px-2 text-right font-medium">{fmtPKR(f.balance)}</td>
                        <td className="py-3 px-2 text-right text-muted">{fmtDate(f.happenedAt)}</td>
                        <td className="py-3 px-2 text-right">
                          {isManual ? (
                            <button className="text-bad hover:underline text-xs" onClick={() => delFlow(f.id)}>
                              Delete
                            </button>
                          ) : (
                            <span className="text-micro text-muted" title="Auto-linked — apne page se edit karo">
                              auto
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Loan / Borrow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Naya Loan / Udhaar" className="h-fit">
          <p className="text-micro text-muted mb-4">
            Bank ya kisi se udhaar liya paisa. Ye cash-in ho jayega par profit mein count nahi hoga.
          </p>
          <div className="space-y-3">
            <div>
              <label className="label">Kis se liya (Lender)</label>
              <input
                className="input"
                placeholder="e.g. Bank, Ali bhai"
                value={lform.lender}
                onChange={(e) => setLform({ ...lform, lender: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Amount (PKR)</label>
              <input
                className="input"
                type="number"
                placeholder="23000"
                value={lform.principal}
                onChange={(e) => setLform({ ...lform, principal: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input
                className="input"
                placeholder="Ads ke liye"
                value={lform.note}
                onChange={(e) => setLform({ ...lform, note: e.target.value })}
              />
            </div>
            <button className="btn-primary w-full" onClick={addLoan} disabled={lsaving}>
              {lsaving ? "Saving…" : "Add Loan"}
            </button>
          </div>
        </Card>

        <Card title="Loans / Udhaar" className="lg:col-span-2">
          {loans.length === 0 ? (
            <EmptyState text="Koi loan record nahi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-eyebrow text-muted uppercase border-b border-border">
                    <th className="py-3 px-2">Lender</th>
                    <th className="py-3 px-2 text-right">Borrowed</th>
                    <th className="py-3 px-2 text-right">Repaid</th>
                    <th className="py-3 px-2 text-right">Outstanding</th>
                    <th className="py-3 px-2 text-right">Date</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => {
                    const out = Math.max(l.principal - l.repaid, 0);
                    return (
                      <tr key={l.id} className="border-b border-border hover:bg-panel2/50">
                        <td className="py-3 px-2">
                          <div className="font-medium">{l.lender}</div>
                          {l.note && <div className="text-micro text-muted">{l.note}</div>}
                        </td>
                        <td className="py-3 px-2 text-right">{fmtPKR(l.principal)}</td>
                        <td className="py-3 px-2 text-right text-good">{fmtPKR(l.repaid)}</td>
                        <td className="py-3 px-2 text-right font-medium text-warn">{fmtPKR(out)}</td>
                        <td className="py-3 px-2 text-right text-muted">{fmtDate(l.borrowedAt)}</td>
                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          <button
                            className="text-text hover:underline text-xs mr-3"
                            onClick={() =>
                              setRepay({ id: l.id, lender: l.lender, repaid: String(l.repaid || ""), principal: l.principal })
                            }
                          >
                            Repay
                          </button>
                          <button className="text-bad hover:underline text-xs" onClick={() => delLoan(l.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Repay modal */}
      {repay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setRepay(null)}>
          <div className="card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-heading-md mb-1">Repayment — {repay.lender}</h3>
            <p className="text-micro text-muted mb-5">
              Ab tak total kitna wapas kiya (principal {fmtPKR(repay.principal)}).
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Total Repaid (PKR)</label>
                <input
                  className="input"
                  type="number"
                  value={repay.repaid}
                  onChange={(e) => setRepay({ ...repay, repaid: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button className="btn-primary flex-1" onClick={saveRepay}>
                  Save
                </button>
                <button className="btn-ghost" onClick={() => setRepay(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
