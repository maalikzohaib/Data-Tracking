/**
 * Run Courier Sync Engine
 *
 * Synchronizes orders where courierProvider = "run_courier" using the
 * Run Courier API. Mirrors the pattern of postex-sync.ts.
 */

import { prisma } from "./prisma";
import {
  fetchCurrentStatus,
  fetchTrackingHistory,
  fetchOrderList,
  getRunCourierConfig,
  RunCourierStatusItem,
} from "./runcourier";
import { normalizeRunCourierStatus } from "./runcourier-status";
import { broadcastEvent } from "./events";

export interface RunCourierSyncResult {
  checked: number;
  updated: number;
  unchanged: number;
  failed: number;
  errors: string[];
  lastSync: string;
}

export interface RCSyncOptions {
  orderIds?: string[];
  forceAll?: boolean;
  source?: "cron" | "manual_bulk" | "manual_single";
}

/**
 * Bulk-sync all Run Courier orders.
 * Cross-references with GetOrderList.php and updates order status, tracking, and sections.
 */
export async function syncRunCourierOrders(
  options: RCSyncOptions = {}
): Promise<RunCourierSyncResult> {
  const { orderIds, forceAll = false, source = "manual_bulk" } = options;
  const config = await getRunCourierConfig();

  if (!config.authKey) {
    throw new Error(
      "Run Courier auth key is not configured. Set RUN_COURIER_AUTH_KEY in your environment or Settings."
    );
  }

  // 1. Fetch all orders from Run Courier API
  let rcOrders: any[] = [];
  try {
    rcOrders = await fetchOrderList(config.authKey);
  } catch (err: any) {
    console.error("[Run Courier] Error fetching order list:", err?.message || err);
  }

  // Index Run Courier orders by tracking_no and order_id
  const rcByTracking = new Map<string, any>();
  const rcByOrderNum = new Map<string, any>();
  const rcOrderNumbers: string[] = [];
  const rcTrackingNumbers: string[] = [];

  for (const rc of rcOrders) {
    if (rc.tracking_no) {
      const cleanTrack = rc.tracking_no.trim().toLowerCase();
      rcByTracking.set(cleanTrack, rc);
      rcTrackingNumbers.push(rc.tracking_no.trim());
    }
    if (rc.order_id) {
      const cleanNum = rc.order_id.trim().toLowerCase();
      rcByOrderNum.set(cleanNum, rc);
      rcByOrderNum.set(cleanNum.replace("#", ""), rc);
      rcByOrderNum.set(`#${cleanNum.replace("#", "")}`, rc);

      rcOrderNumbers.push(rc.order_id.trim());
      rcOrderNumbers.push(rc.order_id.replace("#", "").trim());
      rcOrderNumbers.push(`#${rc.order_id.replace("#", "").trim()}`);
    }
  }

  // 2. Find eligible orders in our DB:
  // - Explicitly run_courier
  // - Courier name is Run Courier
  // - Order number matches an order in Run Courier
  // - Tracking ID matches a tracking number in Run Courier
  // - Tracking ID starts with LE (Leopards booked via Run Courier)
  const where: any = {};

  if (orderIds && orderIds.length > 0) {
    where.id = { in: orderIds };
  } else {
    const orConditions: any[] = [
      { courierProvider: "run_courier" },
      { courier: { equals: "Run Courier", mode: "insensitive" } },
    ];

    if (rcOrderNumbers.length > 0) {
      orConditions.push({ orderNumber: { in: rcOrderNumbers } });
    }
    if (rcTrackingNumbers.length > 0) {
      orConditions.push({ trackingId: { in: rcTrackingNumbers } });
    }
    orConditions.push({ trackingId: { startsWith: "LE", mode: "insensitive" } });

    where.OR = orConditions;

    if (!forceAll) {
      where.archived = false;
    }
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      courier: true,
      courierProvider: true,
      trackingId: true,
      deliveryStatus: true,
      courierStatus: true,
      courierStatusCode: true,
      stage: true,
      isCourierHanded: true,
    },
    take: 300,
  });

  const result: RunCourierSyncResult = {
    checked: orders.length,
    updated: 0,
    unchanged: 0,
    failed: 0,
    errors: [],
    lastSync: new Date().toISOString(),
  };

  if (orders.length === 0) return result;

  // Process matching orders
  for (const order of orders) {
    try {
      // Check if Run Courier order list has data for this order
      let matchedRc: any = null;
      if (order.trackingId) {
        matchedRc = rcByTracking.get(order.trackingId.trim().toLowerCase());
      }
      if (!matchedRc && order.orderNumber) {
        matchedRc =
          rcByOrderNum.get(order.orderNumber.trim().toLowerCase()) ||
          rcByOrderNum.get(order.orderNumber.replace("#", "").trim().toLowerCase());
      }

      const outcome = await syncOneOrderWithData(order, matchedRc, source);
      if (outcome === "updated") result.updated++;
      else result.unchanged++;
    } catch (err: any) {
      result.failed++;
      result.errors.push(`Order ${order.orderNumber || order.id}: ${String(err?.message || err)}`);
    }
  }

  // Log sync
  await prisma.syncLog.create({
    data: {
      source: "runcourier",
      status: result.failed === 0 ? "success" : "partial",
      message: `Checked: ${result.checked}, Updated: ${result.updated}, Unchanged: ${result.unchanged}, Failed: ${result.failed}`,
      count: result.updated,
    },
  });

  // Broadcast event so UI reloads via SSE
  try {
    broadcastEvent("runcourier:sync", { count: result.updated });
    broadcastEvent("order:updated", { count: result.updated });
  } catch {
    // ignore SSE errors
  }

  return result;
}

