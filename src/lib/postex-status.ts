import { PostexTrackData, PostexStatusHistoryItem } from "./postex";

/**
 * Standard Default Status Mappings according to PostEx Integration Guide
 */
export const DEFAULT_POSTEX_CODE_MAP: Record<string, string> = {
  "0001": "Pending",               // At Merchant's Warehouse / Booked
  "0002": "Returned",              // Returned
  "0003": "In Transit",            // At PostEx Warehouse
  "0004": "Out for Delivery",       // Package on Route
  "0005": "Delivered",             // Delivered
  "0006": "Return in Transit",     // Return In-Transit
  "0007": "Return in Transit",     // Return Received at Warehouse
  "0008": "Under Review",          // Delivery Under Review
  "0009": "Cancelled",             // Order Cancelled by Merchant
  "0010": "In Transit",            // Dispatched to Destination
  "0011": "In Transit",            // Received at Destination
  "0012": "Out for Delivery",       // Out for Delivery
  "0013": "Delivery Attempt",      // Attempt Made / Delivery Failed
  "0014": "Return Initiated",      // Return Requested
  "0015": "Return Out for Delivery", // Return Out for Delivery
  "0016": "Returned",              // Returned to Merchant
};

export interface NormalizedCourierStatus {
  internalStatus: string;
  courierStatus: string;
  courierStatusCode: string;
  isReturnJourney: boolean;
  history: PostexStatusHistoryItem[];
  raw: PostexTrackData;
}

/**
 * Inspects tracking history and status text to accurately classify normal delivery vs return journey
 */
export function normalizePostexStatus(
  trackData: PostexTrackData,
  customMapping?: Record<string, string> | null
): NormalizedCourierStatus {
  const code = (
    trackData.transactionStatusCode ||
    trackData.orderStatusCode ||
    String(trackData.orderStatusId || "")
  ).trim();

  const rawStatus = (
    trackData.transactionStatus ||
    trackData.orderStatus ||
    "Unknown"
  ).trim();

  const history = Array.isArray(trackData.transactionStatusHistory)
    ? [...trackData.transactionStatusHistory]
    : [];

  // Check if custom mapping overrides this code
  if (customMapping && code && customMapping[code]) {
    return {
      internalStatus: customMapping[code],
      courierStatus: rawStatus,
      courierStatusCode: code,
      isReturnJourney: customMapping[code].toLowerCase().includes("return"),
      history,
      raw: trackData,
    };
  }

  // Check code mapping
  if (code && DEFAULT_POSTEX_CODE_MAP[code]) {
    const internal = DEFAULT_POSTEX_CODE_MAP[code];
    return {
      internalStatus: internal,
      courierStatus: rawStatus,
      courierStatusCode: code,
      isReturnJourney: internal.toLowerCase().includes("return"),
      history,
      raw: trackData,
    };
  }

  // Fallback heuristic based on status text and history analysis
  const lowerStatus = rawStatus.toLowerCase();

  // Return Journey Analysis
  if (lowerStatus.includes("return")) {
    if (lowerStatus.includes("out for delivery") || lowerStatus.includes("delivery to merchant")) {
      return {
        internalStatus: "Return Out for Delivery",
        courierStatus: rawStatus,
        courierStatusCode: code || "RET_OFD",
        isReturnJourney: true,
        history,
        raw: trackData,
      };
    }
    if (lowerStatus.includes("transit") || lowerStatus.includes("warehouse") || lowerStatus.includes("process")) {
      return {
        internalStatus: "Return in Transit",
        courierStatus: rawStatus,
        courierStatusCode: code || "RET_TRANSIT",
        isReturnJourney: true,
        history,
        raw: trackData,
      };
    }
    if (lowerStatus.includes("initiat") || lowerStatus.includes("request")) {
      return {
        internalStatus: "Return Initiated",
        courierStatus: rawStatus,
        courierStatusCode: code || "RET_INIT",
        isReturnJourney: true,
        history,
        raw: trackData,
      };
    }
    return {
      internalStatus: "Returned",
      courierStatus: rawStatus,
      courierStatusCode: code || "0002",
      isReturnJourney: true,
      history,
      raw: trackData,
    };
  }

  // Normal Delivery Flow
  if (lowerStatus.includes("delivered") || lowerStatus.includes("complete")) {
    return {
      internalStatus: "Delivered",
      courierStatus: rawStatus,
      courierStatusCode: code || "0005",
      isReturnJourney: false,
      history,
      raw: trackData,
    };
  }

  if (lowerStatus.includes("route") || lowerStatus.includes("out for delivery") || lowerStatus.includes("with rider")) {
    return {
      internalStatus: "Out for Delivery",
      courierStatus: rawStatus,
      courierStatusCode: code || "0004",
      isReturnJourney: false,
      history,
      raw: trackData,
    };
  }

  if (lowerStatus.includes("attempt") || lowerStatus.includes("failed") || lowerStatus.includes("undelivered")) {
    return {
      internalStatus: "Delivery Attempt",
      courierStatus: rawStatus,
      courierStatusCode: code || "0013",
      isReturnJourney: false,
      history,
      raw: trackData,
    };
  }

  if (lowerStatus.includes("review") || lowerStatus.includes("hold") || lowerStatus.includes("investigat")) {
    return {
      internalStatus: "Under Review",
      courierStatus: rawStatus,
      courierStatusCode: code || "0008",
      isReturnJourney: false,
      history,
      raw: trackData,
    };
  }

  if (lowerStatus.includes("warehouse") || lowerStatus.includes("transit") || lowerStatus.includes("dispatched") || lowerStatus.includes("received")) {
    return {
      internalStatus: "In Transit",
      courierStatus: rawStatus,
      courierStatusCode: code || "0003",
      isReturnJourney: false,
      history,
      raw: trackData,
    };
  }

  if (lowerStatus.includes("cancel")) {
    return {
      internalStatus: "Cancelled",
      courierStatus: rawStatus,
      courierStatusCode: code || "0009",
      isReturnJourney: false,
      history,
      raw: trackData,
    };
  }

  if (lowerStatus.includes("merchant") || lowerStatus.includes("booked") || lowerStatus.includes("pending") || lowerStatus.includes("created")) {
    return {
      internalStatus: "Pending",
      courierStatus: rawStatus,
      courierStatusCode: code || "0001",
      isReturnJourney: false,
      history,
      raw: trackData,
    };
  }

  // Default fallback
  return {
    internalStatus: rawStatus || "In Transit",
    courierStatus: rawStatus,
    courierStatusCode: code || "0000",
    isReturnJourney: false,
    history,
    raw: trackData,
  };
}
