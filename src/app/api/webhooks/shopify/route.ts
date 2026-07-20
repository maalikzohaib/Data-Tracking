import { NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/webhook";
import { upsertOrder } from "@/lib/sync";
import type { ShopifyOrder } from "@/lib/shopify";

export const dynamic = "force-dynamic";

// Real-time order webhook. Configure in Shopify:
//   orders/create, orders/updated, orders/paid, orders/cancelled
export async function POST(req: Request) {
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(raw, hmac)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const order = JSON.parse(raw) as ShopifyOrder;
    await upsertOrder(order);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
