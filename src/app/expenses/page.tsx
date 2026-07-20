"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtDate } from "@/lib/format";

type Expense = {
  id: string;
  category: string;
  title: string;
  amount: number;
  note: string | null;
  spentAt: string;
};

const CATEGORIES = ["Inventory", "Packaging", "Shipping", "Salary", "Rent", "Software", "Misc"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ category: "Packaging", title: "", amount: "", note: "" });
  const [saving, setSaving] = useState(false);

  const load = () =>
    apiGet<{ expenses: Expense[] }>("/api/expenses")
      .then((d) => setExpenses(d.expenses || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!form.title || !form.amount) return;
    setSaving(true);
    await apiSend("/api/expenses", "POST", {
      category: form.category,
      title: form.title,
      amount: parseFloat(form.amount),
      note: form.note || undefined,
    });
    setForm({ category: form.category, title: "", amount: "", note: "" });
    await load();
    setSaving(false);
  }

  async function del(id: string) {
    await apiSend(`/api/expenses?id=${id}`, "DELETE");
    load();
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader title="Expenses" subtitle={`Total: ${fmtPKR(total)}`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Naya Expense" className="lg:col-span-1 h-fit">
          <div className="space-y-3">
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                placeholder="e.g. Packaging boxes"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Amount (PKR)</label>
              <input
                className="input"
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input
                className="input"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <button className="btn-primary w-full" onClick={add} disabled={saving}>
              {saving ? "Saving…" : "Add Expense"}
            </button>
          </div>
        </Card>

        <Card title="Recent Expenses" className="lg:col-span-2">
          {loading ? (
            <div className="text-muted text-sm py-10 text-center">Loading…</div>
          ) : expenses.length === 0 ? (
            <EmptyState text="Abhi koi expense nahi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Title</th>
                    <th className="py-3 px-2 text-right">Amount</th>
                    <th className="py-3 px-2 text-right">Date</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-panel2/50">
                      <td className="py-3 px-2">
                        <span className="pill bg-panel2 text-muted">{e.category}</span>
                      </td>
                      <td className="py-3 px-2">{e.title}</td>
                      <td className="py-3 px-2 text-right font-semibold">{fmtPKR(e.amount)}</td>
                      <td className="py-3 px-2 text-right text-muted">{fmtDate(e.spentAt)}</td>
                      <td className="py-3 px-2 text-right">
                        <button className="text-bad hover:underline text-xs" onClick={() => del(e.id)}>
                          Delete
                        </button>
                      </td>
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
