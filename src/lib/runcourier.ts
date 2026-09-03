/**
 * Run Courier API Client
 * 
 * Server-side only. All credentials stay on the server.
 * Based on official Run Courier V2 API documentation.
 */

import { prisma } from "./prisma";

// ── Config ─────────────────────────────────────────────────────

export interface RunCourierConfig {
  authKey: string;
}

export async function getRunCourierConfig(): Promise<RunCourierConfig> {
  try {
    const dbConfig = await prisma.runCourierConfig.findUnique({
      where: { id: "default" },
    });
    if (dbConfig?.authKey && dbConfig.authKey.trim().length > 0) {
      return { authKey: dbConfig.authKey.trim() };
    }
  } catch {
    // fallback to env
  }
  const authKey = process.env.RUN_COURIER_AUTH_KEY || "";
  return { authKey };
}

// ── Types ──────────────────────────────────────────────────────

export interface RunCourierStatusItem {
  tracking_no: string;
  status: string;
  created: string;
}

export interface RunCourierThirdPartyGateway {
  id: number | string;
  title: string;
  booking_api_id: number | string;
  gateway_id: number | string;
}

// ── Internal Fetch Helper ──────────────────────────────────────

async function rcFetch<T>(
  url: string,
  options: RequestInit = {},
  retries = 2
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Run Courier API HTTP ${res.status}: ${text.slice(0, 300)}`
        );
      }

      const json = await res.json();
      return json as T;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      }
    }
  }

  // Sanitize error message — never leak auth key
  const authKey = process.env.RUN_COURIER_AUTH_KEY || "";
  const sanitized = String((lastError as any)?.message || lastError).replace(
    authKey,
    "REDACTED"
  );
  throw new Error(
    `Run Courier request failed after ${retries + 1} attempts: ${sanitized}`
  );
}

// ── CurrentStatus.php ──────────────────────────────────────────

/**
 * Get the latest/current shipment status for a tracking number.
 * POST https://portal.runcourier.com/API/CurrentStatus.php
 * Body: { "tracking_no": "TRACKING_NUMBER" }
 * Response: [{ tracking_no, status, created }]
 */
export async function fetchCurrentStatus(
  trackingNo: string
): Promise<RunCourierStatusItem | null> {
  const clean = trackingNo.trim();
  if (!clean) return null;

  try {
    const res = await rcFetch<RunCourierStatusItem[]>(
      "https://portal.runcourier.com/API/CurrentStatus.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_no: clean }),
      },
      1
    );

    if (Array.isArray(res) && res.length > 0 && res[0].tracking_no) {
      return res[0];
    }

    return null;
  } catch {
    return null;
  }
}

// ── TrackOrder.php ─────────────────────────────────────────────

/**
 * Get complete tracking history for a tracking number.
 * POST https://portal.runcourier.com/API/TrackOrder.php
 * Body: { "tracking_no": "TRACKING_NUMBER" }
 * Response: [{ tracking_no, status, created }, ...]
 */
export async function fetchTrackingHistory(
  trackingNo: string
): Promise<RunCourierStatusItem[]> {
  const clean = trackingNo.trim();
  if (!clean) return [];

  try {
    const res = await rcFetch<RunCourierStatusItem[]>(
      "https://portal.runcourier.com/API/TrackOrder.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_no: clean }),
      },
      1
    );

    if (Array.isArray(res)) {
      return res.filter((item) => item.tracking_no && item.status);
    }

    return [];
  } catch {
    return [];
  }
}

// ── GetOrderList.php ───────────────────────────────────────────

/**
 * Retrieve all Run Courier orders for the authenticated account.
 * POST https://portal.runcourier.com/API/GetOrderList.php
 * Body: { "auth_key": "AUTH_KEY" }
 */
export async function fetchOrderList(authKey: string): Promise<any[]> {
  if (!authKey) return [];

  try {
    const res = await rcFetch<any>(
      "https://portal.runcourier.com/API/GetOrderList.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_key: authKey }),
      }
    );

    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

// ── StatusList.php ─────────────────────────────────────────────

let _statusListCache: string[] | null = null;
let _statusListCacheTime = 0;
const STATUS_LIST_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Retrieve the official Run Courier status list.
 * GET https://portal.runcourier.com/API/StatusList.php
 * Cached for 1 hour.
 */
export async function fetchStatusList(): Promise<string[]> {
  if (
    _statusListCache &&
    Date.now() - _statusListCacheTime < STATUS_LIST_CACHE_TTL
  ) {
    return _statusListCache;
  }

  try {
    const res = await rcFetch<any>(
      "https://portal.runcourier.com/API/StatusList.php",
      { method: "GET" }
    );

    const list = Array.isArray(res)
      ? res.map((item: any) => item.status || item.title || String(item)).filter(Boolean)
      : [];

    _statusListCache = list;
    _statusListCacheTime = Date.now();
    return list;
  } catch {
    return [];
  }
}

// ── getThirdpartyApiAndGateways.php ────────────────────────────

let _gatewayCache: RunCourierThirdPartyGateway[] | null = null;
let _gatewayCacheTime = 0;
const GATEWAY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Retrieve third-party/underlying courier gateways from Run Courier.
 * GET https://portal.runcourier.com/API/getThirdpartyApiAndGateways.php
 * Cached for 1 hour.
 */
export async function fetchThirdPartyGateways(): Promise<
  RunCourierThirdPartyGateway[]
> {
  if (
    _gatewayCache &&
    Date.now() - _gatewayCacheTime < GATEWAY_CACHE_TTL
  ) {
    return _gatewayCache;
  }

  try {
    const res = await rcFetch<any>(
      "https://portal.runcourier.com/API/getThirdpartyApiAndGateways.php",
      { method: "GET" }
    );

    const list = Array.isArray(res)
      ? res.filter(
          (item: any) => item.id && item.title
        ) as RunCourierThirdPartyGateway[]
      : [];

    _gatewayCache = list;
    _gatewayCacheTime = Date.now();
    return list;
  } catch {
    return [];
  }
}
