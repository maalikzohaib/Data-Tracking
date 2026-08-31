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
  Printer,
  Check,
  Calendar,
  X,
  FileEdit,
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

const COURIERS = ["", "TCS", "Leopards", "M&P", "PostEx", "Trax", "Daewoo", "Other"];
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
  "delivered",
  "delivery attempt",
  "under review",
  "return initiated",
  "return in transit",
  "return out for delivery",
  "returned",
  "cancelled",
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
  const [tab, setTab] = useState<"active" | "courierHanded" | "delivered" | "archive">("active");
  const [courierFilter, setCourierFilter] = useState<CourierSubFilter>("all");
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
  const [showRawPayload, setShowRawPayload] = useState(false);
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

  async function syncPostex(forceAll = false) {
    setPostexSyncing(true);
    setPostexSyncMsg(null);
    try {
      const res = await fetch("/api/postex/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll }),
      });
      const j = await res.json();
      if (j.ok) {
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
        setSyncMsg(`❌ PostEx: ${String(j.error).slice(0, 100)}`);
      }
    } catch (e) {
      setSyncMsg(`❌ PostEx Sync Error: ${String(e)}`);
    }
    setPostexSyncing(false);
  }

  async function syncSingleOrderPostex(orderId: string) {
    setSinglePostexSyncing(true);
    try {
      const res = await fetch(`/api/postex/sync?orderId=${encodeURIComponent(orderId)}`, {
        method: "POST",
      });
      const j = await res.json();
      if (j.ok && j.order) {
        setEdit(j.order);
        await load();
      } else {
        alert(`PostEx Sync Failed: ${j.error || "Unknown error"}`);
      }
    } catch (e) {
      alert(`Error syncing PostEx: ${String(e)}`);
    }
    setSinglePostexSyncing(false);
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

  // Delivered: manually marked completed/delivered and not archived
  const isDelivered = (o: Order) =>
    !isArchived(o) && o.stage === "completed";

  // Courier Handed: isCourierHanded === true (dispatched), but not archived, not completed
  const isCourierHanded = (o: Order) =>
    !isArchived(o) && !isDelivered(o) && !!o.isCourierHanded;

  // Active: everything else (not courier handed, not delivered, not archived)
  const isActive = (o: Order) =>
    !isArchived(o) && !isDelivered(o) && !isCourierHanded(o);

  const getOrderSection = (o: Order): { key: string; label: string; icon: ReactNode; badgeStyle: string } => {
    if (isArchived(o)) {
      return { key: "archive", label: "Archive", icon: <Package className="w-3.5 h-3.5" />, badgeStyle: "bg-shade-30 text-shade-60 border border-shade-30" };
    }
    if (isDelivered(o)) {
      return { key: "delivered", label: "Delivered", icon: <CheckCircle2 className="w-3.5 h-3.5" />, badgeStyle: "bg-aloe text-black border border-aloe" };
    }
    if (isCourierHanded(o)) {
      return { key: "courierHanded", label: "Courier Handed", icon: <Truck className="w-3.5 h-3.5" />, badgeStyle: "bg-pistachio text-black border border-pistachio" };
    }
    return { key: "active", label: "Active", icon: <ShoppingCart className="w-3.5 h-3.5" />, badgeStyle: "bg-text/10 text-text border border-text/20" };
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

  const courierHandedDateFiltered = dateFilteredOrders.filter(isCourierHanded);
  const courierCountAll = courierHandedDateFiltered.length;
  const courierCountDelivered = courierHandedDateFiltered.filter((o) => matchesCourierFilter(o, "delivered")).length;
  const courierCountReturn = courierHandedDateFiltered.filter((o) => matchesCourierFilter(o, "return")).length;
  const courierCountAttempt = courierHandedDateFiltered.filter((o) => matchesCourierFilter(o, "attempt")).length;
  const courierCountPending = courierHandedDateFiltered.filter((o) => matchesCourierFilter(o, "pending")).length;

  // GLOBAL SEARCH: If search query 'q' is entered, search across ALL date-filtered orders regardless of current tab.
  // TAB FILTER: If no search query, filter date-filtered orders by currently selected section tab and sub-filter.
  const shown = q
    ? dateFilteredOrders.filter(bySearch)
    : dateFilteredOrders.filter((o) => {
        if (tab === "active") return isActive(o);
        if (tab === "courierHanded") return isCourierHanded(o) && matchesCourierFilter(o, courierFilter);
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

    // Archive tab
    const totalCount = shown.length;
    const totalSales = shown.reduce((sum, o) => sum + o.totalPrice, 0);

    const returnedOrCancelled = shown.filter((o) => o.cancelled || o.deliveryStatus === "returned" || o.deliveryStatus === "cancelled" || o.stage === "cancelled");
    const retCancelCount = returnedOrCancelled.length;
    const lostVal = returnedOrCancelled.reduce((sum, o) => sum + o.totalPrice, 0);

    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Archived Orders" value={String(totalCount)} sub="Archived orders" icon={<Package className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
        <StatCard label="Archived Sales Value" value={fmtPKR(totalSales)} sub="Total value archived" icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="good" />
        <StatCard label="Returned / Cancelled" value={String(retCancelCount)} sub="Cancelled/returned count" icon={<AlertTriangle className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
        <StatCard label="Total Lost Value" value={fmtPKR(lostVal)} sub="Lost order value" icon={<XCircle className="w-5 h-5 stroke-[1.75]" />} tone="bad" />
      </div>
    );
  };

  return (
    <>
      {/* Filter Bar: Date Presets & Custom Range & Search & Sync */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted bg-panel2 px-3.5 py-1.5 rounded-pill border border-border">
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
            <div className="flex items-center gap-2 bg-panel2 px-3.5 py-1 rounded-pill border border-border">
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

          {syncMsg && <span className="text-xs text-muted bg-panel2 px-3 py-1 rounded-pill border border-border">{syncMsg}</span>}
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

          <button className="btn-primary whitespace-nowrap text-xs py-1.5 !px-4 flex items-center gap-1.5" onClick={() => syncPostex(false)} disabled={postexSyncing}>
            <Truck className={`w-3.5 h-3.5 ${postexSyncing ? "animate-bounce" : ""}`} />
            <span>{postexSyncing ? "Checking PostEx…" : "Sync PostEx"}</span>
          </button>
        </div>
      </div>

      {/* PostEx Sync Summary Banner */}
      {postexSyncMsg && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-panel2 border border-aloe/40 px-4 py-3 rounded-shopify-lg mb-5 text-xs">
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
        <div className="flex items-center justify-between bg-aloe border border-aloe px-4 py-3 rounded-shopify-lg mb-5 text-xs font-medium">
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

      {/* Section Tabs & Courier Sub-Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="inline-flex rounded-pill bg-panel2 border border-border p-1">
          {([
            { k: "active" as const, l: `Active (${activeOrders.length})`, icon: ShoppingCart },
            { k: "courierHanded" as const, l: `Courier (${courierHandedOrders.length})`, icon: Truck },
            { k: "delivered" as const, l: `Delivered (${deliveredOrders.length})`, icon: CheckCircle2 },
            { k: "archive" as const, l: `Archive (${archivedOrders.length})`, icon: Package },
          ]).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                onClick={() => {
                  setTab(t.k);
                  if (t.k === "courierHanded") setCourierFilter("all");
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
          <div className="inline-flex rounded-pill bg-panel2 border border-border p-1 gap-1">
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
      </div>

      {/* Orders table */}
      <Card
        title={
          tab === "active" ? "Active Orders" :
          tab === "courierHanded" ? (courierFilter === "all" ? "Courier Handed Orders" : `Courier Handed — ${courierFilter === "attempt" ? "Delivery Attempt" : courierFilter === "return" ? "Return" : courierFilter.charAt(0).toUpperCase() + courierFilter.slice(1)}`) :
          tab === "delivered" ? "Delivered Orders" :
          "Archived Orders"
        }
        action={
          <div className="flex items-center gap-2">
            <button className="btn-primary flex items-center gap-1 text-xs !py-1.5 !px-3" onClick={() => setShowForm(!showForm)}>
              <span>{showForm ? "✕ Close" : "+ Naya Order"}</span>
            </button>
          </div>
        }
      >
        {shown.length === 0 ? (
          <EmptyState text={
            loading
              ? "Orders load ho rahe hain…"
              : q
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
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead>
                <tr className="bg-panel2 text-muted uppercase font-medium text-eyebrow border-b border-border">
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
                      className="hover:bg-panel2/40 transition-colors"
                      style={rowColor ? { backgroundColor: `${rowColor}18` } : undefined}
                    >
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
                          <div className="absolute left-6 top-1 z-50 bg-panel border border-border rounded-shopify-lg shadow-modal p-2 flex gap-1.5 flex-wrap w-[140px]">
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
                          onClick={() => updateField(o.id, { isCourierHanded: !o.isCourierHanded })}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-medium border-0 transition ${
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
                            value={o.deliveryStatus || "pending under ATC"}
                            onChange={(e) => updateField(o.id, { deliveryStatus: e.target.value })}
                            className="bg-panel2 text-xs text-text border border-border rounded-shopify-sm px-1.5 py-1 focus:outline-none focus:border-text cursor-pointer capitalize"
                          >
                            {DELIVERY_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
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

                      {/* 15 & 16. Actions: View & Archive/Restore */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEdit(o)}
                          className="btn-ghost !py-1 !px-3 text-xs mr-2 font-medium text-text hover:text-aloe inline-flex items-center gap-1"
                        >
                          <span>View</span>
                        </button>
                        {!isArchived(o) ? (
                          <button
                            className="text-muted hover:text-text hover:underline text-xs"
                            onClick={() => setArchived(o.id, true)}
                            title="Archive kar do"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            className="text-brand-light hover:underline text-xs"
                            onClick={() => setArchived(o.id, false)}
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
                <div className="text-micro text-muted font-medium uppercase tracking-wider">Courier Name</div>
                <div className="font-semibold text-sm text-aloe mt-0.5">{edit.courier || "PostEx"}</div>
              </div>
              <div className="p-2.5 rounded bg-panel border border-border/70">
                <div className="text-micro text-muted font-medium uppercase tracking-wider">Tracking ID</div>
                <div className="font-mono font-semibold text-xs text-text mt-1 truncate">
                  {edit.trackingId ? (
                    <a
                      href={edit.trackingUrl || `https://merchant.postex.pk/tracking?trackingNumber=${encodeURIComponent(edit.trackingId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-aloe hover:underline inline-flex items-center gap-1"
                      title="Open PostEx tracking portal"
                    >
                      <span>{edit.trackingId}</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  ) : (
                    <span className="text-muted font-normal italic">Auto-fetching via PostEx</span>
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

            {/* PostEx Tracking & Journey Section */}
            {(edit.courier?.toLowerCase() === "postex" || edit.trackingId || edit.courierStatus) && (
              <div className="mt-5 p-4 rounded-shopify-lg bg-panel2 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-aloe" />
                    <span className="font-semibold text-xs text-text uppercase tracking-wider">PostEx Courier Tracking</span>
                    {edit.trackingId && (
                      <span className="text-micro font-mono bg-panel px-2 py-0.5 rounded border border-border text-text">
                        {edit.trackingId}
                      </span>
                    )}
                  </div>
                  {edit.trackingId && (
                    <button
                      type="button"
                      onClick={() => syncSingleOrderPostex(edit.id)}
                      disabled={singlePostexSyncing}
                      className="btn-ghost !py-1 !px-3 text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${singlePostexSyncing ? "animate-spin" : ""}`} />
                      <span>{singlePostexSyncing ? "Syncing…" : "Sync Now"}</span>
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
                      {showRawPayload ? "Hide Raw API Payload" : "View Raw PostEx API Payload"}
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
