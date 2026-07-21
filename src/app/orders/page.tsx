"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, Pill, StatCard, EmptyState } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtDate } from "@/lib/format";

type Order = {
  id: string;
  source: string;
  orderNumber: string | null;
  customerName: string | null;
  customerCity: string | null;
  totalPrice: number;
  itemCount: number;
  cogs: number;
  stage: string | null;
  shippingAdvance: number;
  courier: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  paymentMethod: string | null;
  shopifyCreatedAt: string;
};

const COURIERS = ["", "TCS", "Leopards", "M&P", "PostEx", "Trax", "Daewoo", "Other"];
const STAGES = ["processing", "shipped", "completed", "cancelled"] as const;

const STAGE_LABEL: Record<string, string> = {
  processing: "Processing",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
};

const emptyForm = {
  customerName: "",
  customerCity: "",
  totalPrice: "",
  cogs: "",
  shippingAdvance: "",
  courier: "",
  stage: "processing",
  paymentMethod: "COD",
  itemCount: "1",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<Order | null>(null);

  const load = () =>
    apiGet<{ orders: Order[] }>("/api/orders?limit=300")
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function addOrder() {
    if (!form.customerName || !form.totalPrice) return;
    setSaving(true);
    await apiSend("/api/orders", "POST", {
      customerName: form.customerName,
      customerCity: form.customerCity || undefined,
      totalPrice: parseFloat(form.totalPrice),
      cogs: form.cogs ? parseFloat(form.cogs) : 0,
      shippingAdvance: form.shippingAdvance ? parseFloat(form.shippingAdvance) : 0,
      courier: form.courier || undefined,
      stage: form.stage,
      paymentMethod: form.paymentMethod || undefined,
      itemCount: form.itemCount ? parseInt(form.itemCount, 10) : 1,
    });
    setForm(emptyForm);
    setShowForm(false);
    await load();
    setSaving(false);
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    await apiSend("/api/orders", "PATCH", {
      id: edit.id,
      stage: edit.stage || undefined,
      courier: edit.courier || undefined,
      shippingAdvance: edit.shippingAdvance || 0,
      totalPrice: edit.totalPrice,
      cogs: edit.cogs,
    });
    setEdit(null);
    await load();
    setSaving(false);
  }

  async function delOrder(id: string) {
    await apiSend(`/api/orders?id=${id}`, "DELETE");
    load();
  }

  const filtered = orders.filter(
    (o) =>
      !q ||
      o.orderNumber?.toLowerCase().includes(q.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(q.toLowerCase()) ||
      o.customerCity?.toLowerCase().includes(q.toLowerCase())
  );

  const totalSales = orders.reduce((s, o) => s + o.totalPrice, 0);
  const completedSales = orders
    .filter((o) => o.stage === "completed" || o.financialStatus === "paid")
    .reduce((s, o) => s + o.totalPrice, 0);
  const totalAdvance = orders.reduce((s, o) => s + (o.shippingAdvance || 0), 0);
  const pendingCount = orders.filter(
    (o) => o.stage && o.stage !== "completed" && o.stage !== "cancelled"
  ).length;

  return (
    <>
      <PageHeader
        title="Orders / Sales"
        subtitle="Manual orders add karo — completed hote hi payment cash-in ho jayegi"
        action={
          <div className="flex gap-2">
            <input
              className="input max-w-[200px]"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn-primary whitespace-nowrap" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "✕ Close" : "+ New Order"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Orders" value={String(orders.length)} sub={`${pendingCount} pending`} icon="🛒" tone="brand" />
        <StatCard label="Total Sales" value={fmtPKR(totalSales)} icon="💰" tone="good" />
        <StatCard label="Received (completed)" value={fmtPKR(completedSales)} icon="✅" tone="accent" />
        <StatCard label="Shipping Advance" value={fmtPKR(totalAdvance)} icon="🚚" tone="warn" />
      </div>

      {/* New order form */}
      {showForm && (
        <Card title="Naya Manual Order" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="label">Customer Name *</label>
              <input
                className="input"
                placeholder="e.g. Ali Khan"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                className="input"
                placeholder="e.g. Lahore"
                value={form.customerCity}
                onChange={(e) => setForm({ ...form, customerCity: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Sell Price (PKR) *</label>
              <input
                className="input"
                type="number"
                placeholder="0"
                value={form.totalPrice}
                onChange={(e) => setForm({ ...form, totalPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Cost / COGS (PKR)</label>
              <input
                className="input"
                type="number"
                placeholder="0"
                value={form.cogs}
                onChange={(e) => setForm({ ...form, cogs: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Items</label>
              <input
                className="input"
                type="number"
                value={form.itemCount}
                onChange={(e) => setForm({ ...form, itemCount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Stage</label>
              <select
                className="input"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Courier</label>
              <select
                className="input"
                value={form.courier}
                onChange={(e) => setForm({ ...form, courier: e.target.value })}
              >
                {COURIERS.map((c) => (
                  <option key={c} value={c}>
                    {c || "— select —"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Shipping Advance (PKR)</label>
              <input
                className="input"
                type="number"
                placeholder="0"
                value={form.shippingAdvance}
                onChange={(e) => setForm({ ...form, shippingAdvance: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                className="input"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                <option>COD</option>
                <option>Prepaid</option>
                <option>Bank Transfer</option>
                <option>JazzCash</option>
                <option>EasyPaisa</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button className="btn-primary" onClick={addOrder} disabled={saving}>
              {saving ? "Saving…" : "Add Order"}
            </button>
            <span className="text-xs text-muted">
              Profit = Sell − Cost − Shipping Advance. Completed order ki payment cash-in ho jati hai.
            </span>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="text-muted text-sm py-10 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState text="Koi order nahi. Upar '+ New Order' se manually add karo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-3 px-2">Order</th>
                  <th className="py-3 px-2">Customer</th>
                  <th className="py-3 px-2">City</th>
                  <th className="py-3 px-2">Courier</th>
                  <th className="py-3 px-2 text-right">Advance</th>
                  <th className="py-3 px-2 text-right">Cost</th>
                  <th className="py-3 px-2">Stage</th>
                  <th className="py-3 px-2 text-right">Sell</th>
                  <th className="py-3 px-2 text-right">Profit</th>
                  <th className="py-3 px-2 text-right">Date</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const profit = o.totalPrice - (o.cogs || 0) - (o.shippingAdvance || 0);
                  return (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-panel2/50">
                      <td className="py-3 px-2 font-medium">
                        {o.orderNumber || "—"}
                        {o.source === "manual" && (
                          <span className="ml-1 text-[10px] text-muted">✍</span>
                        )}
                      </td>
                      <td className="py-3 px-2">{o.customerName || "—"}</td>
                      <td className="py-3 px-2 text-muted">{o.customerCity || "—"}</td>
                      <td className="py-3 px-2">
                        {o.courier ? (
                          <span className="pill bg-panel2 text-muted">{o.courier}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {o.shippingAdvance ? fmtPKR(o.shippingAdvance) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-3 px-2 text-right text-muted">
                        {o.cogs ? fmtPKR(o.cogs) : "—"}
                      </td>
                      <td className="py-3 px-2">
                        <Pill status={o.stage || o.financialStatus || "pending"} />
                      </td>
                      <td className="py-3 px-2 text-right font-semibold">{fmtPKR(o.totalPrice)}</td>
                      <td className={`py-3 px-2 text-right font-semibold ${profit >= 0 ? "text-good" : "text-bad"}`}>
                        {fmtPKR(profit)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted">{fmtDate(o.shopifyCreatedAt)}</td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <button
                          className="text-brand-light hover:underline text-xs"
                          onClick={() => setEdit(o)}
                        >
                          Edit
                        </button>
                        {o.source === "manual" && (
                          <button
                            className="text-bad hover:underline text-xs ml-3"
                            onClick={() => delOrder(o.id)}
                          >
                            Delete
                          </button>
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

      {/* Edit modal */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEdit(null)}
        >
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">{edit.orderNumber} — {edit.customerName}</h3>
            <p className="text-xs text-muted mb-4">Stage, courier, advance aur prices update karo.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Stage</label>
                <select
                  className="input"
                  value={edit.stage || "processing"}
                  onChange={(e) => setEdit({ ...edit, stage: e.target.value })}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Courier</label>
                <select
                  className="input"
                  value={edit.courier || ""}
                  onChange={(e) => setEdit({ ...edit, courier: e.target.value })}
                >
                  {COURIERS.map((c) => (
                    <option key={c} value={c}>
                      {c || "— select —"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sell Price</label>
                <input
                  className="input"
                  type="number"
                  value={edit.totalPrice}
                  onChange={(e) => setEdit({ ...edit, totalPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Cost / COGS</label>
                <input
                  className="input"
                  type="number"
                  value={edit.cogs}
                  onChange={(e) => setEdit({ ...edit, cogs: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Shipping Advance (hand-paid, PKR)</label>
                <input
                  className="input"
                  type="number"
                  value={edit.shippingAdvance}
                  onChange={(e) => setEdit({ ...edit, shippingAdvance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button className="btn-primary flex-1" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button className="btn-ghost" onClick={() => setEdit(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
