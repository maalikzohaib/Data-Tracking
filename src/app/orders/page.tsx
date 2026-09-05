"use client";

import { useEffect, useState, ReactNode } from "react";
import {
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  ShoppingCart,
  DollarSign,
  Wallet,
  BarChart3,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Ban,
  Printer,
  Check,
  Calendar,
  X,
  FileEdit,
  RotateCcw,
} from "lucide-react";
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

type CourierLog = {
  id: string;
  prevInternalStatus?: string | null;
  newInternalStatus: string;
  courierStatus?: string | null;
  courierStatusCode?: string | null;
  source: string;
  createdAt: string;
  rawPayload?: any;
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
  courierProvider: string | null;
  trackingId: string | null;
  trackingUrl: string | null;
  courierStatus?: string | null;
  courierStatusCode?: string | null;
  courierSyncError?: string | null;
  lastCourierSyncAt?: string | null;
  lastStatusChangeAt?: string | null;
  rawCourierResponse?: any;
  courierLogs?: CourierLog[];
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

const COURIERS = ["", "TCS", "Leopards", "M&P", "PostEx", "Run Courier", "Trax", "Daewoo", "Other"];
const STAGES = ["processing", "shipped", "completed", "cancelled"] as const;

// Color palette for order row labels (10 main colors + None)
const COLOR_OPTIONS = [
  { label: "None",    value: "transparent" },
  { label: "Green",   value: "#16a34a" },
  { label: "Lime",    value: "#65a30d" },
  { label: "Orange",  value: "#ea580c" },
  { label: "Yellow",  value: "#ca8a04" },
  { label: "Red",     value: "#dc2626" },
  { label: "Blue",    value: "#2563eb" },
  { label: "Purple",  value: "#9333ea" },
  { label: "Pink",    value: "#db2777" },
  { label: "Cyan",    value: "#0891b2" },
  { label: "Gray",    value: "#52525b" },
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
  "pending",
  "in transit",
  "out for delivery",
  "attempt",
  "delivery attempt",
  "delivered",
  "under review",
  "return initiated",
  "return in transit",
  "return out for delivery",
  "returned",
  "cancel",
  "cancelled",
];

const DELIVERY_STATUS_OPTIONS = [
  { value: "pending under ATC", label: "Pending under ATC" },
  { value: "pending", label: "Pending" },
  { value: "in transit", label: "In Transit" },
  { value: "out for delivery", label: "Out for Delivery" },
  { value: "delivery attempt", label: "Attempt" },
  { value: "delivered", label: "Delivered" },
  { value: "under review", label: "Under Review" },
  { value: "return initiated", label: "Return Initiated" },
  { value: "return in transit", label: "Return in Transit" },
  { value: "return out for delivery", label: "Return Out for Delivery" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancel" },
];

function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

const COURIER_TRACK_URL: Record<string, string> = {
  TCS: "https://www.tcsexpress.com/track/",
  Leopards: "https://www.leopardscourier.com/tracking",
  PostEx: "https://merchant.postex.pk/tracking",
  "Run Courier": "https://portal.runcourier.com",
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

type CourierSubFilter = "all" | "delivered" | "return" | "attempt" | "pending";

function matchesCourierFilter(o: Order, filter: CourierSubFilter): boolean {
  if (filter === "all") return true;

  const st = (o.deliveryStatus || "").toLowerCase();
  const cst = (o.courierStatus || "").toLowerCase();

  if (filter === "delivered") {
    return (
      st.includes("delivered") ||
      st.includes("completed") ||
      cst.includes("delivered") ||
      cst.includes("complete")
    );
  }

  if (filter === "return") {
    if (
      o.cancelled ||
      o.archived ||
      o.courierStatusCode === "0002" ||
      o.courierStatusCode === "0009" ||
      cst.includes("un-assigned") ||
      cst.includes("unassigned")
    ) {
      return false;
    }
    return (
      st.includes("return") ||
      st.includes("returned") ||
      cst.includes("return") ||
      cst.includes("returned")
    );
  }

  if (filter === "attempt") {
    return (
      st.includes("attempt") ||
      st.includes("failed") ||
      cst.includes("attempt") ||
      cst.includes("failed")
    );
  }

  if (filter === "pending") {
    return (
      st.includes("pending") ||
      st.includes("under atc") ||
      st.includes("review") ||
      cst.includes("pending") ||
      cst.includes("booked") ||
      cst.includes("un-assigned") ||
      cst.includes("unassigned") ||
      cst.includes("created")
    );
  }

  return true;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "courierHanded" | "attempt" | "delivered" | "rto" | "cancelled">("active");
  const [courierFilter, setCourierFilter] = useState<CourierSubFilter>("all");
  const [rtoCourierFilter, setRtoCourierFilter] = useState<"all" | "PostEx" | "Leopard" | "Run Courier">("all");
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
  const [postexSyncing, setPostexSyncing] = useState(false);
  const [postexSyncMsg, setPostexSyncMsg] = useState<{
    checked: number;
    updated: number;
    unchanged: number;
    failed: number;
    lastSync: string;
    errors?: string[];
  } | null>(null);
  const [singlePostexSyncing, setSinglePostexSyncing] = useState(false);
  const [rcSyncing, setRcSyncing] = useState(false);
  const [rcSyncMsg, setRcSyncMsg] = useState<{
    checked: number;
    updated: number;
    unchanged: number;
    failed: number;
    lastSync: string;
    errors?: string[];
  } | null>(null);
  const [singleRcSyncing, setSingleRcSyncing] = useState(false);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null); // orderId or null
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkColorPickerOpen, setBulkColorPickerOpen] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const load = () =>
    apiGet<{ orders: Order[] }>("/api/orders?limit=300")
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();

    let es: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout;

    function connectSSE() {
      try {
        es = new EventSource("/api/events");
        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (
              data.type === "order:created" ||
              data.type === "order:updated" ||
              data.type === "shopify:sync" ||
              data.type === "postex:sync" ||
              data.type === "runcourier:sync"
            ) {
              load();
            }
          } catch {
            // Ignore non-json or keepalive messages
          }
        };
        es.onerror = () => {
          es?.close();
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectSSE, 5000);
        };
      } catch {
        // SSE connection failure fallback
      }
    }

    connectSSE();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      es?.close();
      clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function syncShopify() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/shopify/sync?days=14", { method: "POST" });
      const text = await res.text().catch(() => "");
      let j: any = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {}

      if (res.ok && j?.ok) {
        setSyncMsg(`✅ ${j.orders} orders sync ho gaye`);
        await load();
      } else {
        const errMsg = j?.error || (res.status === 504 ? "Server timeout (syncing in background)" : `Sync error (${res.status})`);
        setSyncMsg(`❌ ${String(errMsg).slice(0, 100)}`);
      }
    } catch (e: any) {
      setSyncMsg(`❌ ${String(e?.message || e).slice(0, 100)}`);
    }
    setSyncing(false);
  }

  async function syncPostex(forceAll = false) {
    setPostexSyncing(true);
    setPostexSyncMsg(null);
    try {
      const res = await fetch("/api/postex/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll }),
      });
      const text = await res.text().catch(() => "");
      let j: any = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {}

      if (res.ok && j?.ok) {
        setPostexSyncMsg({
          checked: j.checked,
          updated: j.updated,
          unchanged: j.unchanged,
          failed: j.failed,
          lastSync: j.lastSync,
          errors: j.errors,
        });
        await load();
      } else {
        const errMsg = j?.error || `PostEx error (${res.status})`;
        setSyncMsg(`❌ PostEx: ${String(errMsg).slice(0, 100)}`);
      }
    } catch (e: any) {
      setSyncMsg(`❌ PostEx Sync Error: ${String(e?.message || e).slice(0, 100)}`);
    }
    setPostexSyncing(false);
  }

  async function syncSingleOrderPostex(orderId: string) {
    setSinglePostexSyncing(true);
    try {
      const res = await fetch(`/api/postex/sync?orderId=${encodeURIComponent(orderId)}`, {
        method: "POST",
      });
      const text = await res.text().catch(() => "");
      let j: any = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {}

      if (res.ok && j?.ok && j.order) {
        setEdit(j.order);
        await load();
      } else {
        alert(`PostEx Sync Failed: ${j?.error || `Server returned ${res.status}`}`);
      }
    } catch (e: any) {
      alert(`Error syncing PostEx: ${String(e?.message || e)}`);
    }
    setSinglePostexSyncing(false);
  }

  async function syncRunCourier(forceAll = false) {
    setRcSyncing(true);
    setRcSyncMsg(null);
    try {
      const res = await fetch("/api/runcourier/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll }),
      });
      const text = await res.text().catch(() => "");
      let j: any = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {}

      if (res.ok && j?.ok) {
        setRcSyncMsg({
          checked: j.checked,
          updated: j.updated,
          unchanged: j.unchanged,
          failed: j.failed,
          lastSync: j.lastSync,
          errors: j.errors,
        });
        await load();
      } else {
        const errMsg = j?.error || `Run Courier error (${res.status})`;
        setSyncMsg(`❌ Run Courier: ${String(errMsg).slice(0, 100)}`);
      }
    } catch (e: any) {
      setSyncMsg(`❌ Run Courier Sync Error: ${String(e?.message || e).slice(0, 100)}`);
    }
    setRcSyncing(false);
  }

  async function syncSingleOrderRunCourier(orderId: string) {
    setSingleRcSyncing(true);
    try {
      const res = await fetch(`/api/runcourier/sync?orderId=${encodeURIComponent(orderId)}`, {
        method: "POST",
      });
      const text = await res.text().catch(() => "");
      let j: any = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {}

      if (res.ok && j?.ok && j.order) {
        setEdit(j.order);
        await load();
      } else {
        alert(`Run Courier Sync Failed: ${j?.error || `Server returned ${res.status}`}`);
      }
    } catch (e: any) {
      alert(`Error syncing Run Courier: ${String(e?.message || e)}`);
    }
    setSingleRcSyncing(false);
  }

  /** Dispatch single-order sync to correct provider based on courierProvider field */
  function syncSingleOrder(order: Order) {
    if (order.courierProvider === "run_courier") {
      syncSingleOrderRunCourier(order.id);
    } else {
      syncSingleOrderPostex(order.id);
    }
  }

  function isSingleSyncing(order: Order) {
    if (order.courierProvider === "run_courier") return singleRcSyncing;
    return singlePostexSyncing;
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
      courierProvider: form.courier === "Run Courier" ? "run_courier" : form.courier === "PostEx" ? "postex" : undefined,
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
      courierProvider: edit.courier === "Run Courier" ? "run_courier" : edit.courier === "PostEx" ? "postex" : (edit.courierProvider || undefined),
      shippingAdvance: edit.shippingAdvance || 0,
      totalPrice: edit.totalPrice,
      cogs: edit.cogs,
      trackingId: edit.trackingId || "",
      trackingUrl: edit.trackingUrl || "",
      remarks: edit.remarks || "",
      specialDetails: edit.specialDetails || "",
      deliveryStatus: edit.deliveryStatus || "pending under ATC",
      slipPrinted: edit.slipPrinted,
      isPacked: edit.isPacked,
      isCourierHanded: edit.isCourierHanded,
      archived: edit.archived,
      cancelled: edit.cancelled,
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

  async function bulkUpdate(patch: Partial<Order>) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkUpdating(true);
    setOrders((prev) =>
      prev.map((o) => (selectedIds.has(o.id) ? { ...o, ...patch } : o))
    );
    try {
      await apiSend("/api/orders", "PATCH", { ids, ...patch });
      await load();
      setBulkColorPickerOpen(false);
    } catch (e: any) {
      alert(`Bulk update failed: ${e?.message || e}`);
    }
    setBulkUpdating(false);
  }

  const bulkToggleSlipPrint = () => {
    const targetOrders = orders.filter((o) => selectedIds.has(o.id));
    const allPrinted = targetOrders.length > 0 && targetOrders.every((o) => !!o.slipPrinted);
    bulkUpdate({ slipPrinted: !allPrinted });
  };

  const bulkTogglePack = () => {
    const targetOrders = orders.filter((o) => selectedIds.has(o.id));
    const allPacked = targetOrders.length > 0 && targetOrders.every((o) => !!o.isPacked);
    bulkUpdate({ isPacked: !allPacked });
  };

  const bulkHandover = () => {
    bulkUpdate({ isCourierHanded: true, slipPrinted: true, isPacked: true });
  };

  const bulkColorChange = (color: string) => {
    bulkUpdate({ labelColor: color });
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  async function setArchived(id: string, archived: boolean) {
    await apiSend("/api/orders", "PATCH", { id, archived, cancelled: archived });
    await load();
  }

  async function delOrder(id: string) {
    await apiSend(`/api/orders?id=${id}`, "DELETE");
    load();
  }

  // === 5-Section Filter Logic (Active, Courier, Attempt, Delivered, Cancelled) ===
  // Cancelled: cancelled in Shopify/manual, voided, manually archived, or status is cancel/cancelled/un-assigned
  const isCancelled = (o: Order) =>
    o.cancelled ||
    o.archived ||
    o.stage === "cancelled" ||
    o.financialStatus === "voided" ||
    o.deliveryStatus?.toLowerCase() === "cancelled" ||
    o.deliveryStatus?.toLowerCase() === "cancel" ||
    o.courierStatusCode === "0002" ||
    o.courierStatusCode === "0009" ||
    o.courierStatus?.toLowerCase().includes("un-assigned") ||
    o.courierStatus?.toLowerCase().includes("unassigned");

  // Delivered: manually marked completed/delivered, or courier status is delivered
  const isDelivered = (o: Order) =>
    !isCancelled(o) &&
    (o.stage === "completed" ||
      o.deliveryStatus?.toLowerCase() === "delivered" ||
      o.courierStatus?.toLowerCase() === "delivered" ||
      o.courierStatusCode === "0005");

  // Attempt: delivery attempt made / failed attempt (from manual edit or courier webhook)
  const isAttempt = (o: Order) =>
    !isCancelled(o) &&
    !isDelivered(o) &&
    (o.deliveryStatus?.toLowerCase() === "attempt" ||
      o.deliveryStatus?.toLowerCase() === "delivery attempt" ||
      o.deliveryStatus?.toLowerCase().includes("attempt") ||
      o.courierStatus?.toLowerCase().includes("attempt") ||
      o.courierStatusCode === "0013");

  // Courier Handed: isCourierHanded === true (dispatched), or courier tracking shows in transit/out for delivery/return
  const isCourierHanded = (o: Order) =>
    !isCancelled(o) &&
    !isDelivered(o) &&
    !isAttempt(o) &&
    (!!o.isCourierHanded ||
      o.deliveryStatus?.toLowerCase() === "in transit" ||
      o.deliveryStatus?.toLowerCase() === "out for delivery" ||
      o.deliveryStatus?.toLowerCase().includes("return") ||
      o.deliveryStatus?.toLowerCase() === "under review");

  // Active: everything else (not courier handed, not delivered, not attempt, not cancelled)
  const isActive = (o: Order) =>
    !isCancelled(o) && !isDelivered(o) && !isAttempt(o) && !isCourierHanded(o);

  const getOrderSection = (o: Order): { key: string; label: string; icon: ReactNode; badgeStyle: string } => {
    if (isCancelled(o)) {
      return { key: "cancelled", label: "Cancelled", icon: <Ban className="w-3.5 h-3.5" />, badgeStyle: "bg-red-500/10 text-red-400" };
    }
    if (isDelivered(o)) {
      return { key: "delivered", label: "Delivered", icon: <CheckCircle2 className="w-3.5 h-3.5" />, badgeStyle: "bg-aloe text-black" };
    }
    if (isAttempt(o)) {
      return { key: "attempt", label: "Attempt", icon: <AlertCircle className="w-3.5 h-3.5" />, badgeStyle: "bg-amber-500/15 text-amber-300" };
    }
    if (isCourierHanded(o)) {
      return { key: "courierHanded", label: "Courier Handed", icon: <Truck className="w-3.5 h-3.5" />, badgeStyle: "bg-pistachio text-black" };
    }
    return { key: "active", label: "Active", icon: <ShoppingCart className="w-3.5 h-3.5" />, badgeStyle: "bg-text/10 text-text" };
  };

  const bySearch = (o: Order) =>
    !q ||
    o.orderNumber?.toLowerCase().includes(q.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(q.toLowerCase()) ||
    o.customerPhone?.toLowerCase().includes(q.toLowerCase()) ||
    o.itemName?.toLowerCase().includes(q.toLowerCase()) ||
    o.customerCity?.toLowerCase().includes(q.toLowerCase()) ||
    o.remarks?.toLowerCase().includes(q.toLowerCase());

  const isRtoOrder = (o: Order) => {
    if (isCancelled(o)) return false;
    const cs = (o.courierStatus || "").toLowerCase();
    if (
      cs.includes("un-assigned") ||
      cs.includes("unassigned") ||
      o.courierStatusCode === "0002" ||
      o.courierStatusCode === "0009"
    ) {
      return false;
    }
    const ds = (o.deliveryStatus || "").toLowerCase();
    return (
      ds.includes("return") ||
      ds === "returned" ||
      cs.includes("return") ||
      cs.includes("rts") ||
      cs.includes("returned to shipper") ||
      cs.includes("parcel return")
    );
  };

  const getOrderCourierGroup = (o: Order): "PostEx" | "Leopard" | "Run Courier" | null => {
    const cp = (o.courierProvider || "").toLowerCase();
    const c = (o.courier || "").toLowerCase();
    const tr = (o.trackingId || "").toUpperCase();

    // 1. Run Courier
    if (cp === "run_courier" || c.includes("run")) {
      return "Run Courier";
    }
    // 2. PostEx
    if (cp === "postex" || c.includes("postex") || (!o.courier && /^\d{14}$/.test(tr))) {
      return "PostEx";
    }
    // 3. Leopard
    if (c.includes("leopard") || tr.startsWith("LE")) {
      return "Leopard";
    }
    return null;
  };

  const activeOrders = orders.filter(isActive);
  const courierHandedOrders = orders.filter(isCourierHanded);
  const attemptOrders = orders.filter(isAttempt);
  const deliveredOrders = orders.filter(isDelivered);
  const rtoOrders = orders.filter(isRtoOrder);
  const cancelledOrders = orders.filter(isCancelled);

  // All orders filtered by selected date preset / custom range:
  // Matches if creation date OR latest courier status change date falls within range
  const dateFilteredOrders = orders.filter((o) => {
    if (datePreset === "all") return true;
    if (isWithinDateRange(o.shopifyCreatedAt || (o as any).createdAt, datePreset, customFrom, customTo)) {
      return true;
    }
    if (o.lastStatusChangeAt && isWithinDateRange(o.lastStatusChangeAt, datePreset, customFrom, customTo)) {
      return true;
    }
    if (o.lastCourierSyncAt && isWithinDateRange(o.lastCourierSyncAt, datePreset, customFrom, customTo)) {
      return true;
    }
    return false;
  });

  const courierHandedDateFiltered = dateFilteredOrders.filter(isCourierHanded);
  const courierCountAll = courierHandedDateFiltered.length;
  const courierCountDelivered = courierHandedDateFiltered.filter((o) => matchesCourierFilter(o, "delivered")).length;
  const courierCountReturn = courierHandedDateFiltered.filter((o) => matchesCourierFilter(o, "return")).length;
  const courierCountAttempt = courierHandedDateFiltered.filter((o) => matchesCourierFilter(o, "attempt")).length;
  const courierCountPending = courierHandedDateFiltered.filter((o) => matchesCourierFilter(o, "pending")).length;

  const rtoDateFiltered = dateFilteredOrders.filter(isRtoOrder);

  // 3 Target Courier Companies for RTO Tracking: PostEx, Leopard, Run Courier (no "Other")
  const TARGET_RTO_COURIERS = ["PostEx", "Leopard", "Run Courier"] as const;

  const courierRtoMap = new Map<string, { name: "PostEx" | "Leopard" | "Run Courier"; total: number; rtoCount: number; rtoValue: number }>();
  for (const name of TARGET_RTO_COURIERS) {
    courierRtoMap.set(name, { name, total: 0, rtoCount: 0, rtoValue: 0 });
  }

  for (const o of dateFilteredOrders) {
    const courierName = getOrderCourierGroup(o);
    if (!courierName || !courierRtoMap.has(courierName)) continue;
    const stat = courierRtoMap.get(courierName)!;
    stat.total++;
    if (isRtoOrder(o)) {
      stat.rtoCount++;
      stat.rtoValue += o.totalPrice || 0;
    }
  }

  const courierRtoStats = TARGET_RTO_COURIERS.map((name) => courierRtoMap.get(name)!);
  const totalDispatched = courierRtoStats.reduce((sum, c) => sum + c.total, 0) || dateFilteredOrders.length;
  const overallRtoRate = totalDispatched > 0 ? ((rtoDateFiltered.length / totalDispatched) * 100).toFixed(1) : "0";
  const rtoTotalValue = rtoDateFiltered.reduce((sum, o) => sum + o.totalPrice, 0);

  const postexStat = courierRtoStats.find((c) => c.name === "PostEx");
  const postexRate = postexStat && postexStat.total > 0 ? ((postexStat.rtoCount / postexStat.total) * 100).toFixed(1) : "0";

  const rcStat = courierRtoStats.find((c) => c.name === "Run Courier");
  const rcRate = rcStat && rcStat.total > 0 ? ((rcStat.rtoCount / rcStat.total) * 100).toFixed(1) : "0";

  const leopardStat = courierRtoStats.find((c) => c.name === "Leopard");
  const leopardRate = leopardStat && leopardStat.total > 0 ? ((leopardStat.rtoCount / leopardStat.total) * 100).toFixed(1) : "0";

  // GLOBAL SEARCH: If search query 'q' is entered, search across ALL date-filtered orders regardless of current tab.
  // TAB FILTER: If no search query, filter date-filtered orders by currently selected section tab and sub-filter.
  const shown = q
    ? dateFilteredOrders.filter(bySearch)
    : dateFilteredOrders.filter((o) => {
        if (tab === "active") return isActive(o);
        if (tab === "courierHanded") return isCourierHanded(o) && matchesCourierFilter(o, courierFilter);
        if (tab === "attempt") return isAttempt(o);
        if (tab === "delivered") return isDelivered(o);
        if (tab === "rto") {
          if (!isRtoOrder(o)) return false;
          if (rtoCourierFilter === "all") return true;
          return getOrderCourierGroup(o) === rtoCourierFilter;
        }
        return isCancelled(o);
      });

  const allShownSelected = shown.length > 0 && shown.every((o) => selectedIds.has(o.id));
  const someShownSelected = shown.some((o) => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    if (allShownSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        shown.forEach((o) => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        shown.forEach((o) => next.add(o.id));
        return next;
      });
    }
  };

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const allSelectedSlipPrinted = selectedOrders.length > 0 && selectedOrders.every((o) => !!o.slipPrinted);
  const allSelectedPacked = selectedOrders.length > 0 && selectedOrders.every((o) => !!o.isPacked);

  // Dynamic KPI Cards per tab state or global search
  const renderKpiCards = () => {
    if (q) {
      const totalCount = shown.length;
      const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);

      const deliveredCount = shown.filter(isDelivered).length;
      const deliveredVal = shown.filter(isDelivered).reduce((sum, o) => sum + o.totalPrice, 0);

      const activeOrHanded = shown.filter((o) => !isDelivered(o) && !isCancelled(o));
      const activeHandedCount = activeOrHanded.length;
      const activeHandedVal = activeOrHanded.reduce((sum, o) => sum + o.totalPrice, 0);

      return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Global Matches" value={String(totalCount)} sub={`Search results for "${q}"`} icon={<Search className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
          <StatCard label="Total Match Value" value={fmtPKR(totalSales)} sub="Total value of results" icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="good" />
          <StatCard label="Delivered Matched" value={String(deliveredCount)} sub={`Val: ${fmtPKR(deliveredVal)}`} icon={<CheckCircle2 className="w-5 h-5 stroke-[1.75]" />} tone="accent" />
          <StatCard label="Active / Handed" value={String(activeHandedCount)} sub={`Val: ${fmtPKR(activeHandedVal)}`} icon={<Truck className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
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
          <StatCard label="Total Active Orders" value={String(totalCount)} sub="Active orders" icon={<ShoppingCart className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
          <StatCard label="Active Sales" value={fmtPKR(totalSales)} sub="Total active value" icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="good" />
          <StatCard label="Pending Confirmation" value={String(unconfirmedCount)} sub={`Val: ${fmtPKR(unconfirmedVal)}`} icon={<Clock className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
          <StatCard label="Pending Fulfillment" value={String(pendingFulfillCount)} sub={`Val: ${fmtPKR(pendingFulfillVal)}`} icon={<Package className="w-5 h-5 stroke-[1.75]" />} tone="accent" />
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
          <StatCard label="Total Handed Orders" value={String(totalCount)} sub="With courier" icon={<Truck className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
          <StatCard label="Handed Sales" value={fmtPKR(totalSales)} sub="Total handed value" icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="good" />
          <StatCard label="COD Amount to Receive" value={fmtPKR(codVal)} sub={`${codOrders.length} COD orders`} icon={<Wallet className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
          <StatCard label="Orders in Transit" value={String(inTransitCount)} sub={`Val: ${fmtPKR(inTransitVal)}`} icon={<Truck className="w-5 h-5 stroke-[1.75]" />} tone="accent" />
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
          <StatCard label="Total Delivered Orders" value={String(totalCount)} sub="Delivered & completed" icon={<CheckCircle2 className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
          <StatCard label="Total Received Sales" value={fmtPKR(totalSales)} sub="Completed sales" icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="good" />
          <StatCard label="Total COD Received" value={fmtPKR(codReceived)} sub="COD collected" icon={<Wallet className="w-5 h-5 stroke-[1.75]" />} tone="accent" />
          <StatCard label="Average Order Value" value={fmtPKR(aov)} sub="AOV per order" icon={<BarChart3 className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
        </div>
      );
    }

    if (tab === "rto") {
      const filteredRtoCount = shown.length;
      const filteredRtoVal = shown.reduce((sum, o) => sum + o.totalPrice, 0);
      const inTransitRtos = shown.filter((o) => (o.deliveryStatus || "").toLowerCase().includes("transit")).length;
      const selectedStat = courierRtoStats.find((c) => c.name === rtoCourierFilter);
      const courierRate = selectedStat && selectedStat.total > 0
        ? ((selectedStat.rtoCount / selectedStat.total) * 100).toFixed(1)
        : overallRtoRate;

      return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard
            label={rtoCourierFilter === "all" ? "Business RTO Return Ratio" : `${rtoCourierFilter} Return Ratio`}
            value={rtoCourierFilter === "all" ? `${overallRtoRate}%` : `${courierRate}%`}
            sub={rtoCourierFilter === "all" ? `${rtoDateFiltered.length} returned of ${totalDispatched} dispatched` : `${filteredRtoCount} returned of ${selectedStat?.total || filteredRtoCount} dispatched`}
            icon={<RotateCcw className="w-5 h-5 stroke-[1.75]" />}
            tone="brand"
          />
          <StatCard
            label={rtoCourierFilter === "all" ? "Total RTO Orders" : `${rtoCourierFilter} RTO Orders`}
            value={String(filteredRtoCount)}
            sub={rtoCourierFilter === "all" ? "Across all 3 couriers" : `${rtoCourierFilter} shipments only`}
            icon={<Package className="w-5 h-5 stroke-[1.75]" />}
            tone="brand"
          />
          <StatCard
            label={rtoCourierFilter === "all" ? "Total RTO Loss Value" : `${rtoCourierFilter} Loss Value`}
            value={fmtPKR(filteredRtoVal)}
            sub="Returned product value"
            icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />}
            tone="warn"
          />
          <StatCard
            label="In Transit to Origin"
            value={String(inTransitRtos)}
            sub={`${filteredRtoCount - inTransitRtos} fully returned`}
            icon={<AlertTriangle className="w-5 h-5 stroke-[1.75]" />}
            tone="accent"
          />
        </div>
      );
    }

    if (tab === "attempt") {
      const totalCount = shown.length;
      const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);
      const postexAttempts = shown.filter((o) => o.courierProvider === "postex" || o.courier?.toLowerCase() === "postex").length;
      const otherAttempts = totalCount - postexAttempts;

      return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Attempts" value={String(totalCount)} sub="Orders with delivery attempt" icon={<AlertCircle className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
          <StatCard label="Attempt Order Value" value={fmtPKR(totalSales)} sub="Value requiring follow-up" icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
          <StatCard label="PostEx Attempts" value={String(postexAttempts)} sub="PostEx couriers" icon={<Truck className="w-5 h-5 stroke-[1.75]" />} tone="accent" />
          <StatCard label="Other Couriers" value={String(otherAttempts)} sub="Manual & other attempts" icon={<Package className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
        </div>
      );
    }

    // Cancelled tab
    const totalCount = shown.length;
    const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);
    const shopifyCancelled = shown.filter((o) => o.source === "shopify").length;
    const manualCancelled = shown.filter((o) => o.source === "manual").length;

    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Cancelled" value={String(totalCount)} sub="All cancel orders" icon={<Ban className="w-5 h-5 stroke-[1.75]" />} tone="bad" />
        <StatCard label="Cancelled Order Value" value={fmtPKR(totalSales)} sub="Lost sales revenue" icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="bad" />
        <StatCard label="Shopify Cancelled" value={String(shopifyCancelled)} sub="From Shopify store" icon={<Package className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
        <StatCard label="Manual Cancelled" value={String(manualCancelled)} sub="Directly marked cancel" icon={<XCircle className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
      </div>
    );
  };

  return (
    <>
      {/* Filter Bar: Date Presets & Custom Range & Search & Sync */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted bg-panel2 px-3.5 py-1.5 rounded-pill">
            <Calendar className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Date:</span>
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
            <div className="flex items-center gap-2 bg-panel2 px-3.5 py-1 rounded-pill">
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

          {syncMsg && <span className="text-xs text-muted bg-panel2 px-3 py-1 rounded-pill">{syncMsg}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 pointer-events-none stroke-[1.75]" />
            <input
              className="input !pl-9 pr-8 py-1.5 text-xs w-[220px] sm:w-[280px] !rounded-pill"
              placeholder="Search Order #, name, phone, item..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 text-xs text-muted hover:text-text"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button className="btn-ghost whitespace-nowrap text-xs py-1.5 !px-4 flex items-center gap-1.5" onClick={syncShopify} disabled={syncing}>
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing…" : "Sync Shopify"}</span>
          </button>

          <button className="btn-primary whitespace-nowrap text-xs py-1.5 !px-4 flex items-center gap-1.5 cursor-pointer" onClick={() => syncPostex(true)} disabled={postexSyncing}>
            <Truck className={`w-3.5 h-3.5 ${postexSyncing ? "animate-bounce" : ""}`} />
            <span>{postexSyncing ? "Checking PostEx…" : "Sync PostEx"}</span>
          </button>

          <button className="btn-primary whitespace-nowrap text-xs py-1.5 !px-4 flex items-center gap-1.5 cursor-pointer" onClick={() => syncRunCourier(true)} disabled={rcSyncing} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <Truck className={`w-3.5 h-3.5 ${rcSyncing ? "animate-bounce" : ""}`} />
            <span>{rcSyncing ? "Checking Run Courier…" : "Sync Run Courier"}</span>
          </button>
        </div>
      </div>

      {/* PostEx Sync Summary Banner */}
      {postexSyncMsg && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-panel2 px-4 py-3 rounded-shopify-lg mb-5 text-xs">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-aloe animate-pulse" />
            <span className="font-semibold text-text">PostEx Sync Complete</span>
            {postexSyncMsg.checked === 0 ? (
              <span className="text-muted">
                0 orders had a Tracking Number. Enter tracking numbers on your orders or click <strong>Edit</strong> to sync with PostEx.
              </span>
            ) : (
              <span className="text-muted">
                Orders Checked: <strong className="text-text">{postexSyncMsg.checked}</strong> · 
                Updated: <strong className="text-good">{postexSyncMsg.updated}</strong> · 
                Unchanged: <strong className="text-text">{postexSyncMsg.unchanged}</strong>
                {postexSyncMsg.failed > 0 && <> · Failed: <strong className="text-bad">{postexSyncMsg.failed}</strong></>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-micro text-muted">Last Sync: {fmtDate(postexSyncMsg.lastSync)}</span>
            <button onClick={() => setPostexSyncMsg(null)} className="text-muted hover:text-text">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Run Courier Sync Summary Banner */}
      {rcSyncMsg && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-panel2 px-4 py-3 rounded-shopify-lg mb-5 text-xs">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-[#8b5cf6] animate-pulse" />
            <span className="font-semibold text-text">Run Courier Sync Complete</span>
            {rcSyncMsg.checked === 0 ? (
              <span className="text-muted">
                0 orders with Run Courier provider found. Set courier to &quot;Run Courier&quot; and add tracking numbers to sync.
              </span>
            ) : (
              <span className="text-muted">
                Orders Checked: <strong className="text-text">{rcSyncMsg.checked}</strong> · 
                Updated: <strong className="text-good">{rcSyncMsg.updated}</strong> · 
                Unchanged: <strong className="text-text">{rcSyncMsg.unchanged}</strong>
                {rcSyncMsg.failed > 0 && <> · Failed: <strong className="text-bad">{rcSyncMsg.failed}</strong></>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-micro text-muted">Last Sync: {fmtDate(rcSyncMsg.lastSync)}</span>
            <button onClick={() => setRcSyncMsg(null)} className="text-muted hover:text-text">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
              <label className="label">Payment Method</label>
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
        <div className="flex items-center justify-between bg-aloe px-4 py-3 rounded-shopify-lg mb-5 text-xs font-medium">
          <div className="flex items-center gap-2 text-black">
            <Search className="w-4 h-4 shrink-0 stroke-[2]" />
            <span>
              Searching <strong>Globally across ALL sections</strong> for "<strong>{q}</strong>" — {shown.length} order{shown.length === 1 ? "" : "s"} found.
            </span>
          </div>
          <button onClick={() => setQ("")} className="bg-black text-white px-3 py-1 rounded-pill text-xs font-medium transition hover:bg-shade-70 flex items-center gap-1">
            <X className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* Business RTO Overview Banner (Only shown in RTO Calculation section) */}
      {tab === "rto" && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-panel2 px-4 py-2.5 rounded-shopify-lg mb-5 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-warn/15 flex items-center justify-center text-warn shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-muted font-medium">All Orders Business RTO Ratio: </span>
              <span className="font-bold text-sm text-warn ml-1">{overallRtoRate}%</span>
              <span className="text-muted ml-2">
                ({rtoDateFiltered.length} return{rtoDateFiltered.length === 1 ? "" : "s"} of {totalDispatched} dispatched shipments)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-micro text-muted">
            <span>PostEx: <strong className="text-text">{postexStat?.rtoCount || 0}</strong> ({postexRate}%)</span>
            <span>Run Courier: <strong className="text-text">{rcStat?.rtoCount || 0}</strong> ({rcRate}%)</span>
            <span>Leopard: <strong className="text-text">{leopardStat?.rtoCount || 0}</strong> ({leopardRate}%)</span>
          </div>
        </div>
      )}

      {/* Section Tabs & Courier Sub-Filters (Borderless & clean) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="inline-flex rounded-pill bg-panel2 p-1">
          {([
            { k: "active" as const, l: `Active (${activeOrders.length})`, icon: ShoppingCart },
            { k: "courierHanded" as const, l: `Courier (${courierHandedOrders.length})`, icon: Truck },
            { k: "attempt" as const, l: `Attempt (${attemptOrders.length})`, icon: AlertCircle },
            { k: "delivered" as const, l: `Delivered (${deliveredOrders.length})`, icon: CheckCircle2 },
            { k: "rto" as const, l: `RTO Calculation (${rtoDateFiltered.length})`, icon: RotateCcw },
            { k: "cancelled" as const, l: `Cancelled (${cancelledOrders.length})`, icon: Ban },
          ]).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                onClick={() => {
                  setTab(t.k);
                  setSelectedIds(new Set());
                  setBulkColorPickerOpen(false);
                  if (t.k === "courierHanded") setCourierFilter("all");
                  if (t.k === "rto") setRtoCourierFilter("all");
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-pill transition-all ${
                  tab === t.k ? "bg-text text-bg shadow-sm font-semibold" : "text-muted hover:text-text"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{t.l}</span>
              </button>
            );
          })}
        </div>

        {/* Courier Status Sub-Filters (Only inside Courier section) */}
        {tab === "courierHanded" && (
          <div className="inline-flex rounded-pill bg-panel2 p-1 gap-1">
            {[
              { k: "all" as const, l: "All", count: courierCountAll },
              { k: "delivered" as const, l: "Delivered", count: courierCountDelivered },
              { k: "return" as const, l: "Return", count: courierCountReturn },
              { k: "attempt" as const, l: "Delivery Attempt", count: courierCountAttempt },
              { k: "pending" as const, l: "Pending", count: courierCountPending },
            ].map((sf) => (
              <button
                key={sf.k}
                onClick={() => setCourierFilter(sf.k)}
                className={`px-3 py-1 text-xs font-medium rounded-pill transition-all ${
                  courierFilter === sf.k
                    ? "bg-aloe text-black shadow-sm font-semibold"
                    : "text-muted hover:text-text hover:bg-panel"
                }`}
              >
                {sf.l} <span className="opacity-75">({sf.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* RTO Courier Company Sub-Filters (Only inside RTO section: All, PostEx, Leopard, Run Courier) */}
        {tab === "rto" && (
          <div className="inline-flex rounded-pill bg-panel2 p-1 gap-1 flex-wrap">
            <button
              onClick={() => setRtoCourierFilter("all")}
              className={`px-3 py-1 text-xs font-medium rounded-pill transition-all ${
                rtoCourierFilter === "all"
                  ? "bg-aloe text-black shadow-sm font-semibold"
                  : "text-muted hover:text-text hover:bg-panel"
              }`}
            >
              All Couriers <span className="opacity-80">({rtoDateFiltered.length})</span>
            </button>
            {courierRtoStats.map((c) => (
              <button
                key={c.name}
                onClick={() => setRtoCourierFilter(c.name)}
                className={`px-3 py-1 text-xs font-medium rounded-pill transition-all ${
                  rtoCourierFilter === c.name
                    ? "bg-aloe text-black shadow-sm font-semibold"
                    : "text-muted hover:text-text hover:bg-panel"
                }`}
              >
                {c.name} <span className="opacity-80">({c.rtoCount})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Orders table */}
      <Card
        title={
          tab === "active" ? "Active Orders" :
          tab === "courierHanded" ? (courierFilter === "all" ? "Courier Handed Orders" : `Courier Handed — ${courierFilter === "attempt" ? "Delivery Attempt" : courierFilter === "return" ? "Return" : courierFilter.charAt(0).toUpperCase() + courierFilter.slice(1)}`) :
          tab === "attempt" ? `Attempt Orders (${shown.length})` :
          tab === "delivered" ? "Delivered Orders" :
          tab === "rto" ? (rtoCourierFilter === "all" ? `RTO Orders — All Couriers (${shown.length})` : `RTO Orders — ${rtoCourierFilter} (${shown.length})`) :
          "Cancelled Orders"
        }
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap bg-panel2 px-2.5 py-1 rounded-pill border border-border">
                <span className="text-xs font-semibold text-text mr-1">
                  {selectedIds.size} Selected
                </span>

                {/* 1. Slip Print */}
                <button
                  type="button"
                  onClick={bulkToggleSlipPrint}
                  disabled={bulkUpdating}
                  className="btn-ghost !py-1 !px-2.5 text-xs font-medium inline-flex items-center gap-1 hover:border-text cursor-pointer"
                  title={allSelectedSlipPrinted ? "Uncheck Slip Print for selected orders" : "Mark Slip Print as completed for selected orders"}
                >
                  <Printer className="w-3 h-3" />
                  <span>{allSelectedSlipPrinted ? "Uncheck Slip" : "Slip Print"}</span>
                </button>

                {/* 2. Pack */}
                <button
                  type="button"
                  onClick={bulkTogglePack}
                  disabled={bulkUpdating}
                  className="btn-ghost !py-1 !px-2.5 text-xs font-medium inline-flex items-center gap-1 hover:border-text cursor-pointer"
                  title={allSelectedPacked ? "Uncheck Pack for selected orders" : "Mark Pack as completed for selected orders"}
                >
                  <Package className="w-3 h-3" />
                  <span>{allSelectedPacked ? "Uncheck Pack" : "Pack"}</span>
                </button>

                {/* 2. Handover */}
                <button
                  type="button"
                  onClick={bulkHandover}
                  disabled={bulkUpdating}
                  className="btn !py-1 !px-2.5 text-xs font-medium inline-flex items-center gap-1 bg-pistachio text-black hover:opacity-90 transition border-0 cursor-pointer"
                  title="Handover selected orders to courier"
                >
                  <Truck className="w-3 h-3 stroke-[2]" />
                  <span>Handover</span>
                </button>

                {/* 3. Color Change */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setBulkColorPickerOpen(!bulkColorPickerOpen)}
                    disabled={bulkUpdating}
                    className="btn-ghost !py-1 !px-2.5 text-xs font-medium inline-flex items-center gap-1 hover:border-text cursor-pointer"
                    title="Change label color for selected orders"
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-border bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-400 inline-block" />
                    <span>Color Change</span>
                  </button>

                  {bulkColorPickerOpen && (
                    <div className="absolute right-0 top-8 z-50 bg-panel border border-border rounded-shopify-lg shadow-modal p-2 flex gap-1.5 flex-wrap w-[140px]">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          title={c.label}
                          onClick={() => {
                            bulkColorChange(c.value);
                          }}
                          className="w-6 h-6 rounded-pill border transition hover:scale-110 border-border opacity-80 hover:opacity-100 cursor-pointer"
                          style={{ backgroundColor: c.value === "transparent" ? "transparent" : c.value }}
                        >
                          {c.value === "transparent" && <span className="text-[9px] text-muted leading-none">✕</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deselect */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set());
                    setBulkColorPickerOpen(false);
                  }}
                  className="text-muted hover:text-text text-xs p-1 ml-0.5 cursor-pointer"
                  title="Deselect all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button className="btn-primary flex items-center gap-1 text-xs !py-1.5 !px-3" onClick={() => setShowForm(!showForm)}>
              <span>{showForm ? "✕ Close" : "+ Naya Order"}</span>
            </button>
          </div>
        }
      >
        {/* RTO Analysis Breakdown Bar (Only in RTO section: 3 couriers - PostEx, Leopard, Run Courier) — completely borderless */}
        {tab === "rto" && (
          <div className="mb-5 p-4 rounded-shopify-lg bg-panel2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-semibold text-xs text-text uppercase tracking-wider">
                  Courier Return Ratio Analysis
                </span>
                <span className="text-micro text-muted ml-2">
                  (Overall Return Ratio: <strong className="text-text font-bold">{overallRtoRate}%</strong> · {rtoDateFiltered.length} returned out of {totalDispatched} dispatched)
                </span>
              </div>
              {rtoCourierFilter !== "all" && (
                <button
                  onClick={() => setRtoCourierFilter("all")}
                  className="text-micro text-aloe hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  Show All Couriers
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {courierRtoStats.map((c) => {
                const cRate = c.total > 0 ? ((c.rtoCount / c.total) * 100).toFixed(1) : "0";
                const isSelected = rtoCourierFilter === c.name;
                return (
                  <div
                    key={c.name}
                    onClick={() => setRtoCourierFilter(isSelected ? "all" : c.name)}
                    className={`p-3.5 rounded-shopify-md transition-all cursor-pointer ${
                      isSelected
                        ? "bg-aloe/15 shadow-sm"
                        : "bg-panel hover:bg-panel/75"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className={`w-3.5 h-3.5 ${isSelected ? "text-aloe" : "text-muted"}`} />
                        <span className="font-semibold text-xs text-text">{c.name}</span>
                      </div>
                      <span className={`pill text-micro font-semibold ${isSelected ? "bg-aloe text-black" : "bg-panel2 text-text"}`}>
                        {c.rtoCount} RTO{c.rtoCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2 text-micro text-muted">
                      <div>
                        <div>Return Ratio</div>
                        <div className={`font-bold text-xs mt-0.5 ${parseFloat(cRate) > 20 ? "text-bad" : parseFloat(cRate) > 10 ? "text-warn" : "text-text"}`}>
                          {cRate}%
                        </div>
                      </div>
                      <div>
                        <div>RTO Loss</div>
                        <div className="font-semibold text-text mt-0.5">{fmtPKR(c.rtoValue)}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted mt-2 pt-1.5 flex items-center justify-between">
                      <span>{c.total} dispatched</span>
                      <span className={isSelected ? "text-aloe font-semibold" : "text-muted hover:text-text"}>
                        {isSelected ? "Filtered ✓" : "Click to filter"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState text={
            loading
              ? "Orders load ho rahe hain…"
              : q
              ? `No orders found matching "${q}" in ${tab === "active" ? "Active" : tab === "courierHanded" ? "Courier Handed" : tab === "attempt" ? "Attempt" : tab === "delivered" ? "Delivered" : tab === "rto" ? "RTO Calculation" : "Cancelled"}.`
              : datePreset !== "all"
              ? `No orders found for selected date filter in ${tab === "active" ? "Active" : tab === "courierHanded" ? "Courier Handed" : tab === "attempt" ? "Attempt" : tab === "delivered" ? "Delivered" : tab === "rto" ? "RTO Calculation" : "Cancelled"}.`
              : tab === "active" ? "No active orders found." :
                tab === "courierHanded" ? "No courier handed orders found." :
                tab === "attempt" ? "No attempt orders found." :
                tab === "delivered" ? "No delivered orders found." :
                tab === "rto" ? (rtoCourierFilter === "all" ? "No RTO orders found for selected criteria." : `No RTO orders found for ${rtoCourierFilter}.`) :
                "No cancelled orders found."
          } />
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[160px]">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-panel2 shadow-sm">
                <tr className="bg-panel2 text-muted uppercase font-medium text-eyebrow border-b border-border">
                  <th className="py-3 px-2 text-center whitespace-nowrap w-8">
                    <input
                      type="checkbox"
                      checked={allShownSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allShownSelected && someShownSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border border-border bg-panel2 text-text focus:ring-text accent-text cursor-pointer"
                      title="Select all orders"
                    />
                  </th>
                  <th className="py-3 px-1.5 text-center whitespace-nowrap min-w-[32px]">#</th>
                  <th className="py-3 px-1 text-center whitespace-nowrap"></th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Date</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Order No #</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Name</th>
                  <th className="py-3 px-2 min-w-[180px]">Item Name</th>
                  <th className="py-3 px-1 text-center whitespace-nowrap">Qty</th>
                  <th className="py-3 px-1.5 text-right whitespace-nowrap">Price</th>
                  <th className="py-3 px-1 text-center whitespace-nowrap">Confirmation</th>
                  <th className="py-3 px-1 whitespace-nowrap">Payment</th>
                  <th className="py-3 px-1 text-center whitespace-nowrap">Slip Print</th>
                  <th className="py-3 px-1 text-center whitespace-nowrap">Packed</th>
                  <th className="py-3 px-1 text-center whitespace-nowrap">Courier Hand</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Contact No</th>
                  <th className="py-3 px-2 min-w-[150px]">Remarks</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Status</th>
                  <th className="py-3 px-1.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-0">
                {shown.map((o, index) => {
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

                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-panel2/40 transition-colors ${selectedIds.has(o.id) ? "bg-aloe/10" : ""}`}
                      style={rowColor ? { backgroundColor: `${rowColor}18` } : undefined}
                    >
                      {/* Bulk Select Checkbox */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelectOrder(o.id)}
                          className="h-4 w-4 rounded border border-border bg-panel2 text-text focus:ring-text accent-text cursor-pointer"
                          title="Select order"
                        />
                      </td>

                      {/* Numbering */}
                      <td className="py-2.5 px-1.5 text-center text-muted font-mono font-medium text-xs">
                        {index + 1}
                      </td>

                      {/* Color Label */}
                      <td className="py-2.5 px-1 text-center relative">
                        <button
                          onClick={() => setColorPickerOpen(colorPickerOpen === o.id ? null : o.id)}
                          className="w-5 h-5 rounded-pill border border-border hover:scale-110 cursor-pointer transition inline-block"
                          style={{ backgroundColor: rowColor || undefined }}
                          title="Set order color"
                        />
                        {colorPickerOpen === o.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setColorPickerOpen(null)} />
                            <div className={`absolute left-6 ${index > 0 && index >= shown.length - 2 ? "bottom-1" : "top-1"} z-50 bg-panel border border-border rounded-shopify-lg shadow-modal p-2 flex gap-1.5 flex-wrap w-[140px]`}>
                              {COLOR_OPTIONS.map((c) => (
                                <button
                                  key={c.value}
                                  title={c.label}
                                  onClick={() => {
                                    updateField(o.id, { labelColor: c.value } as Partial<Order>);
                                    setColorPickerOpen(null);
                                  }}
                                  className={`w-6 h-6 rounded-pill border transition hover:scale-110 ${
                                    (o.labelColor || "transparent") === c.value
                                      ? "ring-2 ring-text border-text"
                                      : "border-border opacity-80 hover:opacity-100"
                                  }`}
                                  style={{ backgroundColor: c.value === "transparent" ? "transparent" : c.value }}
                                >
                                  {c.value === "transparent" && <span className="text-[9px] text-muted leading-none">✕</span>}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                      {/* 1. Date */}
                      <td className="py-2.5 px-2 text-muted whitespace-nowrap font-medium">
                        {fmtDate(o.shopifyCreatedAt)}
                      </td>

                      {/* 2. Order No # (Clickable to View Details) */}
                      <td className="py-2.5 px-2 font-bold text-text whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEdit(o)}
                          className="flex items-center gap-1.5 hover:text-aloe text-left group"
                          title="Click to view full order & courier tracking details"
                        >
                          <span className="underline decoration-dotted underline-offset-2">{o.orderNumber || "—"}</span>
                          <FileEdit className="w-3 h-3 opacity-0 group-hover:opacity-100 text-muted transition" />
                          {o.source === "manual" && <span className="text-[10px] text-brand-light" title="Manual order">✍</span>}
                        </button>
                      </td>

                      {/* 3. Name */}
                      <td className="py-2.5 px-2 font-medium text-text">
                        {o.customerName || "—"}
                      </td>

                      {/* 4. Item Name */}
                      <td className="py-2.5 px-2 text-text font-medium min-w-[180px] max-w-[280px]" title={displayItem}>
                        <div className="line-clamp-2 leading-snug">{displayItem}</div>
                      </td>

                      {/* 5. Quantity */}
                      <td className="py-2.5 px-1 text-center font-semibold text-text">
                        {qty}
                      </td>

                      {/* 6. Price */}
                      <td className="py-2.5 px-1.5 text-right font-bold text-good whitespace-nowrap">
                        {fmtPKR(o.totalPrice)}
                      </td>

                      {/* 7. Confirmation */}
                      <td className="py-2.5 px-1 text-center">
                        <button
                          onClick={() =>
                            updateField(o.id, {
                              confirmationStatus: isConfirmed ? "pending" : "confirmed",
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-medium border-0 transition ${
                            isConfirmed
                              ? "bg-aloe text-black"
                              : "bg-warn/15 text-warn hover:bg-warn/25"
                          }`}
                        >
                          {isConfirmed ? (
                            <>
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span>Confirmed</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 stroke-[2]" />
                              <span>Pending</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* 8. Payment (Type Only: COD / Online Payment) */}
                      <td className="py-2.5 px-1">
                        <select
                          value={payMethod === "Online Payment" ? "Online Payment" : "COD"}
                          onChange={(e) => updateField(o.id, { paymentMethod: e.target.value })}
                          className="bg-panel2 text-xs font-medium text-text border border-border rounded-shopify-sm px-1.5 py-0.5 focus:outline-none focus:border-text cursor-pointer"
                        >
                          <option value="COD">COD</option>
                          <option value="Online Payment">Online Payment</option>
                        </select>
                      </td>

                      {/* 9. Slip Print (Checkbox Only) */}
                      <td className="py-2.5 px-1 text-center">
                        <input
                          type="checkbox"
                          checked={!!o.slipPrinted}
                          onChange={(e) => updateField(o.id, { slipPrinted: e.target.checked })}
                          className="h-4 w-4 rounded border border-border bg-panel2 text-text focus:ring-text accent-text cursor-pointer"
                          title="Checkmark if slip is printed"
                        />
                      </td>

                      {/* 10. Packed */}
                      <td className="py-2.5 px-1 text-center">
                        <input
                          type="checkbox"
                          checked={!!o.isPacked}
                          onChange={(e) => updateField(o.id, { isPacked: e.target.checked })}
                          className="h-4 w-4 rounded border border-border bg-panel2 text-text focus:ring-text accent-text cursor-pointer"
                        />
                      </td>

                      {/* 11. Courier Hand */}
                      <td className="py-2.5 px-1 text-center">
                        <button
                          onClick={() => {
                            if (!o.isCourierHanded) {
                              updateField(o.id, {
                                isCourierHanded: true,
                                slipPrinted: true,
                                isPacked: true,
                              });
                            } else {
                              updateField(o.id, {
                                isCourierHanded: false,
                              });
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-medium border-0 transition cursor-pointer ${
                            o.isCourierHanded
                              ? "bg-pistachio text-black"
                              : "bg-panel2 text-muted hover:text-text border border-border"
                          }`}
                        >
                          {o.isCourierHanded ? (
                            <>
                              <Truck className="w-3 h-3 stroke-[2]" />
                              <span>Dispatched</span>
                            </>
                          ) : (
                            <span>Handover</span>
                          )}
                        </button>
                      </td>

                      {/* 12. Contact No (Auto-fetched from Shopify, formatted 03xx + Inline Editable) */}
                      <td className="py-2.5 px-1.5">
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
                          className="bg-transparent hover:bg-panel2 focus:bg-panel2 text-xs text-text border-0 outline-none rounded-shopify-sm px-1.5 py-1 w-full transition"
                        />
                      </td>

                      {/* 13. Remarks (Inline Manual Edit - Borderless) */}
                      <td className="py-2.5 px-2 min-w-[150px]">
                        <input
                          type="text"
                          defaultValue={o.remarks || ""}
                          placeholder="Add remarks..."
                          onBlur={(e) => {
                            if (e.target.value !== (o.remarks || "")) {
                              updateField(o.id, { remarks: e.target.value });
                            }
                          }}
                          className="bg-panel2 hover:bg-shade-30/30 focus:bg-panel2 text-xs text-text border border-border outline-none rounded-shopify-md px-2.5 py-1 w-full transition placeholder:text-muted/40"
                        />
                      </td>

                      {/* 14. Status */}
                      <td className="py-2.5 px-2">
                        <div className="flex flex-col gap-1">
                          <select
                            value={
                              isCancelled(o)
                                ? "cancelled"
                                : isAttempt(o)
                                ? "delivery attempt"
                                : o.deliveryStatus || "pending under ATC"
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              const isCancelling = val === "cancelled" || val === "cancel";
                              const isAtt = val === "attempt" || val === "delivery attempt";
                              updateField(o.id, {
                                deliveryStatus: isAtt ? "delivery attempt" : val,
                                cancelled: isCancelling,
                                archived: isCancelling,
                                isCourierHanded: isAtt ? true : o.isCourierHanded,
                              });
                            }}
                            className="bg-panel2 text-xs text-text border border-border rounded-shopify-sm px-1.5 py-1 focus:outline-none focus:border-text cursor-pointer capitalize"
                          >
                            {DELIVERY_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {o.courier && (
                            <div className="text-[10px] text-aloe font-medium">
                              {o.courier}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 15 & 16. Actions: View & Cancel/Restore */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEdit(o)}
                          className="btn-ghost !py-1 !px-3 text-xs mr-2 font-medium text-text hover:text-aloe inline-flex items-center gap-1"
                        >
                          <span>View</span>
                        </button>
                        {!isCancelled(o) ? (
                          <button
                            className="text-muted hover:text-bad hover:underline text-xs"
                            onClick={() => {
                              updateField(o.id, { cancelled: true, archived: true, deliveryStatus: "cancelled" });
                            }}
                            title="Cancel this order"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            className="text-brand-light hover:underline text-xs"
                            onClick={() => {
                              updateField(o.id, { cancelled: false, archived: false, deliveryStatus: "pending under ATC" });
                            }}
                            title="Restore this order"
                          >
                            Restore
                          </button>
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

      {/* View & Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-border pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-heading-md">{edit.orderNumber || "Order"} — {edit.customerName || "Customer"}</h3>
                  {edit.source === "manual" && <span className="pill text-micro bg-brand-light/10 text-brand-light">Manual</span>}
                </div>
                <p className="text-caption text-muted mt-0.5">Order details & automated courier tracking summary.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrintOrder(edit);
                    setEdit(null);
                  }}
                  className="btn-ghost !py-1 !px-3 text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button type="button" onClick={() => setEdit(null)} className="text-muted hover:text-text p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Prominent Courier & Tracking Info Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 p-3.5 rounded-shopify-lg bg-panel2 border border-border">
              <div className="p-2.5 rounded bg-panel border border-border/70">
                <div className="text-micro text-muted font-medium uppercase tracking-wider">Order Number</div>
                <div className="font-bold text-sm text-text mt-0.5">{edit.orderNumber || "—"}</div>
              </div>
              <div className="p-2.5 rounded bg-panel border border-border/70">
                <div className="text-micro text-muted font-medium uppercase tracking-wider">Courier Provider</div>
                <div className="font-semibold text-sm mt-0.5" style={{ color: edit.courierProvider === "run_courier" ? "#8b5cf6" : undefined }}>
                  {edit.courier || (edit.courierProvider === "run_courier" ? "Run Courier" : "PostEx")}
                  {edit.courierProvider === "run_courier" && edit.courier && edit.courier !== "Run Courier" && (
                    <span className="text-micro text-muted ml-1.5">via Run Courier</span>
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded bg-panel border border-border/70">
                <div className="text-micro text-muted font-medium uppercase tracking-wider">Tracking ID</div>
                <div className="font-mono font-semibold text-xs text-text mt-1 truncate">
                  {edit.trackingId ? (
                    <a
                      href={edit.trackingUrl || (edit.courierProvider === "run_courier" ? `https://portal.runcourier.com` : `https://merchant.postex.pk/tracking?trackingNumber=${encodeURIComponent(edit.trackingId)}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline inline-flex items-center gap-1"
                      style={{ color: edit.courierProvider === "run_courier" ? "#8b5cf6" : undefined }}
                      title={`Open ${edit.courierProvider === "run_courier" ? "Run Courier" : "PostEx"} tracking portal`}
                    >
                      <span>{edit.trackingId}</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  ) : (
                    <span className="text-muted font-normal italic">
                      {edit.courierProvider === "run_courier" ? "Enter tracking number to sync with Run Courier" : "Auto-fetching via PostEx"}
                    </span>
                  )}
                </div>
              </div>
            </div>

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
                <select
                  className="input"
                  value={
                    edit.cancelled || edit.deliveryStatus === "cancelled" || edit.deliveryStatus === "cancel"
                      ? "cancelled"
                      : edit.deliveryStatus?.toLowerCase() === "attempt" || edit.deliveryStatus?.toLowerCase() === "delivery attempt"
                      ? "delivery attempt"
                      : edit.deliveryStatus || "pending under ATC"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    const isCancelling = val === "cancelled" || val === "cancel";
                    const isAtt = val === "attempt" || val === "delivery attempt";
                    setEdit({
                      ...edit,
                      deliveryStatus: isAtt ? "delivery attempt" : val,
                      cancelled: isCancelling,
                      archived: isCancelling,
                      isCourierHanded: isAtt ? true : edit.isCourierHanded,
                    });
                  }}
                >
                  {DELIVERY_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                <select
                  className="input"
                  value={edit.courier || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEdit({
                      ...edit,
                      courier: val,
                      courierProvider: val === "Run Courier" ? "run_courier" : val === "PostEx" ? "postex" : edit.courierProvider,
                    });
                  }}
                >
                  {COURIERS.map((c) => (
                    <option key={c} value={c}>{c || "— select —"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tracking Number (PostEx / Courier)</label>
                <input
                  className="input font-mono"
                  placeholder="e.g. CX-123456789"
                  value={edit.trackingId || ""}
                  onChange={(e) => setEdit({ ...edit, trackingId: e.target.value })}
                />
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
                  <input
                    type="checkbox"
                    checked={!!edit.isCourierHanded}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEdit({
                        ...edit,
                        isCourierHanded: checked,
                        ...(checked ? { slipPrinted: true, isPacked: true } : {}),
                      });
                    }}
                  />
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

            {/* Courier Tracking & Journey Section */}
            {(edit.courier?.toLowerCase() === "postex" || edit.courierProvider === "run_courier" || edit.trackingId || edit.courierStatus) && (
              <div className="mt-5 p-4 rounded-shopify-lg bg-panel2 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" style={{ color: edit.courierProvider === "run_courier" ? "#8b5cf6" : undefined }} />
                    <span className="font-semibold text-xs text-text uppercase tracking-wider">
                      {edit.courierProvider === "run_courier" ? "Run Courier Tracking" : "PostEx Courier Tracking"}
                    </span>
                    {edit.trackingId && (
                      <span className="text-micro font-mono bg-panel px-2 py-0.5 rounded border border-border text-text">
                        {edit.trackingId}
                      </span>
                    )}
                  </div>
                  {edit.trackingId && (
                    <button
                      type="button"
                      onClick={() => syncSingleOrder(edit)}
                      disabled={isSingleSyncing(edit)}
                      className="btn-ghost !py-1 !px-3 text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSingleSyncing(edit) ? "animate-spin" : ""}`} />
                      <span>{isSingleSyncing(edit) ? "Syncing…" : "Sync Now"}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
                  <div className="p-2 rounded bg-panel border border-border/60">
                    <div className="text-micro text-muted">Courier Status (Actual)</div>
                    <div className="font-medium text-text mt-0.5">{edit.courierStatus || "Not Synced"}</div>
                  </div>
                  <div className="p-2 rounded bg-panel border border-border/60">
                    <div className="text-micro text-muted">Status Code</div>
                    <div className="font-mono font-medium text-text mt-0.5">{edit.courierStatusCode || "—"}</div>
                  </div>
                  <div className="p-2 rounded bg-panel border border-border/60">
                    <div className="text-micro text-muted">Section Status (Manual)</div>
                    <div className="font-medium text-aloe mt-0.5 capitalize">{edit.deliveryStatus || "—"}</div>
                  </div>
                  <div className="p-2 rounded bg-panel border border-border/60">
                    <div className="text-micro text-muted">Last Synced</div>
                    <div className="text-text mt-0.5">{edit.lastCourierSyncAt ? formatTimeAgo(edit.lastCourierSyncAt) : "Never"}</div>
                  </div>
                </div>

                {edit.courierSyncError && (
                  <div className="mb-3 text-xs text-bad bg-bad/10 p-2.5 rounded border border-bad/20">
                    ⚠️ {edit.courierSyncError}
                  </div>
                )}

                {/* Tracking History Log Trail */}
                {edit.courierLogs && edit.courierLogs.length > 0 && (
                  <div className="mt-3">
                    <div className="text-micro uppercase tracking-wider text-muted font-medium mb-2">Status Audit History</div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {edit.courierLogs.map((log) => (
                        <div key={log.id} className="flex items-start justify-between text-micro p-2 rounded bg-panel border border-border/40">
                          <div>
                            <span className="font-semibold text-text">{log.courierStatus || log.newInternalStatus}</span>
                            {log.courierStatusCode && <span className="font-mono text-muted ml-1.5">[{log.courierStatusCode}]</span>}
                            <div className="text-muted mt-0.5">
                              {log.prevInternalStatus ? `${log.prevInternalStatus} → ` : ""}
                              <span className="text-good">{log.newInternalStatus}</span>
                              <span className="text-muted/60 ml-2">via {log.source}</span>
                            </div>
                          </div>
                          <span className="text-muted whitespace-nowrap ml-3">{fmtDate(log.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw API Response toggle */}
                {edit.rawCourierResponse && (
                  <div className="mt-3 pt-2 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() => setShowRawPayload(!showRawPayload)}
                      className="text-micro text-muted hover:text-text underline"
                    >
                      {showRawPayload ? "Hide Raw API Payload" : `View Raw ${edit.courierProvider === "run_courier" ? "Run Courier" : "PostEx"} API Payload`}
                    </button>
                    {showRawPayload && (
                      <pre className="mt-2 p-2.5 rounded bg-black text-gray-200 text-[10px] font-mono overflow-x-auto max-h-48">
                        {JSON.stringify(edit.rawCourierResponse, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setPrintOrder(null)}>
          <div className="bg-white text-black p-8 w-full max-w-md relative" style={{ borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <h2 className="text-heading-md uppercase tracking-wider text-black">Order Dispatch Slip</h2>
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
                <span className="font-bold text-lg text-black">{fmtPKR(printOrder.totalPrice)}</span>
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
                className="flex-1 bg-black hover:bg-shade-70 text-white font-medium py-2.5 px-4 rounded-pill transition flex items-center justify-center gap-2 text-center"
                onClick={() => {
                  updateField(printOrder.id, { slipPrinted: true });
                  window.print();
                }}
              >
                <Printer className="w-4 h-4 stroke-[1.75]" />
                <span>Print Slip Now</span>
              </button>
              <button
                className="bg-shade-30 hover:bg-shade-40 text-black font-medium py-2.5 px-4 rounded-pill transition"
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
