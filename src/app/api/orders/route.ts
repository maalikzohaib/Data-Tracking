import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
  const orders = await prisma.order.findMany({
    orderBy: { shopifyCreatedAt: "desc" },
    take: limit,
    include: { lineItems: true },
  });
  return NextResponse.json({ orders });
}

const patchSchema = z.object({
  id: z.string().min(1),
  shippingAdvance: z.number().nonnegative().optional(),
  courier: z.string().optional(),
});

// Manual per-order fields: courier ka naam + hand-paid shipping advance.
export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id, shippingAdvance, courier } = parsed.data;

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...(shippingAdvance !== undefined ? { shippingAdvance } : {}),
      ...(courier !== undefined ? { courier } : {}),
    },
  });

  // Shipping advance ko cash-out ledger mein sync rakho (dedup by refId+source).
  if (shippingAdvance !== undefined) {
    const existing = await prisma.cashFlow.findFirst({
      where: { refId: id, source: "Shipping" },
    });
    if (shippingAdvance > 0) {
      if (existing) {
        await prisma.cashFlow.update({
          where: { id: existing.id },
          data: { amount: shippingAdvance, note: `Shipping advance — ${order.orderNumber ?? id}` },
        });
      } else {
        await prisma.cashFlow.create({
          data: {
            type: "out",
            source: "Shipping",
            amount: shippingAdvance,
            note: `Shipping advance — ${order.orderNumber ?? id}`,
            refId: id,
            happenedAt: new Date(),
          },
        });
      }
    } else if (existing) {
      await prisma.cashFlow.delete({ where: { id: existing.id } });
    }
  }

  return NextResponse.json({ order });
}
