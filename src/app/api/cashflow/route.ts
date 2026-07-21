import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const flows = await prisma.cashFlow.findMany({
    orderBy: { happenedAt: "desc" },
    take: 500,
  });

  // Running balance (oldest -> newest).
  const asc = [...flows].reverse();
  let bal = 0;
  const withBalance = asc.map((f) => {
    bal += f.type === "in" ? f.amount : -f.amount;
    return { ...f, balance: bal };
  });
  withBalance.reverse();

  return NextResponse.json({ flows: withBalance });
}

const schema = z.object({
  type: z.enum(["in", "out"]),
  source: z.string().min(1),
  amount: z.number().nonnegative(),
  note: z.string().optional(),
  happenedAt: z.string().optional(),
});

// Manual cash entry (opening balance, misc adjustments).
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const flow = await prisma.cashFlow.create({
    data: {
      type: d.type,
      source: d.source,
      amount: d.amount,
      note: d.note,
      happenedAt: d.happenedAt ? new Date(d.happenedAt) : undefined,
    },
  });
  return NextResponse.json({ flow });
}

// Sirf manual entries delete ho sakti hain. Auto-linked (Sales, Ads, Shipping,
// Expense, Loan, COD) wale unke apne source module se delete/edit hote hain —
// yahan se hata do to wo dobara sync par wapas aa jayenge.
const AUTO_SOURCES = ["Sales", "Ads", "Shipping", "Expense", "Loan", "Loan Repayment", "COD"];

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const flow = await prisma.cashFlow.findUnique({ where: { id } });
  if (!flow) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (flow.refId || AUTO_SOURCES.includes(flow.source)) {
    return NextResponse.json(
      {
        error:
          "Ye auto-linked entry hai (order/ads/loan/expense se aayi). Isko uske apne page se hata/edit karo.",
      },
      { status: 400 }
    );
  }

  await prisma.cashFlow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
