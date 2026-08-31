"use client";

import { useEffect, useState } from "react";
import { DollarSign, BarChart3, TrendingUp, Target, Info } from "lucide-react";
import { PageHeader, Card, RangeTabs, StatCard } from "@/components/ui";
import { apiGet } from "@/lib/client";
import { fmtPKR } from "@/lib/format";

type Overview = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  adSpend: number;
  codCharges: number;
  shipping: number;
  otherExpenses: number;
  netProfit: number;
  orders: number;
  roas: number;
};

export default function ProfitPage() {
  const [range, setRange] = useState("30d");
  const [o, setO] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<{ overview: Overview }>(`/api/stats?range=${range}`)
      .then((d) => setO(d.overview))
      .finally(() => setLoading(false));
  }, [range]);

  const rows: { label: string; value: number; kind: "in" | "out" | "sub" | "total" }[] = o
    ? [
        { label: "Revenue (Sales)", value: o.revenue, kind: "in" },
        { label: "− COGS (Inventory cost)", value: -o.cogs, kind: "out" },
        { label: "= Gross Profit", value: o.grossProfit, kind: "sub" },
        { label: "− Meta Ad Spend", value: -o.adSpend, kind: "out" },
        { label: "− COD Charges", value: -o.codCharges, kind: "out" },
        { label: "− Other Expenses", value: -o.otherExpenses, kind: "out" },
        { label: "= Net Profit", value: o.netProfit, kind: "total" },
      ]
    : [];

  const margin = o && o.revenue ? (o.netProfit / o.revenue) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Profit Report"
        subtitle="P&L statement — revenue se net profit tak"
        action={<RangeTabs value={range} onChange={setRange} />}
      />

      {loading ? (
        <div className="text-muted text-caption py-20 text-center">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatCard label="Revenue" value={fmtPKR(o?.revenue ?? 0)} icon={<DollarSign className="w-5 h-5 stroke-[1.75]" />} tone="brand" />
            <StatCard label="Gross Profit" value={fmtPKR(o?.grossProfit ?? 0)} icon={<BarChart3 className="w-5 h-5 stroke-[1.75]" />} tone="accent" />
            <StatCard label="Net Profit" value={fmtPKR(o?.netProfit ?? 0)} sub={`${margin.toFixed(1)}% margin`} icon={<TrendingUp className="w-5 h-5 stroke-[1.75]" />} tone={(o?.netProfit ?? 0) >= 0 ? "good" : "bad"} />
            <StatCard label="ROAS" value={`${(o?.roas ?? 0).toFixed(2)}x`} icon={<Target className="w-5 h-5 stroke-[1.75]" />} tone="warn" />
          </div>

          <Card title="Profit & Loss Statement">
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const isTotal = r.kind === "total";
                const isSub = r.kind === "sub";
                return (
                  <div
                    key={r.label}
                    className={`flex items-center justify-between py-3.5 px-3 ${
                      isTotal ? "text-lg font-semibold" : isSub ? "font-medium" : ""
                    } ${isSub || isTotal ? "bg-pistachio/40 rounded-shopify-md my-1" : ""}`}
                  >
                    <span className={r.kind === "out" ? "text-muted" : ""}>{r.label}</span>
                    <span
                      className={
                        isTotal
                          ? r.value >= 0
                            ? "text-good"
                            : "text-bad"
                          : r.kind === "out"
                          ? "text-bad"
                          : "text-text"
                      }
                    >
                      {fmtPKR(r.value)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 text-micro text-muted mt-5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>COGS aap ke inventory buy price par calculate hoti hai (SKU match). Buy price Inventory page se set karo.</span>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
