import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/env";
import { syncShopifyOrders, syncShopifyProducts, syncMeta } from "@/lib/sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel cron hits this hourly. Also callable manually with ?secret=...
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: Record<string, unknown> = {};

  // Shopify products (buy price ke liye base), phir orders (COGS ko use karte hain).
  try {
    result.products = await syncShopifyProducts();
  } catch (e) {
    result.productsError = String(e);
    await logError("shopify-products", e);
  }

  try {
    result.orders = await syncShopifyOrders();
  } catch (e) {
    result.ordersError = String(e);
    await logError("shopify-orders", e);
  }

  try {
    result.meta = await syncMeta();
  } catch (e) {
    result.metaError = String(e);
    await logError("meta", e);
  }

  return NextResponse.json({ ok: true, syncedAt: new Date().toISOString(), result });
}

async function logError(source: string, e: unknown) {
  try {
    await prisma.syncLog.create({
      data: { source, status: "error", message: String(e).slice(0, 500) },
    });
  } catch {
    // ignore
  }
}
