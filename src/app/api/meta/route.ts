import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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

// ------------------------------------------------------------
//  Manual ad spend entry — jab account se paise detect hote hain
//  to yahan mention karo. MetaAdDaily upsert + cash-out ledger sync.
// ------------------------------------------------------------
const schema = z.object({
  date: z.string().min(1), // YYYY-MM-DD
  spend: z.number().nonnegative(),
  revenue: z.number().nonnegative().optional(),
  purchases: z.number().int().nonnegative().optional(),
  clicks: z.number().int().nonnegative().optional(),
  impressions: z.number().int().nonnegative().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const date = new Date(d.date + "T00:00:00.000Z");
  const dateKey = d.date;

  const row = await prisma.metaAdDaily.upsert({
    where: { date },
    create: {
      date,
      spend: d.spend,
      revenue: d.revenue ?? 0,
      purchases: d.purchases ?? 0,
      clicks: d.clicks ?? 0,
      impressions: d.impressions ?? 0,
    },
    update: {
      spend: d.spend,
      ...(d.revenue !== undefined ? { revenue: d.revenue } : {}),
      ...(d.purchases !== undefined ? { purchases: d.purchases } : {}),
      ...(d.clicks !== undefined ? { clicks: d.clicks } : {}),
      ...(d.impressions !== undefined ? { impressions: d.impressions } : {}),
    },
  });

  // Ad spend ko cash-out ledger mein sync rakho (dedup by note).
  const note = `Meta ads ${dateKey}`;
  const existing = await prisma.cashFlow.findFirst({
    where: { source: "Ads", note },
  });
  if (d.spend > 0) {
    if (existing) {
      await prisma.cashFlow.update({
        where: { id: existing.id },
        data: { amount: d.spend, happenedAt: date },
      });
    } else {
      await prisma.cashFlow.create({
        data: { type: "out", source: "Ads", amount: d.spend, note, happenedAt: date },
      });
    }
  } else if (existing) {
    await prisma.cashFlow.delete({ where: { id: existing.id } });
  }

  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const row = await prisma.metaAdDaily.findUnique({ where: { id } });
  if (row) {
    const dateKey = row.date.toISOString().slice(0, 10);
    await prisma.cashFlow.deleteMany({ where: { source: "Ads", note: `Meta ads ${dateKey}` } });
    await prisma.metaAdDaily.delete({ where: { id } });
  }
  return NextResponse.json({ ok: true });
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
