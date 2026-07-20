import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  courier: z.string().min(1),
  orderRef: z.string().optional(),
  amount: z.number().nonnegative(),
  codCollected: z.number().nonnegative().default(0),
  status: z.enum(["pending", "delivered", "returned"]).default("pending"),
  chargedAt: z.string().optional(),
});

export async function GET() {
  const charges = await prisma.codCharge.findMany({
    orderBy: { chargedAt: "desc" },
    take: 300,
  });
  return NextResponse.json({ charges });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const charge = await prisma.codCharge.create({
    data: {
      courier: d.courier,
      orderRef: d.orderRef,
      amount: d.amount,
      codCollected: d.codCollected,
      status: d.status,
      chargedAt: d.chargedAt ? new Date(d.chargedAt) : undefined,
    },
  });

  // COD service charge = cash out.
  if (d.amount > 0) {
    await prisma.cashFlow.create({
      data: {
        type: "out",
        source: "COD",
        amount: d.amount,
        note: `${d.courier} COD charge`,
        refId: charge.id,
        happenedAt: charge.chargedAt,
      },
    });
  }

  return NextResponse.json({ charge });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, status } = body as { id?: string; status?: string };
  if (!id || !status)
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  const charge = await prisma.codCharge.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json({ charge });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.cashFlow.deleteMany({ where: { refId: id, source: "COD" } });
  await prisma.codCharge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
