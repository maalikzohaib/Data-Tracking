import { NextResponse } from "next/server";
import {
  syncRunCourierOrders,
  syncSingleRunCourierOrder,
} from "@/lib/runcourier-sync";

export const dynamic = "force-dynamic";

/**
 * Trigger Run Courier Sync
 * POST /api/runcourier/sync (batch or single with ?orderId=...)
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const queryOrderId = url.searchParams.get("orderId");
    const body = await req.json().catch(() => ({}));
    const orderId = queryOrderId || body?.orderId;
    const forceAll =
      body?.forceAll === true || url.searchParams.get("force") === "true";

    if (orderId) {
      const singleRes = await syncSingleRunCourierOrder(orderId);
      return NextResponse.json({
        ok: true,
        type: "single",
        order: singleRes.order,
        normalized: singleRes.normalized,
        statusData: singleRes.statusData,
        history: singleRes.history,
      });
    }

    const batchRes = await syncRunCourierOrders({
      forceAll,
      source: "manual_bulk",
    });

    return NextResponse.json({
      ok: true,
      type: "bulk",
      ...batchRes,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
