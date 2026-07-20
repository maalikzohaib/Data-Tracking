"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, Pill, StatCard, EmptyState } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtDate } from "@/lib/format";

type Order = {
  id: string;
  orderNumber: string | null;
  customerName: string | null;
  customerCity: string | null;
  totalPrice: number;
  itemCount: number;
  cogs: number;
  shippingAdvance: number;
  courier: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  paymentMethod: string | null;
  shopifyCreatedAt: string;
};

const COURIERS = ["", "TCS", "Leopards", "M&P", "PostEx", "Trax", "Daewoo", "Other"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ id: string; courier: string; advance: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    apiGet<{ orders: Order[] }>("/api/orders?limit=300")
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    await apiSend("/api/orders", "PATCH", {
      id: edit.id,
      courier: edit.courier || undefined,
      shippingAdvance: edit.advance ? parseFloat(edit.advance) : 0,
    });
    setEdit(null);
    await load();
    setSaving(false);
  }

  const filtered = orders.filter(
    (o) =>
      !q ||
      o.orderNumber?.toLowerCase().includes(q.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(q.toLowerCase()) ||
      o.customerCity?.toLowerCase().includes(q.toLowerCase())
  );

  const totalSales = orders.reduce((s, o) => s + o.totalPrice, 0);
  const totalAdvance = orders.reduce((s, o) => s + (o.shippingAdvance || 0), 0);

  return (
    <>
      <PageHeader
        title="Orders / Sales"
        subtitle="Shopify se auto-synced — courier & advance manually add karo"
        action={
          <input
            className="input max-w-xs"
            placeholder="Search order / customer / city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Orders" value={String(orders.length)} icon="🛒" tone="brand" />
        <StatCard label="Total Sales" value={fmtPKR(totalSales)} icon="💰" tone="good" />
        <StatCard label="Shipping Advance Paid" value={fmtPKR(totalAdvance)} icon="🚚" tone="warn" />
      </div>

      <Card>
        {loading ? (
          <div className="text-muted text-sm py-10 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState text="Koi order nahi mila. Settings se Shopify sync chalao." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-3 px-2">Order</th>
                  <th className="py-3 px-2">Customer</th>
                  <th className="py-3 px-2">City</th>
                  <th className="py-3 px-2">Items</th>
                  <th className="py-3 px-2">Courier</th>
                  <th className="py-3 px-2 text-right">Advance</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Total</th>
                  <th className="py-3 px-2 text-right">Date</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-panel2/50">
                    <td className="py-3 px-2 font-medium">{o.orderNumber || "—"}</td>
                    <td className="py-3 px-2">{o.customerName || "—"}</td>
                    <td className="py-3 px-2 text-muted">{o.customerCity || "—"}</td>
                    <td className="py-3 px-2">{o.itemCount}</td>
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
                    <td className="py-3 px-2">
                      <Pill status={o.financialStatus || "pending"} />
                    </td>
                    <td className="py-3 px-2 text-right font-semibold">{fmtPKR(o.totalPrice)}</td>
                    <td className="py-3 px-2 text-right text-muted">{fmtDate(o.shopifyCreatedAt)}</td>
                    <td className="py-3 px-2 text-right">
                      <button
                        className="text-brand-light hover:underline text-xs"
                        onClick={() =>
                          setEdit({
                            id: o.id,
                            courier: o.courier || "",
                            advance: o.shippingAdvance ? String(o.shippingAdvance) : "",
                          })
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
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
          <div className="card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Courier & Shipping Advance</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Courier</label>
                <select
                  className="input"
                  value={edit.courier}
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
                <label className="label">Shipping Advance (hand-paid, PKR)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0"
                  value={edit.advance}
                  onChange={(e) => setEdit({ ...edit, advance: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button className="btn-primary flex-1" onClick={saveEdit} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button className="btn-ghost" onClick={() => setEdit(null)}>
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
