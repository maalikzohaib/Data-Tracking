import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") || "60", 10), 365);
  const since = new Date(Date.now() - days * 864e5);

  const daily = await prisma.metaAdDaily.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "desc" },
  });

  // Weekly rollup (ISO week grouping).
  const weekly = new Map<
    string,
    { week: string; spend: number; revenue: number; purchases: number; clicks: number; impressions: number }
  >();
  for (const d of daily) {
    const wk = isoWeek(d.date);
    if (!weekly.has(wk))
      weekly.set(wk, { week: wk, spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0 });
    const row = weekly.get(wk)!;
    row.spend += d.spend;
    row.revenue += d.revenue;
    row.purchases += d.purchases;
    row.clicks += d.clicks;
    row.impressions += d.impressions;
  }

  return NextResponse.json({
    daily,
    weekly: Array.from(weekly.values()).sort((a, b) => b.week.localeCompare(a.week)),
  });
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
