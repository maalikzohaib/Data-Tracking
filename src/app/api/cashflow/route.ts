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
