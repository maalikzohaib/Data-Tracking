"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, Pill, StatCard, EmptyState } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtDate } from "@/lib/format";

type LineItem = {
  id: string;
  title: string;
  quantity: number;
  price: number;
  sku: string | null;
};

type Order = {
  id: string;
  source: string;
  orderNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerCity: string | null;
  itemName: string | null;
  totalPrice: number;
  itemCount: number;
  cogs: number;
  stage: string | null;
  shippingAdvance: number;
  courier: string | null;
  trackingId: string | null;
  trackingUrl: string | null;
  confirmationStatus: string | null;
  slipPrinted: boolean;
  isPacked: boolean;
  isCourierHanded: boolean;
  remarks: string | null;
  specialDetails: string | null;
  deliveryStatus: string | null;
  labelColor: string | null;
  archived: boolean;
  cancelled: boolean;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  paymentMethod: string | null;
  shopifyCreatedAt: string;
  lineItems?: LineItem[];
};

const COURIERS = ["", "TCS", "Leopards", "M&P", "PostEx", "Trax", "Daewoo", "Other"];
const STAGES = ["processing", "shipped", "completed", "cancelled"] as const;

// Color palette for order row labels (10 main colors + None)
const COLOR_OPTIONS = [
  { label: "None",    value: "transparent" },
  { label: "Green",   value: "#22c55e" },
  { label: "Lime",    value: "#84cc16" },
  { label: "Orange",  value: "#f97316" },
  { label: "Yellow",  value: "#eab308" },
  { label: "Red",     value: "#ef4444" },
  { label: "Blue",    value: "#3b82f6" },
  { label: "Purple",  value: "#a855f7" },
  { label: "Pink",    value: "#ec4899" },
  { label: "Cyan",    value: "#06b6d4" },
  { label: "Gray",    value: "#6b7280" },
];

/** Normalize phone: +923xx → 03xx, 923xx → 03xx, already 03xx → as-is */
function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let p = raw.replace(/[\s\-().]/g, "");
  if (p.startsWith("+92")) p = "0" + p.slice(3);
  else if (p.startsWith("92") && p.length >= 12) p = "0" + p.slice(2);
  if (!p.startsWith("0")) p = "0" + p;
  return p;
}

const STAGE_LABEL: Record<string, string> = {
  processing: "Processing",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
};

const DELIVERY_STATUSES = [
  "pending under ATC",
  "delivered",
  "in transit",
  "out for delivery",
  "returned",
  "cancelled",
];

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
  customerPhone: "",
  customerCity: "",
  itemName: "",
  totalPrice: "",
  cogs: "",
  shippingAdvance: "",
  courier: "",
  stage: "processing",
  confirmationStatus: "confirmed",
  paymentMethod: "COD",
  deliveryStatus: "pending under ATC",
  itemCount: "1",
  remarks: "",
  specialDetails: "",
};

type DatePreset = "all" | "today" | "3days" | "7days" | "30days" | "thisMonth" | "custom";

