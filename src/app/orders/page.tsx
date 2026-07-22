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
  trackingId: string | null;
  trackingUrl: string | null;
  archived: boolean;
  cancelled: boolean;
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

// Courier tracking page (jahan tracking ID daal ke check karte hain).
const COURIER_TRACK_URL: Record<string, string> = {
  TCS: "https://www.tcsexpress.com/track/",
  Leopards: "https://www.leopardscourier.com/tracking",
  PostEx: "https://merchant.postex.pk/tracking",
  "M&P": "https://mulphilog.com/",
  Trax: "https://sonic.pk/tracking",
  Daewoo: "https://www.daewoo.com.pk/",
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
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<Order | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = () =>
    apiGet<{ orders: Order[] }>("/api/orders?limit=300")
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function syncShopify() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        setSyncMsg(`✅ ${j.orders} orders · ${j.products} products sync ho gaye`);
        await load();
      } else {
        setSyncMsg(`❌ ${String(j.error).slice(0, 100)}`);
      }
    } catch (e) {
      setSyncMsg(`❌ ${String(e)}`);
    }
    setSyncing(false);
  }

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
      trackingId: edit.trackingId || "",
      trackingUrl: edit.trackingUrl || "",
    });
    setEdit(null);
    await load();
    setSaving(false);
  }

  async function setArchived(id: string, archived: boolean) {
    await apiSend("/api/orders", "PATCH", { id, archived });
    await load();
  }

  async function delOrder(id: string) {
    await apiSend(`/api/orders?id=${id}`, "DELETE");
    load();
  }

  // Archive tab = manually archived YA cancelled/voided orders.
  const isArchived = (o: Order) =>
    o.archived || o.cancelled || o.stage === "cancelled" || o.financialStatus === "voided";

  const bySearch = (o: Order) =>
    !q ||
    o.orderNumber?.toLowerCase().includes(q.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(q.toLowerCase()) ||
    o.customerCity?.toLowerCase().includes(q.toLowerCase());

  const activeOrders = orders.filter((o) => !isArchived(o));
  const archivedOrders = orders.filter(isArchived);
  const shown = (tab === "active" ? activeOrders : archivedOrders).filter(bySearch);

  // Stats sirf active orders pe (clutter kam).
  const totalSales = activeOrders.reduce((s, o) => s + o.totalPrice, 0);
  const completedSales = activeOrders
    .filter((o) => o.stage === "completed" || o.financialStatus === "paid")
    .reduce((s, o) => s + o.totalPrice, 0);
  const totalAdvance = activeOrders.reduce((s, o) => s + (o.shippingAdvance || 0), 0);
  const pendingCount = activeOrders.filter(
    (o) => o.stage !== "completed" && o.financialStatus !== "paid"
  ).length;

  return (
    <>
      <PageHeader
        title="Orders / Sales"
        subtitle="Shopify se synced + manual orders — dono ek jagah"
        action={
          <div className="flex flex-wrap gap-2 items-center">
            {syncMsg && <span className="text-xs text-muted">{syncMsg}</span>}
            <input
              className="input max-w-[160px]"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn-ghost whitespace-nowrap" onClick={syncShopify} disabled={syncing}>
              {syncing ? "Syncing…" : "🔄 Sync Shopify"}
            </button>
            <button className="btn-primary whitespace-nowrap" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "✕ Close" : "+ New Order"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Orders" value={String(activeOrders.length)} sub={`${pendingCount} pending`} icon="🛒" tone="brand" />
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
              <input className="input" placeholder="e.g. Ali Khan" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="e.g. Lahore" value={form.customerCity} onChange={(e) => setForm({ ...form, customerCity: e.target.value })} />
            </div>
            <div>
              <label className="label">Sell Price (PKR) *</label>
              <input className="input" type="number" placeholder="0" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} />
            </div>
            <div>
              <label className="label">Cost / COGS (PKR)</label>
              <input className="input" type="number" placeholder="0" value={form.cogs} onChange={(e) => setForm({ ...form, cogs: e.target.value })} />
            </div>
            <div>
              <label className="label">Items</label>
              <input className="input" type="number" value={form.itemCount} onChange={(e) => setForm({ ...form, itemCount: e.target.value })} />
            </div>
            <div>
              <label className="label">Stage</label>
              <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Courier</label>
              <select className="input" value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })}>
                {COURIERS.map((c) => (
                  <option key={c} value={c}>{c || "— select —"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Shipping Advance (PKR)</label>
              <input className="input" type="number" placeholder="0" value={form.shippingAdvance} onChange={(e) => setForm({ ...form, shippingAdvance: e.target.value })} />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
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
            <span className="text-xs text-muted">Profit = Sell − Cost − Shipping Advance.</span>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="inline-flex rounded-xl bg-panel2 border border-border p-1 mb-4">
        {([
          { k: "active", l: `Active (${activeOrders.length})` },
          { k: "archive", l: `Archive (${archivedOrders.length})` },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition ${
              tab === t.k ? "text-white" : "text-muted hover:text-text"
            }`}
            style={tab === t.k ? { backgroundImage: "linear-gradient(135deg,#10b981,#059669)" } : undefined}
          >
            {t.l}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="text-muted text-sm py-10 text-center">Loading…</div>
        ) : shown.length === 0 ? (
          <EmptyState text={tab === "active" ? "Koi active order nahi." : "Archive khali hai."} />
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
                  <th className="py-3 px-2">Stage</th>
                  <th className="py-3 px-2 text-right">Sell</th>
                  <th className="py-3 px-2 text-right">Profit</th>
                  <th className="py-3 px-2 text-right">Date</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const profit = o.totalPrice - (o.cogs || 0) - (o.shippingAdvance || 0);
                  const trackHref =
                    o.trackingUrl || (o.courier ? COURIER_TRACK_URL[o.courier] : undefined);
                  return (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-panel2/50">
                      <td className="py-3 px-2 font-medium">
                        {o.orderNumber || "—"}
                        {o.source === "manual" && <span className="ml-1 text-[10px] text-muted">✍</span>}
                      </td>
                      <td className="py-3 px-2">{o.customerName || "—"}</td>
                      <td className="py-3 px-2 text-muted">{o.customerCity || "—"}</td>
                      <td className="py-3 px-2">
                        {o.courier ? (
                          <div className="flex items-center gap-1.5">
                            <span className="pill bg-panel2 text-muted">{o.courier}</span>
                            {trackHref && (
                              <a
                                href={trackHref}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-light text-xs hover:underline"
                                title={o.trackingId || "Track"}
                              >
                                ↗
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {o.shippingAdvance ? fmtPKR(o.shippingAdvance) : <span className="text-muted">—</span>}
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
                        <button className="text-brand-light hover:underline text-xs" onClick={() => setEdit(o)}>
                          Edit
                        </button>
                        {tab === "active" ? (
                          <button
                            className="text-muted hover:text-text hover:underline text-xs ml-3"
                            onClick={() => setArchived(o.id, true)}
                            title="Archive kar do"
                          >
                            Archive
                          </button>
                        ) : (
                          o.archived && (
                            <button
                              className="text-brand-light hover:underline text-xs ml-3"
                              onClick={() => setArchived(o.id, false)}
                            >
                              Restore
                            </button>
                          )
                        )}
                        {o.source === "manual" && (
                          <button className="text-bad hover:underline text-xs ml-3" onClick={() => delOrder(o.id)}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">{edit.orderNumber} — {edit.customerName}</h3>
            <p className="text-xs text-muted mb-4">Stage, courier, shipping, prices aur tracking update karo.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Stage</label>
                <select className="input" value={edit.stage || "processing"} onChange={(e) => setEdit({ ...edit, stage: e.target.value })}>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Courier</label>
                <select className="input" value={edit.courier || ""} onChange={(e) => setEdit({ ...edit, courier: e.target.value })}>
                  {COURIERS.map((c) => (
                    <option key={c} value={c}>{c || "— select —"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sell Price</label>
                <input className="input" type="number" value={edit.totalPrice} onChange={(e) => setEdit({ ...edit, totalPrice: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Cost / COGS</label>
                <input className="input" type="number" value={edit.cogs} onChange={(e) => setEdit({ ...edit, cogs: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="col-span-2">
                <label className="label">Shipping Advance (hand-paid, PKR)</label>
                <input className="input" type="number" value={edit.shippingAdvance} onChange={(e) => setEdit({ ...edit, shippingAdvance: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Tracking ID (optional)</label>
                <input className="input" placeholder="e.g. 784512..." value={edit.trackingId || ""} onChange={(e) => setEdit({ ...edit, trackingId: e.target.value })} />
              </div>
              <div>
                <label className="label">Tracking Link (optional)</label>
                <input className="input" placeholder="https://…" value={edit.trackingUrl || ""} onChange={(e) => setEdit({ ...edit, trackingUrl: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button className="btn-primary flex-1" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
