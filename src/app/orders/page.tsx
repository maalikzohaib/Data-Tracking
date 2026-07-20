"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, Pill, EmptyState } from "@/components/ui";
import { apiGet } from "@/lib/client";
import { fmtPKR, fmtDate } from "@/lib/format";

type Order = {
  id: string;
  orderNumber: string | null;
  customerName: string | null;
  customerCity: string | null;
  totalPrice: number;
  itemCount: number;
  cogs: number;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  paymentMethod: string | null;
  shopifyCreatedAt: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiGet<{ orders: Order[] }>("/api/orders?limit=300")
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(
    (o) =>
      !q ||
      o.orderNumber?.toLowerCase().includes(q.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(q.toLowerCase()) ||
      o.customerCity?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Orders / Sales"
        subtitle="Shopify se auto-synced orders"
        action={
          <input
            className="input max-w-xs"
            placeholder="Search order / customer / city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />

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
                  <th className="py-3 px-2">Payment</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Total</th>
                  <th className="py-3 px-2 text-right">Date</th>
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
                      <span className="pill bg-panel2 text-muted">{o.paymentMethod || "—"}</span>
                    </td>
                    <td className="py-3 px-2">
                      <Pill status={o.financialStatus || "pending"} />
                    </td>
                    <td className="py-3 px-2 text-right font-semibold">{fmtPKR(o.totalPrice)}</td>
                    <td className="py-3 px-2 text-right text-muted">{fmtDate(o.shopifyCreatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