/**
 * Sync an order using either pre-fetched Run Courier list data or by querying CurrentStatus.php.
 */
async function syncOneOrderWithData(
  order: {
    id: string;
    orderNumber: string | null;
    courier: string | null;
    courierProvider: string | null;
    trackingId: string | null;
    deliveryStatus: string | null;
    courierStatus: string | null;
    courierStatusCode: string | null;
    stage: string | null;
    isCourierHanded: boolean;
  },
  rcData: any | null,
  source: string
): Promise<"updated" | "unchanged"> {
  const trackingNo = (rcData?.tracking_no || order.trackingId || "").trim();

  let rawStatus = "";
  let rawDate = "";
  let fullPayload: any = null;

  if (rcData?.status) {
    rawStatus = rcData.status;
    rawDate = rcData.status_date || rcData.order_date || "";
    fullPayload = rcData;
  } else if (trackingNo) {
    const statusData = await fetchCurrentStatus(trackingNo);
    if (!statusData) {
      throw new Error(`No status data returned for tracking ${trackingNo}`);
    }
    rawStatus = statusData.status;
    rawDate = statusData.created;
    fullPayload = statusData;
  } else {
    throw new Error("Order has neither tracking number nor matching Run Courier entry");
  }

  const normalized = normalizeRunCourierStatus(rawStatus, rawDate);
  const now = new Date();

  const isStatusChanged =
    order.courierStatus !== normalized.courierStatus ||
    order.courierStatusCode !== normalized.courierStatusCode ||
    order.deliveryStatus?.toLowerCase() !== normalized.internalStatus.toLowerCase() ||
    order.courierProvider !== "run_courier" ||
    (trackingNo && order.trackingId !== trackingNo);

  const isDelivered = normalized.internalStatus.toLowerCase() === "delivered";
  const isHanded = normalized.internalStatus.toLowerCase() !== "pending under atc";

  // Determine courier display name
  let courierName = order.courier;
  if (!courierName || courierName === "Run Courier") {
    if (trackingNo.toUpperCase().startsWith("LE")) {
      courierName = "Leopards";
    } else if (trackingNo.toUpperCase().startsWith("TCS")) {
      courierName = "TCS";
    } else {
      courierName = "Run Courier";
    }
  }

  const updateData: any = {
    courier: courierName,
    courierProvider: "run_courier",
    courierStatus: normalized.courierStatus,
    courierStatusCode: normalized.courierStatusCode,
    deliveryStatus: normalized.internalStatus,
    lastCourierSyncAt: now,
    courierSyncError: null,
    rawCourierResponse: fullPayload,
  };

  if (trackingNo && !order.trackingId) {
    updateData.trackingId = trackingNo;
  }

  if (isDelivered) {
    updateData.stage = "completed";
    updateData.fulfillmentStatus = "fulfilled";
    updateData.isCourierHanded = true;
  } else if (isHanded && !order.isCourierHanded) {
    updateData.isCourierHanded = true;
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
        trackingNumber: trackingNo || order.trackingId,
        courier: "Run Courier",
        prevInternalStatus: order.deliveryStatus || order.courierStatus,
        newInternalStatus: normalized.internalStatus,
        courierStatus: normalized.courierStatus,
        courierStatusCode: normalized.courierStatusCode,
        source,
        rawPayload: fullPayload,
      },
    });

    return "updated";
  } else {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        lastCourierSyncAt: now,
        courierSyncError: null,
        ...(updateData.stage ? { stage: updateData.stage } : {}),
        ...(updateData.isCourierHanded !== undefined ? { isCourierHanded: updateData.isCourierHanded } : {}),
      },
    });

    return "unchanged";
  }
}

