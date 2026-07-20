import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  amount: z.number().nonnegative(),
  vendor: z.string().optional(),
  quantity: z.number().optional(),
  unitCost: z.number().optional(),
  paidVia: z.string().optional(),
  note: z.string().optional(),
  spentAt: z.string().optional(),
});

export async function GET() {
  const expenses = await prisma.expense.findMany({
    orderBy: { spentAt: "desc" },
    take: 300,
  });
  return NextResponse.json({ expenses });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      category: d.category,
      title: d.title,
      amount: d.amount,
      vendor: d.vendor,
      quantity: d.quantity,
      unitCost: d.unitCost,
      paidVia: d.paidVia,
      note: d.note,
      spentAt: d.spentAt ? new Date(d.spentAt) : undefined,
    },
  });

  // Expense = cash out ledger entry.
  await prisma.cashFlow.create({
    data: {
      type: "out",
      source: "Expense",
      amount: d.amount,
      note: `${d.category}: ${d.title}`,
      refId: expense.id,
      happenedAt: expense.spentAt,
    },
  });

  return NextResponse.json({ expense });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.cashFlow.deleteMany({ where: { refId: id, source: "Expense" } });
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
