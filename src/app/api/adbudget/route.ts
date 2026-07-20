import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Kitna spend ho chuka hai — actual Meta ad spend (MetaAdDaily) ka total.
async function actualSpend(): Promise<number> {
  const agg = await prisma.metaAdDaily.aggregate({ _sum: { spend: true } });
  return agg._sum.spend ?? 0;
}

export async function GET() {
  const budgets = await prisma.adBudget.findMany({
    orderBy: { createdAt: "desc" },
  });
  const spent = await actualSpend();
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  return NextResponse.json({
    budgets,
    summary: {
      totalBudget,
      spent,
      remaining: Math.max(totalBudget - spent, 0),
      usedPct: totalBudget ? Math.min((spent / totalBudget) * 100, 100) : 0,
    },
  });
}

const schema = z.object({
  name: z.string().min(1),
  platform: z.string().optional(),
  amount: z.number().nonnegative(),
  period: z.string().optional(), // daily, weekly, monthly, campaign
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const budget = await prisma.adBudget.create({
    data: {
      name: d.name,
      platform: d.platform || "Meta",
      amount: d.amount,
      period: d.period || "monthly",
      note: d.note,
    },
  });
  return NextResponse.json({ budget });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.adBudget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
