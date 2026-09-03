/**
 * Run Courier Status Mapping
 *
 * Maps raw Run Courier statuses → application's internal deliveryStatus values.
 * The internal statuses must match the existing DELIVERY_STATUSES list in the app:
 *   "pending under ATC", "pending", "in transit", "out for delivery",
 *   "delivered", "delivery attempt", "under review", "return initiated",
 *   "return in transit", "return out for delivery", "returned", "cancelled"
 */

export interface NormalizedRunCourierStatus {
  internalStatus: string;   // Maps to app's deliveryStatus
  courierStatus: string;    // Raw Run Courier status (preserved)
  courierStatusCode: string; // "RC_<status_slug>" for identification
  isReturnJourney: boolean;
  eventTimestamp: string | null;
}

/**
 * Default mapping from Run Courier raw status → internal deliveryStatus.
 * Keys are lowercase for case-insensitive matching.
 */
const RC_STATUS_MAP: Record<string, { internal: string; isReturn: boolean }> = {
  "new booked":                      { internal: "pending under ATC", isReturn: false },
  "pick up in progress":             { internal: "pending under ATC", isReturn: false },
  "picked up":                       { internal: "in transit",        isReturn: false },
  "parcel received at office":       { internal: "in transit",        isReturn: false },
  "parcel in transit to destination": { internal: "in transit",        isReturn: false },
  "parcel received at destination":  { internal: "in transit",        isReturn: false },
  "out for delivery":                { internal: "out for delivery",  isReturn: false },
  "delivered":                       { internal: "delivered",         isReturn: false },
  "re-attempt":                      { internal: "delivery attempt",  isReturn: false },
  "delivery unsuccessful":           { internal: "delivery attempt",  isReturn: false },
  "refused to accept":               { internal: "delivery attempt",  isReturn: false },
  "return confirmation":             { internal: "return initiated",  isReturn: true },
  "return received at origin":       { internal: "return in transit", isReturn: true },
  "parcel return to office":         { internal: "return in transit", isReturn: true },
  "return in process":               { internal: "return in transit", isReturn: true },
  "returned to origin city":         { internal: "return in transit", isReturn: true },
  "returned to shipper":             { internal: "returned",          isReturn: true },
  "shipper advice":                  { internal: "under review",      isReturn: false },
  "hold for self collection":        { internal: "under review",      isReturn: false },
  "claim":                           { internal: "under review",      isReturn: false },
  "lost":                            { internal: "under review",      isReturn: false },
  "cancelled":                       { internal: "cancelled",         isReturn: false },
};

/**
 * Generate a slug-style status code from raw status for logging.
 */
function statusSlug(raw: string): string {
  return "RC_" + raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Normalize a raw Run Courier status string into an internal deliveryStatus.
 *
 * Rules:
 * - If the status is in the mapping, use it.
 * - If unknown, preserve the raw status, log it, and map to "pending under ATC" (safest default).
 * - Never map an unknown status to "delivered" or "returned".
 */
export function normalizeRunCourierStatus(
  rawStatus: string,
  eventTimestamp?: string | null
): NormalizedRunCourierStatus {
  const trimmed = (rawStatus || "").trim();
  const lower = trimmed.toLowerCase();

  const mapped = RC_STATUS_MAP[lower];

  if (mapped) {
    return {
      internalStatus: mapped.internal,
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: mapped.isReturn,
      eventTimestamp: eventTimestamp || null,
    };
  }

  // Unknown status — heuristic fallback
  // Check for obvious return/delivery keywords
  if (lower.includes("return") || lower.includes("rts") || lower.includes("shipper")) {
    if (lower.includes("shipper") || lower.includes("returned to origin")) {
      return {
        internalStatus: "returned",
        courierStatus: trimmed,
        courierStatusCode: statusSlug(trimmed),
        isReturnJourney: true,
        eventTimestamp: eventTimestamp || null,
      };
    }
    if (lower.includes("confirm") || lower.includes("initiat")) {
      return {
        internalStatus: "return initiated",
        courierStatus: trimmed,
        courierStatusCode: statusSlug(trimmed),
        isReturnJourney: true,
        eventTimestamp: eventTimestamp || null,
      };
    }
    return {
      internalStatus: "return in transit",
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: true,
      eventTimestamp: eventTimestamp || null,
    };
  }

  if (lower.includes("delivered") || lower.includes("completed") || (lower.includes("deliver") && !lower.includes("un") && !lower.includes("out for"))) {
    return {
      internalStatus: "delivered",
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: false,
      eventTimestamp: eventTimestamp || null,
    };
  }

  if (lower.includes("out for delivery") || lower.includes("with rider") || lower.includes("assigned to courier") || lower.includes("on route")) {
    return {
      internalStatus: "out for delivery",
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: false,
      eventTimestamp: eventTimestamp || null,
    };
  }

  if (lower.includes("attempt") || lower.includes("unsuccessful") || lower.includes("refused") || lower.includes("failed")) {
    return {
      internalStatus: "delivery attempt",
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: false,
      eventTimestamp: eventTimestamp || null,
    };
  }

  if (lower.includes("transit") || lower.includes("dispatch") || lower.includes("picked") || lower.includes("hub") || lower.includes("warehouse") || lower.includes("office") || lower.includes("received at") || lower.includes("destination")) {
    return {
      internalStatus: "in transit",
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: false,
      eventTimestamp: eventTimestamp || null,
    };
  }

  if (lower.includes("review") || lower.includes("hold") || lower.includes("advice") || lower.includes("claim") || lower.includes("lost")) {
    return {
      internalStatus: "under review",
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: false,
      eventTimestamp: eventTimestamp || null,
    };
  }

  if (lower.includes("cancel")) {
    return {
      internalStatus: "cancelled",
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: false,
      eventTimestamp: eventTimestamp || null,
    };
  }

  if (lower.includes("booked") || lower.includes("progress") || lower.includes("pending") || lower.includes("created")) {
    return {
      internalStatus: "pending under ATC",
      courierStatus: trimmed,
      courierStatusCode: statusSlug(trimmed),
      isReturnJourney: false,
      eventTimestamp: eventTimestamp || null,
    };
  }

  // True unknown — safest default
  console.warn(
    `[Run Courier] Unknown status encountered: "${trimmed}". Mapping to "pending under ATC". Please update runcourier-status.ts.`
  );

  return {
    internalStatus: "pending under ATC",
    courierStatus: trimmed,
    courierStatusCode: statusSlug(trimmed),
    isReturnJourney: false,
    eventTimestamp: eventTimestamp || null,
  };
}
