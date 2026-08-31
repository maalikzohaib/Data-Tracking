import { prisma } from "./prisma";
import { getPostexConfig, trackPostexBulkOrders, trackPostexOrder, PostexTrackData } from "./postex";
import { normalizePostexStatus } from "./postex-status";

export interface PostexSyncResult {
  checked: number;
  updated: number;
  unchanged: number;
  failed: number;
  errors: string[];
  lastSync: string;
}

export interface SyncOptions {
  orderIds?: string[];
  forceAll?: boolean;
  source?: "webhook" | "cron" | "manual_bulk" | "manual_single";
}

/**
 * Synchronize PostEx orders in database automatically by Order Number or Tracking Number
 */
export async function syncPostexOrders(options: SyncOptions = {}): Promise<PostexSyncResult> {
  const { orderIds, forceAll = false, source = "manual_bulk" } = options;
  const config = await getPostexConfig();

  if (!config.apiToken) {
    throw new Error("PostEx API Token is not configured. Please save your token in Settings.");
  }

  // Find eligible orders: either has trackingId OR has an orderNumber to match from PostEx
  const where: any = {
    AND: [
      {
        OR: [
          { trackingId: { not: null, notIn: ["", "null", "undefined"] } },
          { orderNumber: { not: null, notIn: ["", "null", "undefined"] } },
        ],
      },
      {
        OR: [
          { courier: { equals: "PostEx", mode: "insensitive" } },
          { courier: null },
          { courier: "" },
        ],
      },
    ],
  };

  if (orderIds && orderIds.length > 0) {
    where.id = { in: orderIds };
  } else if (!forceAll) {
    where.archived = false;
    where.OR = [
      {
        lastCourierSyncAt: {
          lt: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
      {
        lastCourierSyncAt: null,
      },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      courier: true,
      trackingId: true,
      deliveryStatus: true,
      courierStatus: true,
      courierStatusCode: true,
      stage: true,
    },
    take: 300,
  });

  const result: PostexSyncResult = {
    checked: orders.length,
    updated: 0,
    unchanged: 0,
    failed: 0,
    errors: [],
    lastSync: new Date().toISOString(),
  };

  if (orders.length === 0) {
    return result;
  }

  // Collect all potential query keys (tracking ID and order numbers with/without #)
  const lookupKeys: string[] = [];
  for (const order of orders) {
    if (order.trackingId) lookupKeys.push(order.trackingId.trim());
    if (order.orderNumber) {
      const cleanNum = order.orderNumber.replace("#", "").trim();
      lookupKeys.push(cleanNum);
      lookupKeys.push(order.orderNumber.trim());
    }
  }

  const trackMap = await trackPostexBulkOrders(lookupKeys, config);
  const now = new Date();

  for (const order of orders) {
    // Try to find in trackMap by trackingId, orderNumber, or clean number
    let trackData: PostexTrackData | undefined;

    if (order.trackingId) {
      trackData = trackMap.get(order.trackingId.trim().toLowerCase());
    }
    if (!trackData && order.orderNumber) {
      trackData =
        trackMap.get(order.orderNumber.trim().toLowerCase()) ||
        trackMap.get(order.orderNumber.replace("#", "").trim().toLowerCase());
    }

    if (!trackData) {
      // Not yet booked in PostEx or not found
      if (order.courier?.toLowerCase() === "postex" && order.trackingId) {
        result.failed++;
        result.errors.push(`Order ${order.orderNumber || order.id}: Tracking info not found for ${order.trackingId}`);
      }
      continue;
    }

    try {
      const normalized = normalizePostexStatus(trackData, config.statusMapping);
      const mappedDeliveryStatus =
        normalized.internalStatus.toLowerCase() === "pending"
          ? (order.deliveryStatus || "pending under ATC")
          : normalized.internalStatus.toLowerCase();

      const isStatusChanged =
        order.deliveryStatus?.toLowerCase() !== mappedDeliveryStatus ||
        order.courierStatus !== normalized.courierStatus ||
        order.courierStatusCode !== normalized.courierStatusCode ||
        order.courier?.toLowerCase() !== "postex" ||
        (!order.trackingId && !!trackData.trackingNumber);

      const updateData: any = {
        courier: "PostEx",
        courierStatus: normalized.courierStatus,
        courierStatusCode: normalized.courierStatusCode,
        deliveryStatus: mappedDeliveryStatus,
        lastCourierSyncAt: now,
        courierSyncError: null,
        rawCourierResponse: trackData as any,
      };

      // Automatically link the retrieved PostEx tracking number
      if (trackData.trackingNumber && trackData.trackingNumber !== order.trackingId) {
        updateData.trackingId = trackData.trackingNumber;
      }

      if (isStatusChanged) {
        updateData.lastStatusChangeAt = now;

        await prisma.order.update({
          where: { id: order.id },
          data: updateData,
        });

        await prisma.courierStatusLog.create({
          data: {
            orderId: order.id,
            trackingNumber: trackData.trackingNumber || order.trackingId,
            courier: "PostEx",
            prevInternalStatus: order.deliveryStatus || order.courierStatus,
            newInternalStatus: mappedDeliveryStatus,
            courierStatus: normalized.courierStatus,
            courierStatusCode: normalized.courierStatusCode,
            source,
            rawPayload: trackData as any,
          },
        });

        result.updated++;
      } else {
        await prisma.order.update({
          where: { id: order.id },
          data: updateData,
        });
        result.unchanged++;
      }
    } catch (err: any) {
      result.failed++;
      const errMsg = `Order ${order.orderNumber || order.id}: ${String(err?.message || err)}`;
      result.errors.push(errMsg);
      await prisma.order.update({
        where: { id: order.id },
        data: {
          courierSyncError: String(err?.message || err).slice(0, 300),
          lastCourierSyncAt: now,
        },
      });
    }
  }

  await prisma.syncLog.create({
    data: {
      source: "postex",
      status: result.failed === 0 ? "success" : "partial",
      message: `Checked: ${result.checked}, Updated: ${result.updated}, Unchanged: ${result.unchanged}, Failed: ${result.failed}`,
      count: result.updated,
    },
  });

  return result;
}

/**
 * Sync single order by ID (automatically querying by trackingId or orderNumber)
 */
export async function syncSinglePostexOrder(orderId: string): Promise<{
  order: any;
  normalized: ReturnType<typeof normalizePostexStatus>;
  trackData: PostexTrackData;
}> {
  const config = await getPostexConfig();
  if (!config.apiToken) {
    throw new Error("PostEx API Token is not configured. Please save it in Settings.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new Error("Order not found");

  const queryKey = order.trackingId || (order.orderNumber ? order.orderNumber.replace("#", "") : null);
  if (!queryKey) throw new Error("Order does not have a tracking number or order number");

  const trackData = await trackPostexOrder(queryKey, config);
  if (!trackData) {
    throw new Error(`No tracking data returned from PostEx for Order ${order.orderNumber || queryKey}`);
  }

  const normalized = normalizePostexStatus(trackData, config.statusMapping);
  const mappedDeliveryStatus =
    normalized.internalStatus.toLowerCase() === "pending"
      ? (order.deliveryStatus || "pending under ATC")
      : normalized.internalStatus.toLowerCase();
  const now = new Date();
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
    rawCourierResponse: trackData as any,
  };

  if (trackData.trackingNumber) {
    updateData.trackingId = trackData.trackingNumber;
  }

  if (isStatusChanged) {
    updateData.lastStatusChangeAt = now;

    await prisma.courierStatusLog.create({
      data: {
        orderId: order.id,
        trackingNumber: trackData.trackingNumber || order.trackingId,
        courier: "PostEx",
        prevInternalStatus: order.deliveryStatus || order.courierStatus,
        newInternalStatus: mappedDeliveryStatus,
        courierStatus: normalized.courierStatus,
        courierStatusCode: normalized.courierStatusCode,
        source: "manual_single",
        rawPayload: trackData as any,
      },
    });
  }

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: updateData,
    include: {
      lineItems: true,
      courierLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  return {
    order: updatedOrder,
    normalized,
    trackData,
  };
}
