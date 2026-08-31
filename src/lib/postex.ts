import { prisma } from "./prisma";

export interface PostexStatusHistoryItem {
  transactionStatus?: string;
  transactionStatusCode?: string;
  transactionStatusMessage?: string;
  transactionStatusMessageCode?: string;
  transactionDate?: string;
  message?: string;
  messageCode?: string;
  createdDate?: string;
  updatedDate?: string;
  updatedAt?: string;
}

export interface PostexTrackData {
  trackingNumber: string;
  orderRefNumber?: string | null;
  orderStatus?: string | null;
  orderStatusCode?: string | null;
  orderStatusId?: string | number | null;
  transactionStatus?: string | null;
  transactionStatusCode?: string | null;
  transactionStatusHistory?: PostexStatusHistoryItem[];
  cityName?: string | null;
  invoicePaymentStatus?: string | null;
  orderType?: string | null;
  orderDate?: string | null;
  message?: string | null;
  trackingResponse?: any;
}

export interface PostexTrackResponse {
  statusCode?: string | number;
  statusMessage?: string;
  dist?: PostexTrackData | PostexTrackData[] | any;
  data?: PostexTrackData | PostexTrackData[] | any;
  response?: PostexTrackData | PostexTrackData[] | any;
}

export interface PostexConfigData {
  apiToken: string | null;
  baseUrl: string;
  webhookHeaderKey: string;
  webhookHeaderValue: string | null;
  webhookEnabled: boolean;
  cronEnabled: boolean;
  syncIntervalMinutes: number;
  statusMapping: Record<string, string> | null;
}

/**
 * Retrieve PostEx config from Database or fallback to .env
 */
export async function getPostexConfig(): Promise<PostexConfigData> {
  const dbConfig = await prisma.postexConfig.findUnique({
    where: { id: "default" },
  });

  const apiToken = dbConfig?.apiToken || process.env.POSTEX_API_TOKEN || null;
  const baseUrl = (dbConfig?.baseUrl || process.env.POSTEX_BASE_URL || "https://api.postex.pk").replace(/\/+$/, "");
  const webhookHeaderKey = dbConfig?.webhookHeaderKey || process.env.POSTEX_WEBHOOK_HEADER_KEY || "X-Postex-Auth";
  const webhookHeaderValue = dbConfig?.webhookHeaderValue || process.env.POSTEX_WEBHOOK_HEADER_VALUE || null;
  const webhookEnabled = dbConfig?.webhookEnabled ?? true;
  const cronEnabled = dbConfig?.cronEnabled ?? true;
  const syncIntervalMinutes = dbConfig?.syncIntervalMinutes ?? 60;
  const statusMapping = (dbConfig?.statusMapping as Record<string, string> | null) || null;

  return {
    apiToken,
    baseUrl,
    webhookHeaderKey,
    webhookHeaderValue,
    webhookEnabled,
    cronEnabled,
    syncIntervalMinutes,
    statusMapping,
  };
}

/**
 * Execute PostEx API request with retry logic and error sanitization
 */
