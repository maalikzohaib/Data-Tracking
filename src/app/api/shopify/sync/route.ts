import { NextResponse } from "next/server";
import { syncShopifyOrders, syncShopifyProducts } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Shopify orders + products ko manually refresh karo (button se).
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const daysParam = url.searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 14;
    const syncProducts = url.searchParams.get("products") === "true";

    // Fast sync for manual button: sync recent orders (default last 14 days)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const orders = await syncShopifyOrders(since);

    let products = 0;
    if (syncProducts) {
      products = await syncShopifyProducts();
    }

    return NextResponse.json({ ok: true, orders, products });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[Shopify Sync Error]:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
