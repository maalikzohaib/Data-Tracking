"use client";

import { useEffect, useState } from "react";
import { Receipt, ClipboardList, Package, Gift } from "lucide-react";
import { PageHeader, Card, EmptyState, StatCard } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtDate } from "@/lib/format";

type Expense = {
  id: string;
  category: string;
  title: string;
  amount: number;
  vendor: string | null;
  quantity: number | null;
  unitCost: number | null;
  paidVia: string | null;
  note: string | null;
  spentAt: string;
};

const CATEGORIES = [
  "Inventory",
  "Packaging",
  "Shoot / Content",
  "COD Account",
  "Shipping",
  "Salary",
  "Rent",
  "Software",
  "Misc",
];

const PAID_VIA = ["Cash", "Bank", "JazzCash", "EasyPaisa", "Card"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    category: "Inventory",
    title: "",
    amount: "",
    vendor: "",
    quantity: "",
    unitCost: "",
    paidVia: "Cash",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");

  const load = () =>
    apiGet<{ expenses: Expense[] }>("/api/expenses")
      .then((d) => setExpenses(d.expenses || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  // Auto-calc amount when qty * unitCost given.
  function onQtyOrCost(next: { quantity?: string; unitCost?: string }) {
    const merged = { ...form, ...next };
    const q = parseFloat(merged.quantity);
    const u = parseFloat(merged.unitCost);
    if (!isNaN(q) && !isNaN(u) && q > 0 && u > 0) {
      merged.amount = String(Math.round(q * u));
    }
    setForm(merged);
  }

  async function add() {
    if (!form.title || !form.amount) return;
    setSaving(true);
    await apiSend("/api/expenses", "POST", {
      category: form.category,
      title: form.title,
      amount: parseFloat(form.amount),
      vendor: form.vendor || undefined,
      quantity: form.quantity ? parseFloat(form.quantity) : undefined,
      unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined,
      paidVia: form.paidVia || undefined,
      note: form.note || undefined,
    });
    setForm({
      category: form.category,
      title: "",
      amount: "",
      vendor: "",
      quantity: "",
      unitCost: "",
      paidVia: form.paidVia,
      note: "",
    });
    await load();
    setSaving(false);
  }

  async function del(id: string) {
    await apiSend(`/api/expenses?id=${id}`, "DELETE");
    load();
  }

  const shown =
    filter === "All" ? expenses : expenses.filter((e) => e.category === filter);
  const total = shown.reduce((s, e) => s + e.amount, 0);
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  // Category-wise totals for quick chips.
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Har kharcha — inventory, packaging, shoot, COD account sab"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Kharcha" value={fmtPKR(grandTotal)} icon={<Receipt className="w-5 h-5 stroke-[1.75]" />} tone="bad" />
        <StatCard
          label="Entries"
          value={String(expenses.length)}
          icon={<ClipboardList className="w-5 h-5 stroke-[1.75]" />}
          tone="brand"
        />
        <StatCard
          label="Inventory"
          value={fmtPKR(byCat.get("Inventory") ?? 0)}
          icon={<Package className="w-5 h-5 stroke-[1.75]" />}
          tone="warn"
        />
        <StatCard
          label="Packaging"
          value={fmtPKR(byCat.get("Packaging") ?? 0)}
          icon={<Gift className="w-5 h-5 stroke-[1.75]" />}
          tone="accent"
        />
      </div>

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
              <label className="label">Title / Kya liya</label>
              <input
                className="input"
                placeholder="e.g. Cotton kurta stock"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Vendor / Kahan se</label>
              <input
                className="input"
                placeholder="e.g. Anarkali Market"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Qty (optional)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => onQtyOrCost({ quantity: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Per unit (optional)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0"
                  value={form.unitCost}
                  onChange={(e) => onQtyOrCost({ unitCost: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Total Amount (PKR)</label>
              <input
                className="input"
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Paid Via</label>
              <select
                className="input"
                value={form.paidVia}
                onChange={(e) => setForm({ ...form, paidVia: e.target.value })}
              >
                {PAID_VIA.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
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

        <Card
          title={`Expenses — ${filter} (${fmtPKR(total)})`}
          className="lg:col-span-2"
          action={
            <select
              className="input w-auto text-xs py-1"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option>All</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          }
        >
          {loading ? (
            <div className="text-muted text-caption py-10 text-center">Loading…</div>
          ) : shown.length === 0 ? (
            <EmptyState text="Abhi koi expense nahi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-eyebrow text-muted uppercase border-b border-border">
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Detail</th>
                    <th className="py-3 px-2 text-right">Amount</th>
                    <th className="py-3 px-2 text-right">Date</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-border hover:bg-panel2/50"
                    >
                      <td className="py-3 px-2">
                        <span className="pill bg-shade-30 text-text">{e.category}</span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-medium">{e.title}</div>
                        <div className="text-micro text-muted">
                          {[
                            e.vendor,
                            e.quantity && e.unitCost
                              ? `${e.quantity} × ${fmtPKR(e.unitCost)}`
                              : null,
                            e.paidVia,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-medium">
                        {fmtPKR(e.amount)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted">
                        {fmtDate(e.spentAt)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          className="text-bad hover:underline text-xs"
                          onClick={() => del(e.id)}
                        >
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
