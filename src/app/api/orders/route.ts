import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