async function postexFetch<T>(
  endpoint: string,
  config: PostexConfigData,
  options: RequestInit = {},
  retries = 2
): Promise<T> {
  if (!config.apiToken) {
    throw new Error("PostEx API Token is not configured. Please set it in Settings.");
  }

  const url = `${config.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});
  headers.set("token", config.apiToken);
  headers.set("Content-Type", "application/json");

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        const sanitizedText = text.replace(config.apiToken, "REDACTED");
        throw new Error(`PostEx API HTTP ${res.status}: ${sanitizedText.slice(0, 300)}`);
      }

      const json = await res.json();
      return json as T;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
      }
    }
  }

  const sanitizedMessage = String((lastError as any)?.message || lastError).replace(config.apiToken || "", "REDACTED");
  throw new Error(`PostEx Request failed after ${retries + 1} attempts: ${sanitizedMessage}`);
}

/**
 * Normalize and unwrap raw PostEx tracking payload
 */
export function flattenPostexItem(item: any): PostexTrackData | null {
  if (!item || item.message === "ORDER NOT FOUND" || item.message === "RECORD NOT FOUND") return null;

  const nested = item.trackingResponse || item;
  const trackingNumber = (item.trackingNumber || nested.trackingNumber || "").trim();
  if (!trackingNumber) return null;

  const history = Array.isArray(nested.transactionStatusHistory)
    ? nested.transactionStatusHistory.map((h: any) => ({
        transactionStatus: h.transactionStatus || h.transactionStatusMessage || h.message,
        transactionStatusCode: h.transactionStatusCode || h.transactionStatusMessageCode || h.messageCode,
        transactionDate: h.transactionDate || h.updatedAt || h.createdDate,
      }))
    : [];

  const latestHistory = history.length > 0 ? history[history.length - 1] : null;

  return {
    trackingNumber,
    orderRefNumber: nested.orderRefNumber || item.orderRefNumber || null,
    orderStatus: nested.transactionStatus || nested.orderStatus || latestHistory?.transactionStatus || null,
    orderStatusCode: latestHistory?.transactionStatusCode || null,
    transactionStatus: nested.transactionStatus || latestHistory?.transactionStatus || null,
    transactionStatusCode: latestHistory?.transactionStatusCode || null,
    transactionStatusHistory: history,
    cityName: nested.cityName || item.cityName || null,
    invoicePaymentStatus: nested.invoicePaymentStatus || null,
    orderType: nested.orderType || null,
    orderDate: nested.transactionDate || null,
    message: item.message || "SUCCESS",
    trackingResponse: nested,
  };
}

/**
 * Track a single order by tracking number
 */
export async function trackPostexOrder(
  trackingNumber: string,
  passedConfig?: PostexConfigData
): Promise<PostexTrackData | null> {
  const cleanId = trackingNumber.trim();
  if (!cleanId) return null;

  const config = passedConfig || (await getPostexConfig());

  try {
    const endpoint = `/services/integration/api/order/v1/track-order/${encodeURIComponent(cleanId)}`;
    const res = await postexFetch<PostexTrackResponse>(endpoint, config, {}, 1);
    const data = res.dist || res.data || res.response;

    if (Array.isArray(data) && data.length > 0) {
      const flattened = data.map(flattenPostexItem).filter(Boolean);
      return flattened[0] || null;
    } else if (data && typeof data === "object") {
      return flattenPostexItem(data);
    }
  } catch {
    // fallback
  }

  return null;
}

/**
 * Store item in lookup map by trackingNumber and orderRefNumber
 */
function indexTrackData(map: Map<string, PostexTrackData>, rawItem: any) {
  const item = flattenPostexItem(rawItem);
  if (!item) return;

  if (item.trackingNumber) {
    const tn = item.trackingNumber.trim().toLowerCase();
    map.set(tn, item);
    map.set(tn.replace("#", ""), item);
  }

  if (item.orderRefNumber) {
    const ref = item.orderRefNumber.trim().toLowerCase();
    map.set(ref, item);
    map.set(ref.replace("#", ""), item);
    map.set(`#${ref.replace("#", "")}`, item);
  }
}

/**
 * Track multiple orders in bulk
 */
export async function trackPostexBulkOrders(
  trackingNumbers: string[],
  passedConfig?: PostexConfigData
): Promise<Map<string, PostexTrackData>> {
  const cleanList = Array.from(new Set(trackingNumbers.map((t) => t.trim()).filter(Boolean)));
  const resultMap = new Map<string, PostexTrackData>();

  if (cleanList.length === 0) return resultMap;

  const config = passedConfig || (await getPostexConfig());

  const CHUNK_SIZE = 30;
  for (let i = 0; i < cleanList.length; i += CHUNK_SIZE) {
    const chunk = cleanList.slice(i, i + CHUNK_SIZE);

    try {
      const bulkEndpoint = `/services/integration/api/order/v1/track-bulk-order?TrackingNumbers=${encodeURIComponent(
        chunk.join(",")
      )}`;
      const res = await postexFetch<PostexTrackResponse>(bulkEndpoint, config);
      const data = res.dist || res.data || res.response;

      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          indexTrackData(resultMap, item);
        }
      } else if (data && typeof data === "object") {
        indexTrackData(resultMap, data);
      }
    } catch {
      const singleResults = await Promise.allSettled(
        chunk.map((tn) => trackPostexOrder(tn, config))
      );
      singleResults.forEach((r) => {
        if (r.status === "fulfilled" && r.value) {
          indexTrackData(resultMap, r.value);
        }
      });
    }
  }

  return resultMap;
}
