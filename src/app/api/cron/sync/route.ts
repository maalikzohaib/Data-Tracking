import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/env";
import { syncShopifyOrders, syncShopifyProducts, syncMeta } from "@/lib/sync";
import { syncPostexOrders } from "@/lib/postex-sync";
import { getPostexConfig } from "@/lib/postex";
import { getRunCourierConfig } from "@/lib/runcourier";
import { syncRunCourierOrders } from "@/lib/runcourier-sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel cron hits this periodically. Also callable manually with ?secret=...
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: Record<string, unknown> = {};

  // 1. Shopify products
  try {
    result.products = await syncShopifyProducts();
  } catch (e) {
    result.productsError = String(e);
    await logError("shopify-products", e);
  }

  // 2. Shopify orders
  try {
    result.orders = await syncShopifyOrders();
  } catch (e) {
    result.ordersError = String(e);
    await logError("shopify-orders", e);
  }

  // 3. Meta ads
  try {
    result.meta = await syncMeta();
  } catch (e) {
    result.metaError = String(e);
    await logError("meta", e);
  }

  // 4. PostEx courier tracking reconciliation
  try {
    const postexConfig = await getPostexConfig();
    if (postexConfig.apiToken && postexConfig.cronEnabled) {
      result.postex = await syncPostexOrders({ source: "cron" });
    } else {
      result.postex = { skipped: true, reason: !postexConfig.apiToken ? "No token" : "Cron disabled" };
    }
  } catch (e) {
    result.postexError = String(e);
    await logError("postex", e);
  }

  // 5. Run Courier tracking reconciliation
  try {
    const rcConfig = await getRunCourierConfig();
    if (rcConfig.authKey) {
      result.runCourier = await syncRunCourierOrders({ source: "cron" });
    } else {
      result.runCourier = { skipped: true, reason: "No auth key" };
    }
  } catch (e) {
    result.runCourierError = String(e);
    await logError("runcourier", e);
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
