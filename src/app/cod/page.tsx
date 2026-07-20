"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, EmptyState, StatCard, Pill } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import { fmtPKR, fmtDate } from "@/lib/format";

type Cod = {
  id: string;
  courier: string;
  orderRef: string | null;
  amount: number;
  codCollected: number;
  status: string;
  chargedAt: string;
};

const COURIERS = ["TCS", "Leopards", "M&P", "PostEx", "Trax", "Swyft", "BlueEX", "Other"];

export default function CodPage() {
  const [charges, setCharges] = useState<Cod[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ courier: "TCS", orderRef: "", amount: "", codCollected: "", status: "pending" });

  const load = () =>
    apiGet<{ charges: Cod[] }>("/api/cod")
      .then((d) => setCharges(d.charges || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!form.amount) return;
    await apiSend("/api/cod", "POST", {
      courier: form.courier,
      orderRef: form.orderRef || undefined,
      amount: parseFloat(form.amount),
      codCollected: parseFloat(form.codCollected || "0"),
      status: form.status,
    });
    setForm({ courier: form.courier, orderRef: "", amount: "", codCollected: "", status: "pending" });
    load();
  }

  async function setStatus(id: string, status: string) {
    await apiSend("/api/cod", "PATCH", { id, status });
    load();
  }
  async function del(id: string) {
    await apiSend(`/api/cod?id=${id}`, "DELETE");
    load();
  }

  const totalCharges = charges.reduce((s, c) => s + c.amount, 0);
  const pending = charges.filter((c) => c.status === "pending").reduce((s, c) => s + c.codCollected, 0);
  const returned = charges.filter((c) => c.status === "returned").length;

  return (
    <>
      <PageHeader title="COD Charges" subtitle="Courier-wise cash-on-delivery tracking" />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total COD Charges" value={fmtPKR(totalCharges)} icon="🚚" tone="accent" />
        <StatCard label="Pending Collection" value={fmtPKR(pending)} icon="⏳" tone="warn" />
        <StatCard label="Shipments" value={String(charges.length)} icon="📦" tone="brand" />
        <StatCard label="Returns" value={String(returned)} icon="↩️" tone={returned ? "bad" : "good"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Naya COD Entry" className="h-fit">
          <div className="space-y-3">
            <div>
              <label className="label">Courier</label>
              <select className="input" value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })}>
                {COURIERS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Order Ref (optional)</label>
              <input className="input" value={form.orderRef} onChange={(e) => setForm({ ...form, orderRef: e.target.value })} />
            </div>
            <div>
              <label className="label">COD Charge (PKR)</label>
              <input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">COD Collected (PKR)</label>
              <input className="input" type="number" value={form.codCollected} onChange={(e) => setForm({ ...form, codCollected: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="delivered">Delivered</option>
                <option value="returned">Returned</option>
              </select>
            </div>
            <button className="btn-primary w-full" onClick={add}>
              Add Entry
            </button>
          </div>
        </Card>

        <Card title="COD Records" className="lg:col-span-2">
          {loading ? (
            <div className="text-muted text-sm py-10 text-center">Loading…</div>
          ) : charges.length === 0 ? (
            <EmptyState text="Abhi koi COD record nahi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="py-3 px-2">Courier</th>
                    <th className="py-3 px-2">Order</th>
                    <th className="py-3 px-2 text-right">Charge</th>
                    <th className="py-3 px-2 text-right">Collected</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-panel2/50">
                      <td className="py-3 px-2 font-medium">{c.courier}</td>
                      <td className="py-3 px-2 text-muted">{c.orderRef || "—"}</td>
                      <td className="py-3 px-2 text-right">{fmtPKR(c.amount)}</td>
                      <td className="py-3 px-2 text-right">{fmtPKR(c.codCollected)}</td>
                      <td className="py-3 px-2">
                        <select
                          className="bg-transparent text-xs outline-none cursor-pointer"
                          value={c.status}
                          onChange={(e) => setStatus(c.id, e.target.value)}
                        >
                          <option value="pending">pending</option>
                          <option value="delivered">delivered</option>
                          <option value="returned">returned</option>
                        </select>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button className="text-bad hover:underline text-xs" onClick={() => del(c.id)}>
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
