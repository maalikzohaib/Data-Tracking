import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPostexConfig, PostexTrackData } from "@/lib/postex";
import { normalizePostexStatus } from "@/lib/postex-status";
import { broadcastEvent } from "@/lib/events";

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
        ""
      ).trim();

      const orderRef = String(
        item.orderRefNumber ||
        item.orderRef ||
        item.orderNumber ||
        item.order_number ||
        item.invoiceId ||
        item.reference ||
        ""
      ).trim();

      if (!trackingNumber && !orderRef) continue;

      const orderRefClean = orderRef.replace(/^#/, "");
      const orderRefHash = orderRef ? (orderRef.startsWith("#") ? orderRef : `#${orderRef}`) : "";

      const orFilters: any[] = [];
      if (trackingNumber) {
        orFilters.push({ trackingId: { equals: trackingNumber, mode: "insensitive" } });
        orFilters.push({ orderNumber: { equals: trackingNumber, mode: "insensitive" } });
      }
      if (orderRef) {
        orFilters.push({ orderNumber: { equals: orderRef, mode: "insensitive" } });
        orFilters.push({ orderNumber: { equals: orderRefHash, mode: "insensitive" } });
        orFilters.push({ orderNumber: { equals: orderRefClean, mode: "insensitive" } });
        orFilters.push({ shopifyId: { equals: orderRefClean } });
      }

      // Find matching order in DB by trackingId, orderNumber, or shopifyId
      const order = await prisma.order.findFirst({
        where: { OR: orFilters },
      });

      if (!order) continue;

      // Normalize status
      const trackData: PostexTrackData = {
        trackingNumber: order.trackingId || trackingNumber,
        orderRefNumber: orderRef || order.orderNumber,
        transactionStatus: item.transactionStatus || item.status || item.orderStatus,
        transactionStatusCode: item.transactionStatusCode || item.statusCode || item.orderStatusCode,
        orderStatus: item.orderStatus || item.status,
        orderStatusCode: item.orderStatusCode || item.statusCode,
        transactionStatusHistory: item.transactionStatusHistory || item.history || [],
      };

      const normalized = normalizePostexStatus(trackData, config.statusMapping);
      const lowerInternal = normalized.internalStatus.toLowerCase();
      const mappedDeliveryStatus =
        lowerInternal === "pending"
          ? (order.deliveryStatus || "pending under ATC")
          : lowerInternal;

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

      // Handle Cancelled status automatically
      if (
        mappedDeliveryStatus === "cancelled" ||
        mappedDeliveryStatus === "cancel" ||
        normalized.courierStatusCode === "0002" ||
        normalized.courierStatusCode === "0009"
      ) {
        updateData.cancelled = true;
        updateData.archived = true;
        updateData.deliveryStatus = "cancelled";
      }

      // Handle Attempt status automatically
      if (mappedDeliveryStatus.includes("attempt") || normalized.courierStatusCode === "0013") {
        updateData.deliveryStatus = "delivery attempt";
        updateData.isCourierHanded = true;
      }

      // Handle Delivered status automatically
      if (mappedDeliveryStatus === "delivered" || normalized.courierStatusCode === "0005") {
        updateData.deliveryStatus = "delivered";
        updateData.isCourierHanded = true;
      }

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

      // Record SyncLog for visible audit trail in Settings > Sync Logs
      const orderLabel = order.orderNumber?.startsWith("#") ? order.orderNumber : `#${order.orderNumber || order.id}`;
      await prisma.syncLog.create({
        data: {
          source: "postex-webhook",
          status: "success",
          count: 1,
          message: `${normalized.courierStatus} [${normalized.courierStatusCode || ""}] — ${orderLabel} (${order.customerName || "Customer"})`,
        },
      }).catch(() => {});

      processedCount++;
    }

    if (processedCount > 0) {
      broadcastEvent("postex:sync", { processed: processedCount });
      broadcastEvent("order:updated", { count: processedCount });
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
