import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  productId: z.string().optional(),
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  supplier: z.string().optional(),
  note: z.string().optional(),
  purchasedAt: z.string().optional(),
});

export async function GET() {
  const purchases = await prisma.inventoryPurchase.findMany({
    orderBy: { purchasedAt: "desc" },
    take: 300,
  });
  return NextResponse.json({ purchases });
}

// Record an inventory buy: stock badhao, buyPrice update karo, cash out.
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const totalCost = d.quantity * d.unitCost;

  const purchase = await prisma.inventoryPurchase.create({
    data: {
      productId: d.productId,
      title: d.title,
      quantity: d.quantity,
      unitCost: d.unitCost,
      totalCost,
      supplier: d.supplier,
      note: d.note,
      purchasedAt: d.purchasedAt ? new Date(d.purchasedAt) : undefined,
    },
  });

  // Product ka stock + buyPrice auto-update (cash-on-inventory auto-update).
  if (d.productId) {
    await prisma.product.update({
      where: { id: d.productId },
      data: {
        stock: { increment: d.quantity },
        buyPrice: d.unitCost, // latest buy price = COGS basis
      },
    });
  }

  // Inventory buy = cash out.
  await prisma.cashFlow.create({
    data: {
      type: "out",
      source: "Inventory",
      amount: totalCost,
      note: `Inventory: ${d.title} x${d.quantity}`,
      refId: purchase.id,
      happenedAt: purchase.purchasedAt,
    },
  });

  return NextResponse.json({ purchase });
}