/**
 * Sync a single order by ID — fetches both CurrentStatus and TrackingHistory.
 * Used for manual single-order sync from the edit drawer.
 */
export async function syncSingleRunCourierOrder(orderId: string): Promise<{
  order: any;
  normalized: ReturnType<typeof normalizeRunCourierStatus>;
  statusData: RunCourierStatusItem;
  history: RunCourierStatusItem[];
}> {
  const config = await getRunCourierConfig();
  if (!config.authKey) {
    throw new Error(
      "Run Courier auth key is not configured. Set RUN_COURIER_AUTH_KEY."
    );
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const trackingNo = order.trackingId?.trim();
  if (!trackingNo) {
    throw new Error("Order does not have a tracking number");
  }

  // Fetch current status
  const statusData = await fetchCurrentStatus(trackingNo);
  if (!statusData) {
    throw new Error(
      `No tracking data returned from Run Courier for ${trackingNo}`
    );
  }

  // Fetch full tracking history
  const history = await fetchTrackingHistory(trackingNo);

  const normalized = normalizeRunCourierStatus(
    statusData.status,
    statusData.created
  );

  const now = new Date();

  const isStatusChanged =
    order.courierStatus !== normalized.courierStatus ||
    order.courierStatusCode !== normalized.courierStatusCode ||
    order.deliveryStatus?.toLowerCase() !==
      normalized.internalStatus.toLowerCase();

  const updateData: any = {
    courier: order.courier || "Run Courier",
    courierProvider: "run_courier",
    courierStatus: normalized.courierStatus,
    courierStatusCode: normalized.courierStatusCode,
    deliveryStatus: normalized.internalStatus,
    lastCourierSyncAt: now,
    courierSyncError: null,
    rawCourierResponse: { currentStatus: statusData, history } as any,
  };

  if (isStatusChanged) {
    updateData.lastStatusChangeAt = now;

    // Create log entry for the status change
    await prisma.courierStatusLog.create({
      data: {
        orderId: order.id,
        trackingNumber: trackingNo,
        courier: "Run Courier",
        prevInternalStatus: order.deliveryStatus || order.courierStatus,
        newInternalStatus: normalized.internalStatus,
        courierStatus: normalized.courierStatus,
        courierStatusCode: normalized.courierStatusCode,
        source: "manual_single",
        rawPayload: { currentStatus: statusData, history } as any,
      },
    });
  }

  // Also store individual history events as CourierStatusLog entries
  // (idempotent — skip if already stored)
  if (history.length > 0) {
    const existingLogs = await prisma.courierStatusLog.findMany({
      where: { orderId: order.id, courier: "Run Courier" },
      select: { courierStatus: true, createdAt: true },
    });

    const existingSet = new Set(
      existingLogs.map(
        (l) => `${l.courierStatus}|${l.createdAt.toISOString()}`
      )
    );

    for (const event of history) {
      const eventNorm = normalizeRunCourierStatus(event.status, event.created);
      const eventTime = event.created ? new Date(event.created) : now;
      const key = `${event.status}|${eventTime.toISOString()}`;

      if (!existingSet.has(key)) {
        await prisma.courierStatusLog.create({
          data: {
            orderId: order.id,
            trackingNumber: trackingNo,
            courier: "Run Courier",
            prevInternalStatus: null,
            newInternalStatus: eventNorm.internalStatus,
            courierStatus: event.status,
            courierStatusCode: eventNorm.courierStatusCode,
            source: "manual_single",
            rawPayload: event as any,
            createdAt: eventTime,
          },
        });
      }
    }
  }

  const isDelivered = normalized.internalStatus.toLowerCase() === "delivered";
  const isHanded = normalized.internalStatus.toLowerCase() !== "pending under atc";

  if (isDelivered) {
    updateData.stage = "completed";
    updateData.fulfillmentStatus = "fulfilled";
    updateData.isCourierHanded = true;
  } else if (isHanded) {
    updateData.isCourierHanded = true;
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

  try {
    broadcastEvent("runcourier:sync", { orderId: order.id });
    broadcastEvent("order:updated", { orderId: order.id });
  } catch {
    // ignore
  }

  return {
    order: updatedOrder,
    normalized,
    statusData,
    history,
  };
}
