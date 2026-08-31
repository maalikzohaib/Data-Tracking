"use client";

import { useEffect, useState } from "react";
import { Package, DollarSign, AlertTriangle, Hash, Info } from "lucide-react";
import { PageHeader, Card, EmptyState, StatCard } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtNum } from "@/lib/format";

type Product = {
  id: string;
  title: string;
  sku: string | null;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  lowStockAlert: number;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [buyForm, setBuyForm] = useState({ productId: "", quantity: "", unitCost: "", supplier: "" });

  const load = () =>
    apiGet<{ products: Product[] }>("/api/inventory")
      .then((d) => setProducts(d.products || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function saveBuyPrice(id: string) {
    const val = parseFloat(edits[id]);
    if (isNaN(val)) return;
    await apiSend("/api/inventory", "PATCH", { id, buyPrice: val });
    setEdits((e) => {
      const c = { ...e };
      delete c[id];
      return c;
    });
    load();
  }

  async function recordPurchase() {
    if (!buyForm.productId || !buyForm.quantity || !buyForm.unitCost) return;
    const p = products.find((x) => x.id === buyForm.productId);
    await apiSend("/api/inventory/purchase", "POST", {
      productId: buyForm.productId,
      title: p?.title || "Inventory",
      quantity: parseInt(buyForm.quantity, 10),
      unitCost: parseFloat(buyForm.unitCost),
      supplier: buyForm.supplier || undefined,
    });
    setBuyForm({ productId: "", quantity: "", unitCost: "", supplier: "" });
    load();
  }

  const invValue = products.reduce((s, p) => s + p.stock * p.buyPrice, 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockAlert);

  return (
    <>
      <PageHeader title="Inventory" subtitle="Shopify se stock auto-synced · buy price manual" />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Products" value={fmtNum(products.length)} icon={<Package className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
        <StatCard label="Cash on Inventory" value={fmtPKR(invValue)} icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="good" />
        <StatCard label="Low Stock" value={fmtNum(lowStock.length)} icon={<AlertTriangle className="w-5 h-5 stroke-[1.75]" />} tone={lowStock.length ? "bad" : "good"} />
        <StatCard label="Total Units" value={fmtNum(products.reduce((s, p) => s + p.stock, 0))} icon={<Hash className="w-5 h-5 stroke-[1.75]" />} tone="accent" />
      </div>

      <Card title="Inventory Buy (stock + cash auto-update)" className="mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="label">Product</label>
            <select
              className="input"
              value={buyForm.productId}
              onChange={(e) => setBuyForm({ ...buyForm, productId: e.target.value })}
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.sku ? `(${p.sku})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input className="input" type="number" value={buyForm.quantity} onChange={(e) => setBuyForm({ ...buyForm, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Unit Cost (PKR)</label>
            <input className="input" type="number" value={buyForm.unitCost} onChange={(e) => setBuyForm({ ...buyForm, unitCost: e.target.value })} />
          </div>
          <button className="btn-primary" onClick={recordPurchase}>
            Record Buy
          </button>
        </div>
      </Card>

      <Card title="Products">
        {loading ? (
          <div className="text-muted text-caption py-10 text-center">Loading…</div>
        ) : products.length === 0 ? (
          <EmptyState text="Koi product nahi. Settings se Shopify sync chalao." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-eyebrow text-muted uppercase border-b border-border">
                  <th className="py-3 px-2">Product</th>
                  <th className="py-3 px-2">SKU</th>
                  <th className="py-3 px-2 text-right">Buy Price</th>
                  <th className="py-3 px-2 text-right">Sell Price</th>
                  <th className="py-3 px-2 text-right">Margin</th>
                  <th className="py-3 px-2 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const margin = p.sellPrice - p.buyPrice;
                  const low = p.stock <= p.lowStockAlert;
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-panel2/50">
                      <td className="py-3 px-2">{p.title}</td>
                      <td className="py-3 px-2 text-muted">{p.sku || "—"}</td>
                      <td className="py-3 px-2 text-right">
                        <input
                          className="input w-24 py-1 text-right inline-block"
                          value={edits[p.id] ?? String(p.buyPrice)}
                          onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })}
                          onBlur={() => edits[p.id] !== undefined && saveBuyPrice(p.id)}
                        />
                      </td>
                      <td className="py-3 px-2 text-right">{fmtPKR(p.sellPrice)}</td>
                      <td className={`py-3 px-2 text-right font-medium ${margin >= 0 ? "text-good" : "text-bad"}`}>
                        {fmtPKR(margin)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`pill ${low ? "bg-bad/15 text-bad" : "bg-aloe text-black"}`}>
                          {p.stock}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center gap-1.5 text-micro text-muted mt-4">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Buy price edit karke tab bahar click karo — COGS us par calculate hoti hai.</span>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
