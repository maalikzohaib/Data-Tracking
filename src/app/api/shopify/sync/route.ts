import { NextResponse } from "next/server";
import { syncShopifyOrders, syncShopifyProducts } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Shopify orders + products ko manually refresh karo (button se).
export async function POST() {
  try {
    const products = await syncShopifyProducts();
    const orders = await syncShopifyOrders();
    return NextResponse.json({ ok: true, orders, products });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
