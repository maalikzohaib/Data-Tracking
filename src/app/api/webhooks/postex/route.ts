import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPostexConfig, PostexTrackData } from "@/lib/postex";
import { normalizePostexStatus } from "@/lib/postex-status";

export const dynamic = "force-dynamic";

/**
 * PostEx Webhook Handler Endpoint
 * POST /api/webhooks/postex
 */
export async function POST(req: Request) {
  try {
    const config = await getPostexConfig();

    if (!config.webhookEnabled) {
      return NextResponse.json({ error: "PostEx Webhooks are currently disabled in settings." }, { status: 403 });
    }

    // Header Authentication Validation
    if (config.webhookHeaderValue) {
      const headerKey = config.webhookHeaderKey.toLowerCase();
      const incomingHeaderVal = req.headers.get(headerKey) || req.headers.get(config.webhookHeaderKey);

      if (!incomingHeaderVal || incomingHeaderVal !== config.webhookHeaderValue) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid webhook authentication header." },
          { status: 401 }
        );
      }
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    // Extract item(s) from potential wrapper formats
    const items: any[] = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray(rawBody.data)
      ? rawBody.data
      : Array.isArray(rawBody.dist)
      ? rawBody.dist
      : [rawBody];

    let processedCount = 0;
    const now = new Date();

    for (const item of items) {
      const trackingNumber = (
        item.trackingNumber ||
        item.trackingNo ||
        item.tracking_number ||
        item.trackingId ||
        item.orderRefNumber ||
        ""
      ).trim();

      if (!trackingNumber) continue;

      // Find matching order in DB by trackingId or orderRef
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { trackingId: { equals: trackingNumber, mode: "insensitive" } },
            { orderNumber: { equals: trackingNumber, mode: "insensitive" } },
          ],
        },
      });

      if (!order) continue;

      // Normalize status
      const trackData: PostexTrackData = {
        trackingNumber: order.trackingId || trackingNumber,
        orderRefNumber: item.orderRefNumber || item.orderRef || order.orderNumber,
        transactionStatus: item.transactionStatus || item.status || item.orderStatus,
        transactionStatusCode: item.transactionStatusCode || item.statusCode || item.orderStatusCode,
        orderStatus: item.orderStatus || item.status,
        orderStatusCode: item.orderStatusCode || item.statusCode,
        transactionStatusHistory: item.transactionStatusHistory || item.history || [],
      };

      const normalized = normalizePostexStatus(trackData, config.statusMapping);
      const mappedDeliveryStatus =
        normalized.internalStatus.toLowerCase() === "pending"
          ? (order.deliveryStatus || "pending under ATC")
          : normalized.internalStatus.toLowerCase();

      const isStatusChanged =
        order.deliveryStatus?.toLowerCase() !== mappedDeliveryStatus ||
        order.courierStatus !== normalized.courierStatus ||
        order.courierStatusCode !== normalized.courierStatusCode ||
        (!order.trackingId && !!trackData.trackingNumber);

      const updateData: any = {
        courier: "PostEx",
        courierStatus: normalized.courierStatus,
        courierStatusCode: normalized.courierStatusCode,
        deliveryStatus: mappedDeliveryStatus,
        lastCourierSyncAt: now,
        courierSyncError: null,
        rawCourierResponse: item as any,
      };

      if (trackData.trackingNumber && trackData.trackingNumber !== order.trackingId) {
        updateData.trackingId = trackData.trackingNumber;
      }

      if (isStatusChanged) {
        updateData.lastStatusChangeAt = now;

        // Idempotent audit log write
        await prisma.courierStatusLog.create({
          data: {
            orderId: order.id,
            trackingNumber: trackData.trackingNumber || order.trackingId || trackingNumber,
            courier: "PostEx",
            prevInternalStatus: order.deliveryStatus || order.courierStatus,
            newInternalStatus: mappedDeliveryStatus,
            courierStatus: normalized.courierStatus,
            courierStatusCode: normalized.courierStatusCode,
            source: "webhook",
            rawPayload: item as any,
          },
        });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: updateData,
      });

      processedCount++;
    }

    return NextResponse.json({
      ok: true,
      processed: processedCount,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Webhook processing error", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}