function isWithinDateRange(
  dateStr: string,
  preset: DatePreset,
  customFrom?: string,
  customTo?: string
): boolean {
  if (preset === "all") return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;

  const now = new Date();

  if (preset === "today") {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return d >= todayStart && d <= todayEnd;
  }

  if (preset === "3days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0);
    return d >= start;
  }

  if (preset === "7days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    return d >= start;
  }

  if (preset === "30days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    return d >= start;
  }

  if (preset === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return d >= start;
  }

  if (preset === "custom") {
    if (customFrom) {
      const from = new Date(customFrom + "T00:00:00");
      if (!isNaN(from.getTime()) && d < from) return false;
    }
    if (customTo) {
      const to = new Date(customTo + "T23:59:59");
      if (!isNaN(to.getTime()) && d > to) return false;
    }
    return true;
  }

  return true;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "courierHanded" | "delivered" | "archive">("active");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<Order | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null); // orderId or null

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
      customerPhone: form.customerPhone || undefined,
      customerCity: form.customerCity || undefined,
      itemName: form.itemName || undefined,
      totalPrice: parseFloat(form.totalPrice),
      cogs: form.cogs ? parseFloat(form.cogs) : 0,
      shippingAdvance: form.shippingAdvance ? parseFloat(form.shippingAdvance) : 0,
      courier: form.courier || undefined,
      stage: form.stage,
      confirmationStatus: form.confirmationStatus,
      paymentMethod: form.paymentMethod || "COD",
      deliveryStatus: form.deliveryStatus || "pending under ATC",
      itemCount: form.itemCount ? parseInt(form.itemCount, 10) : 1,
      remarks: form.remarks || undefined,
      specialDetails: form.specialDetails || undefined,
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
      customerName: edit.customerName || "",
      customerPhone: edit.customerPhone || "",
      customerCity: edit.customerCity || "",
      itemName: edit.itemName || "",
      stage: edit.stage || undefined,
      confirmationStatus: edit.confirmationStatus || "pending",
      paymentMethod: edit.paymentMethod || "COD",
      courier: edit.courier || undefined,
      shippingAdvance: edit.shippingAdvance || 0,
      totalPrice: edit.totalPrice,
      cogs: edit.cogs,
      trackingId: edit.trackingId || "",
      trackingUrl: edit.trackingUrl || "",
      remarks: edit.remarks || "",
      specialDetails: edit.specialDetails || "",
      deliveryStatus: edit.deliveryStatus || "pending under ATC",
      isPacked: edit.isPacked,
      isCourierHanded: edit.isCourierHanded,
    });
    setEdit(null);
    await load();
    setSaving(false);
  }

  async function updateField(id: string, patch: Partial<Order>) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
    );
    await apiSend("/api/orders", "PATCH", { id, ...patch });
    load();
  }

  async function setArchived(id: string, archived: boolean) {
    await apiSend("/api/orders", "PATCH", { id, archived });
    await load();
  }

  async function delOrder(id: string) {
    await apiSend(`/api/orders?id=${id}`, "DELETE");
    load();
  }

  // === 4-Section Filter Logic ===
  // Archive: cancelled, voided, or manually archived
  const isArchived = (o: Order) =>
    o.archived || o.cancelled || o.stage === "cancelled" || o.financialStatus === "voided";

  // Delivered: deliveryStatus === "delivered" (and not archived)
  const isDelivered = (o: Order) =>
    !isArchived(o) && o.deliveryStatus === "delivered";

  // Courier Handed: isCourierHanded === true, but NOT yet delivered, NOT archived
  const isCourierHanded = (o: Order) =>
    !isArchived(o) && !isDelivered(o) && !!o.isCourierHanded;

  // Active: everything else (not courier handed, not delivered, not archived)
  const isActive = (o: Order) =>
    !isArchived(o) && !isDelivered(o) && !isCourierHanded(o);

  const getOrderSection = (o: Order): { key: string; label: string; icon: string; badgeStyle: string } => {
    if (isArchived(o)) {
      return { key: "archive", label: "Archive", icon: "📦", badgeStyle: "bg-gray-500/20 text-gray-300 border border-gray-500/30" };
    }
    if (isDelivered(o)) {
      return { key: "delivered", label: "Delivered", icon: "✅", badgeStyle: "bg-blue-500/20 text-blue-400 border border-blue-500/30" };
    }
    if (isCourierHanded(o)) {
      return { key: "courierHanded", label: "Courier Handed", icon: "🚚", badgeStyle: "bg-amber-500/20 text-amber-400 border border-amber-500/30" };
    }
    return { key: "active", label: "Active", icon: "🛒", badgeStyle: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" };
  };

  const bySearch = (o: Order) =>
    !q ||
    o.orderNumber?.toLowerCase().includes(q.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(q.toLowerCase()) ||
    o.customerPhone?.toLowerCase().includes(q.toLowerCase()) ||
    o.itemName?.toLowerCase().includes(q.toLowerCase()) ||
    o.customerCity?.toLowerCase().includes(q.toLowerCase()) ||
    o.remarks?.toLowerCase().includes(q.toLowerCase());

  const activeOrders = orders.filter(isActive);
  const courierHandedOrders = orders.filter(isCourierHanded);
  const deliveredOrders = orders.filter(isDelivered);
  const archivedOrders = orders.filter(isArchived);

  // All orders filtered by selected date preset / custom range
  const dateFilteredOrders = orders.filter((o) =>
    isWithinDateRange(o.shopifyCreatedAt || (o as any).createdAt, datePreset, customFrom, customTo)
  );

  // GLOBAL SEARCH: If search query 'q' is entered, search across ALL date-filtered orders regardless of current tab.
  // TAB FILTER: If no search query, filter date-filtered orders by currently selected section tab.
  const shown = q
    ? dateFilteredOrders.filter(bySearch)
    : dateFilteredOrders.filter((o) => {
        if (tab === "active") return isActive(o);
        if (tab === "courierHanded") return isCourierHanded(o);
        if (tab === "delivered") return isDelivered(o);
        return isArchived(o);
      });

  // Dynamic KPI Cards per tab state or global search
  const renderKpiCards = () => {
    if (q) {
      const totalCount = shown.length;
      const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);

      const deliveredCount = shown.filter(isDelivered).length;
      const deliveredVal = shown.filter(isDelivered).reduce((sum, o) => sum + o.totalPrice, 0);

      const activeOrHanded = shown.filter((o) => !isDelivered(o) && !isArchived(o));
      const activeHandedCount = activeOrHanded.length;
      const activeHandedVal = activeOrHanded.reduce((sum, o) => sum + o.totalPrice, 0);

      return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Global Matches" value={String(totalCount)} sub={`Search results for "${q}"`} icon="🔍" tone="brand" />
          <StatCard label="Total Match Value" value={fmtPKR(totalSales)} sub="Total value of results" icon="💰" tone="good" />
          <StatCard label="Delivered Matched" value={String(deliveredCount)} sub={`Val: ${fmtPKR(deliveredVal)}`} icon="✅" tone="accent" />
          <StatCard label="Active / Handed" value={String(activeHandedCount)} sub={`Val: ${fmtPKR(activeHandedVal)}`} icon="🚚" tone="warn" />
        </div>
      );
    }

    if (tab === "active") {
      const totalCount = shown.length;
      const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);

      const unconfirmed = shown.filter((o) => o.confirmationStatus !== "confirmed");
      const unconfirmedCount = unconfirmed.length;
      const unconfirmedVal = unconfirmed.reduce((sum, o) => sum + o.totalPrice, 0);

      const pendingFulfill = shown.filter((o) => !o.isCourierHanded);
      const pendingFulfillCount = pendingFulfill.length;
      const pendingFulfillVal = pendingFulfill.reduce((sum, o) => sum + o.totalPrice, 0);

      return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Active Orders" value={String(totalCount)} sub="Active orders" icon="🛒" tone="brand" />
          <StatCard label="Active Sales" value={fmtPKR(totalSales)} sub="Total active value" icon="💰" tone="good" />
          <StatCard label="Pending Confirmation" value={String(unconfirmedCount)} sub={`Val: ${fmtPKR(unconfirmedVal)}`} icon="⏳" tone="warn" />
          <StatCard label="Pending Fulfillment" value={String(pendingFulfillCount)} sub={`Val: ${fmtPKR(pendingFulfillVal)}`} icon="📦" tone="accent" />
        </div>
      );
    }

    if (tab === "courierHanded") {
      const totalCount = shown.length;
      const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);

      const codOrders = shown.filter((o) => (o.paymentMethod || "COD") === "COD");
      const codVal = codOrders.reduce((sum, o) => sum + o.totalPrice, 0);

      const inTransit = shown.filter((o) => o.deliveryStatus !== "delivered");
      const inTransitCount = inTransit.length;
      const inTransitVal = inTransit.reduce((sum, o) => sum + o.totalPrice, 0);

      return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Handed Orders" value={String(totalCount)} sub="With courier" icon="🚚" tone="brand" />
          <StatCard label="Handed Sales" value={fmtPKR(totalSales)} sub="Total handed value" icon="💰" tone="good" />
          <StatCard label="COD Amount to Receive" value={fmtPKR(codVal)} sub={`${codOrders.length} COD orders`} icon="💵" tone="warn" />
          <StatCard label="Orders in Transit" value={String(inTransitCount)} sub={`Val: ${fmtPKR(inTransitVal)}`} icon="🛣️" tone="accent" />
        </div>
      );
    }

    if (tab === "delivered") {
      const totalCount = shown.length;
      const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);

      const codReceived = shown.filter((o) => (o.paymentMethod || "COD") === "COD").reduce((sum, o) => sum + o.totalPrice, 0);
      const aov = totalCount > 0 ? totalSales / totalCount : 0;

      return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Delivered Orders" value={String(totalCount)} sub="Delivered & completed" icon="✅" tone="brand" />
          <StatCard label="Total Received Sales" value={fmtPKR(totalSales)} sub="Completed sales" icon="💰" tone="good" />
          <StatCard label="Total COD Received" value={fmtPKR(codReceived)} sub="COD collected" icon="💵" tone="accent" />
          <StatCard label="Average Order Value" value={fmtPKR(aov)} sub="AOV per order" icon="📊" tone="warn" />
        </div>
      );
    }

    // Archive tab
    const totalCount = shown.length;
    const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);

    const returnedOrCancelled = shown.filter((o) => o.cancelled || o.deliveryStatus === "returned" || o.deliveryStatus === "cancelled" || o.stage === "cancelled");
    const retCancelCount = returnedOrCancelled.length;
    const lostVal = returnedOrCancelled.reduce((sum, o) => sum + o.totalPrice, 0);

    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Archived Orders" value={String(totalCount)} sub="Archived orders" icon="📦" tone="brand" />
        <StatCard label="Archived Sales Value" value={fmtPKR(totalSales)} sub="Total value archived" icon="💰" tone="good" />
        <StatCard label="Returned / Cancelled" value={String(retCancelCount)} sub="Cancelled/returned count" icon="⚠️" tone="warn" />
        <StatCard label="Total Lost Value" value={fmtPKR(lostVal)} sub="Lost order value" icon="❌" tone="bad" />
      </div>
    );
  };

  return (
    <>
      {/* Filter Bar: Date Presets & Custom Range & Search & Sync */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-panel border border-border p-3 rounded-2xl shadow-sm pt-14 lg:pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted bg-panel2/60 px-3 py-1.5 rounded-xl border border-border">
            <span>📅 Date:</span>
            <select
              className="bg-transparent text-xs font-medium text-text focus:outline-none cursor-pointer"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            >
              <option value="all" className="bg-panel text-text">All Time</option>
              <option value="today" className="bg-panel text-text">Today</option>
              <option value="3days" className="bg-panel text-text">Last 3 Days</option>
              <option value="7days" className="bg-panel text-text">Last 7 Days</option>
              <option value="30days" className="bg-panel text-text">Last 30 Days</option>
              <option value="thisMonth" className="bg-panel text-text">This Month</option>
              <option value="custom" className="bg-panel text-text">Custom Range</option>
            </select>
          </div>

          {datePreset === "custom" && (
            <div className="flex items-center gap-2 bg-panel2/60 px-3 py-1 rounded-xl border border-border">
              <input
                type="date"
                className="bg-transparent text-xs text-text focus:outline-none"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-xs text-muted">to</span>
              <input
                type="date"
                className="bg-transparent text-xs text-text focus:outline-none"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}

          {syncMsg && <span className="text-xs text-muted bg-panel2 px-2.5 py-1 rounded-xl border border-border">{syncMsg}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              className="input pl-8 pr-8 py-1.5 text-xs w-[220px] sm:w-[280px]"
              placeholder="Search Order #, name, phone, item..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="absolute left-2.5 top-2 text-xs text-muted pointer-events-none">🔍</span>
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 top-2 text-xs text-muted hover:text-text"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <button className="btn-ghost whitespace-nowrap text-xs py-1.5" onClick={syncShopify} disabled={syncing}>
            {syncing ? "Syncing…" : "🔄 Sync Shopify"}
          </button>
        </div>
      </div>

      {/* Context-Aware Dynamic KPI Cards */}
      {renderKpiCards()}

      {/* New order form */}
      {showForm && (
        <Card title="Naya Manual Order" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Customer Name *</label>
              <input className="input" placeholder="e.g. Ali Khan" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div>
              <label className="label">Contact No</label>
              <input className="input" placeholder="0300-1234567" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="e.g. Lahore" value={form.customerCity} onChange={(e) => setForm({ ...form, customerCity: e.target.value })} />
            </div>
            <div>
              <label className="label">Item Name</label>
              <input className="input" placeholder="e.g. Black Leather Wallet" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} />
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
              <label className="label">Qty</label>
              <input className="input" type="number" value={form.itemCount} onChange={(e) => setForm({ ...form, itemCount: e.target.value })} />
            </div>
            <div>
              <label className="label">Confirmation</label>
              <select className="input" value={form.confirmationStatus} onChange={(e) => setForm({ ...form, confirmationStatus: e.target.value })}>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="label">Payment Type</label>
              <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="COD">COD</option>
                <option value="Online Payment">Online Payment</option>
              </select>
            </div>
            <div>
              <label className="label">Delivery Status</label>
              <select className="input" value={form.deliveryStatus} onChange={(e) => setForm({ ...form, deliveryStatus: e.target.value })}>
                {DELIVERY_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
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
              <label className="label">Remarks</label>
              <input className="input" placeholder="e.g. Call before delivery" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>
            <div className="lg:col-span-2">
              <label className="label">Special Details</label>
              <input className="input" placeholder="e.g. Gift wrap requested" value={form.specialDetails} onChange={(e) => setForm({ ...form, specialDetails: e.target.value })} />
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

      {/* Global Search Active Notice */}
      {q && (
        <div className="flex items-center justify-between bg-brand/10 border border-brand/20 text-brand-light px-4 py-2.5 rounded-2xl mb-4 text-xs font-medium shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">🔍</span>
            <span>
              Searching <strong>Globally across ALL sections</strong> for "<strong className="text-white">{q}</strong>" — {shown.length} order{shown.length === 1 ? "" : "s"} found. Each order displays its current workflow section badge below its order number.
            </span>
          </div>
          <button onClick={() => setQ("")} className="bg-panel2 hover:bg-panel text-text px-2.5 py-1 rounded-lg border border-border transition text-xs font-semibold">
            ✕ Clear Search
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="inline-flex rounded-xl bg-panel2 border border-border p-1 mb-4">
        {([
          { k: "active" as const, l: `Active (${activeOrders.length})`, icon: "🛒", color: "linear-gradient(135deg,#10b981,#059669)" },
          { k: "courierHanded" as const, l: `Courier Handed (${courierHandedOrders.length})`, icon: "🚚", color: "linear-gradient(135deg,#f59e0b,#d97706)" },
          { k: "delivered" as const, l: `Delivered (${deliveredOrders.length})`, icon: "✅", color: "linear-gradient(135deg,#3b82f6,#2563eb)" },
          { k: "archive" as const, l: `Archive (${archivedOrders.length})`, icon: "📦", color: "linear-gradient(135deg,#6b7280,#4b5563)" },
        ]).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition ${
              tab === t.k ? "text-white" : "text-muted hover:text-text"
            }`}
            style={tab === t.k ? { backgroundImage: t.color } : undefined}
          >
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      <Card className="!p-3 overflow-hidden">
        {loading ? (
          <div className="text-muted text-sm py-10 text-center">Loading…</div>
        ) : shown.length === 0 ? (
          <EmptyState text={
            q
              ? `No orders found matching "${q}" in ${tab === "active" ? "Active" : tab === "courierHanded" ? "Courier Handed" : tab === "delivered" ? "Delivered" : "Archive"}.`
              : datePreset !== "all"
              ? `No orders found for selected date filter in ${tab === "active" ? "Active" : tab === "courierHanded" ? "Courier Handed" : tab === "delivered" ? "Delivered" : "Archive"}.`
              : tab === "active" ? "No active orders found." :
                tab === "courierHanded" ? "No courier handed orders found." :
                tab === "delivered" ? "No delivered orders found." :
                "Archive is empty."
          } />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1500px]">
              <thead>
                <tr className="bg-panel2/80 text-muted uppercase font-semibold text-[11px] border-b border-border tracking-wider">
                  <th className="py-3 px-1 text-center whitespace-nowrap min-w-[32px]"></th>
                  <th className="py-3 px-2 whitespace-nowrap min-w-[95px]">Date</th>
                  <th className="py-3 px-2 whitespace-nowrap min-w-[90px]">Order No #</th>
                  <th className="py-3 px-2 whitespace-nowrap min-w-[130px]">Name</th>
                  <th className="py-3 px-2 whitespace-nowrap min-w-[160px]">Item Name</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap min-w-[45px]">Qty</th>
                  <th className="py-3 px-2 text-right whitespace-nowrap min-w-[85px]">Price</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap min-w-[105px]">Confirmation</th>
                  <th className="py-3 px-2 whitespace-nowrap min-w-[140px]">Payment</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap min-w-[75px]">Slip Print</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap min-w-[70px]">Packed</th>
                  <th className="py-3 px-2 text-center whitespace-nowrap min-w-[100px]">Courier Hand</th>
                  <th className="py-3 px-2 whitespace-nowrap min-w-[125px]">Contact No</th>
                  <th className="py-3 px-2 whitespace-nowrap min-w-[135px]">Remarks</th>
                  <th className="py-3 px-2 whitespace-nowrap min-w-[135px]">Status</th>
                  <th className="py-3 px-2 text-right whitespace-nowrap min-w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {shown.map((o) => {
                  const displayItem =
                    o.itemName ||
                    (o.lineItems && o.lineItems.length > 0
                      ? o.lineItems.map((li) => li.title).join(", ")
                      : "—");
                  const qty =
                    o.itemCount ||
                    (o.lineItems && o.lineItems.length > 0
                      ? o.lineItems.reduce((s, li) => s + li.quantity, 0)
                      : 1);
                  const isConfirmed = o.confirmationStatus === "confirmed";
                  const payMethod = o.paymentMethod || "COD";
                  const rowColor = o.labelColor && o.labelColor !== "transparent" && o.labelColor !== "#transparent" ? o.labelColor : null;
                  const section = getOrderSection(o);

                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-panel2/40 transition-colors"
                      style={rowColor ? { backgroundColor: `${rowColor}18` } : undefined}
                    >
                      {/* Color Label */}
                      <td className="py-2.5 px-1 text-center relative">
                        <button
                          onClick={() => setColorPickerOpen(colorPickerOpen === o.id ? null : o.id)}
                          className="w-5 h-5 rounded border-2 border-border/60 hover:border-brand cursor-pointer transition inline-block"
                          style={{ backgroundColor: rowColor || "transparent" }}
                          title="Set order color"
                        />
                        {colorPickerOpen === o.id && (
                          <div className="absolute left-6 top-1 z-50 bg-panel border border-border rounded-lg shadow-xl p-2 flex gap-1.5 flex-wrap w-[140px]">
                            {COLOR_OPTIONS.map((c) => (
                              <button
                                key={c.value}
                                title={c.label}
                                onClick={() => {
                                  updateField(o.id, { labelColor: c.value } as Partial<Order>);
                                  setColorPickerOpen(null);
                                }}
                                className={`w-6 h-6 rounded-full border-2 transition hover:scale-110 ${
                                  (o.labelColor || "transparent") === c.value
                                    ? "border-white ring-2 ring-brand"
                                    : "border-border/40 hover:border-white/60"
                                }`}
                                style={{ backgroundColor: c.value === "transparent" ? "transparent" : c.value }}
                              >
                                {c.value === "transparent" && <span className="text-[9px] text-muted leading-none">✕</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      {/* 1. Date */}
                      <td className="py-2.5 px-2 text-muted whitespace-nowrap font-medium">
                        {fmtDate(o.shopifyCreatedAt)}
                      </td>

                      {/* 2. Order No # + Workflow Section Badge */}
                      <td className="py-2.5 px-2 font-bold text-text whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span>{o.orderNumber || "—"}</span>
                            {o.source === "manual" && <span className="text-[10px] text-brand-light" title="Manual order">✍</span>}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold w-max ${section.badgeStyle}`}>
                            {section.icon} {section.label}
                          </span>
                        </div>
                      </td>

                      {/* 3. Name */}
                      <td className="py-2.5 px-2 font-medium text-text">
                        {o.customerName || "—"}
                        {o.customerCity && <div className="text-[10px] text-muted">{o.customerCity}</div>}
                      </td>

                      {/* 4. Item Name */}
                      <td className="py-2.5 px-2 text-text/90 max-w-[200px] truncate" title={displayItem}>
                        {displayItem}
                      </td>

                      {/* 5. Quantity */}
                      <td className="py-2.5 px-2 text-center font-semibold text-text">
                        {qty}
                      </td>

                      {/* 6. Price */}
                      <td className="py-2.5 px-2 text-right font-bold text-good whitespace-nowrap">
                        {fmtPKR(o.totalPrice)}
                      </td>

                      {/* 7. Confirmation */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() =>
                            updateField(o.id, {
                              confirmationStatus: isConfirmed ? "pending" : "confirmed",
                            })
                          }
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition ${
                            isConfirmed
                              ? "bg-good/20 text-good border border-good/30"
                              : "bg-warn/20 text-warn border border-warn/30 hover:bg-warn/30"
                          }`}
                        >
                          {isConfirmed ? "✓ Confirmed" : "⏳ Pending"}
                        </button>
                      </td>

                      {/* 8. Payment (Type Only: COD / Online Payment) */}
                      <td className="py-2.5 px-2">
                        <select
                          value={payMethod === "Online Payment" ? "Online Payment" : "COD"}
                          onChange={(e) => updateField(o.id, { paymentMethod: e.target.value })}
                          className="bg-panel2 text-xs font-semibold text-text border border-border rounded px-1.5 py-0.5 focus:outline-none focus:border-brand cursor-pointer"
                        >
                          <option value="COD">COD</option>
                          <option value="Online Payment">Online Payment</option>
                        </select>
                      </td>

                      {/* 9. Slip Print (Checkbox Only) */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!o.slipPrinted}
                          onChange={(e) => updateField(o.id, { slipPrinted: e.target.checked })}
                          className="h-4 w-4 rounded border-border bg-panel2 text-brand focus:ring-brand accent-brand cursor-pointer"
                          title="Checkmark if slip is printed"
                        />
                      </td>

                      {/* 10. Packed */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!o.isPacked}
                          onChange={(e) => updateField(o.id, { isPacked: e.target.checked })}
                          className="h-4 w-4 rounded border-border bg-panel2 text-brand focus:ring-brand accent-brand cursor-pointer"
                        />
                      </td>

                      {/* 11. Courier Hand */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => updateField(o.id, { isCourierHanded: !o.isCourierHanded })}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                            o.isCourierHanded
                              ? "bg-accent/20 text-accent border border-accent/40"
                              : "bg-panel2 text-muted border border-border hover:text-text"
                          }`}
                        >
                          {o.isCourierHanded ? "🚚 Dispatched" : "Handover"}
                        </button>
                      </td>

                      {/* 12. Contact No (Auto-fetched from Shopify, formatted 03xx + Inline Editable) */}
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          defaultValue={formatPhone(o.customerPhone)}
                          placeholder="03xx-xxxxxxx"
                          onBlur={(e) => {
                            const formatted = formatPhone(e.target.value);
                            e.target.value = formatted;
                            if (formatted !== formatPhone(o.customerPhone)) {
                              updateField(o.id, { customerPhone: formatted });
                            }
                          }}
                          className="bg-transparent hover:bg-panel2/60 focus:bg-panel2 text-xs text-text border border-transparent hover:border-border/60 focus:border-brand rounded px-1.5 py-1 w-full focus:outline-none transition"
                        />
                      </td>

                      {/* 13. Remarks (Inline Manual Edit) */}
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          defaultValue={o.remarks || ""}
                          placeholder="Add remarks..."
                          onBlur={(e) => {
                            if (e.target.value !== (o.remarks || "")) {
                              updateField(o.id, { remarks: e.target.value });
                            }
                          }}
                          className="bg-transparent hover:bg-panel2/60 focus:bg-panel2 text-xs text-text border border-transparent hover:border-border/60 focus:border-brand rounded px-1.5 py-1 w-full focus:outline-none transition"
                        />
                      </td>

                      {/* 14. Status */}
                      <td className="py-2.5 px-2">
                        <select
                          value={o.deliveryStatus || "pending under ATC"}
                          onChange={(e) => updateField(o.id, { deliveryStatus: e.target.value })}
                          className="bg-panel2 text-xs text-text border border-border rounded px-1.5 py-1 focus:outline-none focus:border-brand cursor-pointer"
                        >
                          {DELIVERY_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 15 & 16. Actions */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button className="text-brand-light hover:underline text-xs" onClick={() => setEdit(o)}>
                          Edit
                        </button>
                        {tab === "active" ? (
                          <button
                            className="text-muted hover:text-text hover:underline text-xs ml-2"
                            onClick={() => setArchived(o.id, true)}
                            title="Archive kar do"
                          >
                            Archive
                          </button>
                        ) : (
                          o.archived && (
                            <button
                              className="text-brand-light hover:underline text-xs ml-2"
                              onClick={() => setArchived(o.id, false)}
                            >
                              Restore
                            </button>
                          )
                        )}
                        {o.source === "manual" && (
                          <button className="text-bad hover:underline text-xs ml-2" onClick={() => delOrder(o.id)}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">{edit.orderNumber} — {edit.customerName}</h3>
            <p className="text-xs text-muted mb-4">Order details, status, contact aur notes update karo.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="label">Customer Name</label>
                <input className="input" value={edit.customerName || ""} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })} />
              </div>
              <div>
                <label className="label">Contact No</label>
                <input className="input" value={edit.customerPhone || ""} onChange={(e) => setEdit({ ...edit, customerPhone: e.target.value })} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={edit.customerCity || ""} onChange={(e) => setEdit({ ...edit, customerCity: e.target.value })} />
              </div>
              <div>
                <label className="label">Item Name</label>
                <input className="input" value={edit.itemName || ""} onChange={(e) => setEdit({ ...edit, itemName: e.target.value })} />
              </div>
              <div>
                <label className="label">Confirmation</label>
                <select className="input" value={edit.confirmationStatus || "pending"} onChange={(e) => setEdit({ ...edit, confirmationStatus: e.target.value })}>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="label">Delivery Status</label>
                <select className="input" value={edit.deliveryStatus || "pending under ATC"} onChange={(e) => setEdit({ ...edit, deliveryStatus: e.target.value })}>
                  {DELIVERY_STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select className="input" value={edit.paymentMethod || "COD"} onChange={(e) => setEdit({ ...edit, paymentMethod: e.target.value })}>
                  <option value="COD">COD</option>
                  <option value="Online Payment">Online Payment</option>
                </select>
              </div>
              <div>
                <label className="label">Sell Price (PKR)</label>
                <input className="input" type="number" value={edit.totalPrice} onChange={(e) => setEdit({ ...edit, totalPrice: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Cost / COGS (PKR)</label>
                <input className="input" type="number" value={edit.cogs} onChange={(e) => setEdit({ ...edit, cogs: parseFloat(e.target.value) || 0 })} />
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
                <label className="label">Shipping Advance (PKR)</label>
                <input className="input" type="number" value={edit.shippingAdvance} onChange={(e) => setEdit({ ...edit, shippingAdvance: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-4 py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!edit.slipPrinted} onChange={(e) => setEdit({ ...edit, slipPrinted: e.target.checked })} />
                  <span>Slip Printed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!edit.isPacked} onChange={(e) => setEdit({ ...edit, isPacked: e.target.checked })} />
                  <span>Order Packed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!edit.isCourierHanded} onChange={(e) => setEdit({ ...edit, isCourierHanded: e.target.checked })} />
                  <span>Delivered to Courier</span>
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="label">Remarks</label>
                <input className="input" value={edit.remarks || ""} onChange={(e) => setEdit({ ...edit, remarks: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Special Details</label>
                <input className="input" value={edit.specialDetails || ""} onChange={(e) => setEdit({ ...edit, specialDetails: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-2 pt-5">
              <button className="btn-primary flex-1" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Print Preview Modal */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPrintOrder(null)}>
          <div className="bg-white text-black p-8 rounded-2xl w-full max-w-md shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wider text-gray-900">Order Dispatch Slip</h2>
                <div className="text-xs text-gray-500 font-mono mt-0.5">Order #{printOrder.orderNumber}</div>
              </div>
              <button className="text-gray-400 hover:text-black font-bold text-lg" onClick={() => setPrintOrder(null)}>✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Date:</span>
                <span className="font-semibold">{fmtDate(printOrder.shopifyCreatedAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Customer Name:</span>
                <span className="font-semibold text-gray-900">{printOrder.customerName || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Contact Number:</span>
                <span className="font-semibold text-gray-900">{printOrder.customerPhone || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">City / Destination:</span>
                <span className="font-semibold text-gray-900">{printOrder.customerCity || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Item Name:</span>
                <span className="font-semibold text-gray-900">
                  {printOrder.itemName || (printOrder.lineItems?.map((l) => l.title).join(", ") || "—")}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Quantity:</span>
                <span className="font-semibold">{printOrder.itemCount || 1}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Total Price:</span>
                <span className="font-bold text-lg text-emerald-700">{fmtPKR(printOrder.totalPrice)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Payment Method:</span>
                <span className="font-semibold uppercase">{printOrder.paymentMethod || "COD"} ({printOrder.financialStatus || "pending"})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Courier:</span>
                <span className="font-semibold">{printOrder.courier || "Standard"}</span>
              </div>
              {printOrder.remarks && (
                <div className="py-2 bg-gray-50 p-2.5 rounded border border-gray-200">
                  <div className="text-xs font-semibold text-gray-500 uppercase">Remarks:</div>
                  <div className="text-xs text-gray-800">{printOrder.remarks}</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow transition text-center"
                onClick={() => {
                  updateField(printOrder.id, { slipPrinted: true });
                  window.print();
                }}
              >
                🖨️ Print Slip Now
              </button>
              <button
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-xl transition"
                onClick={() => setPrintOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
