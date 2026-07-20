import { getMetaConfig } from "./env";

const API_VERSION = "v21.0";

type MetaInsight = {
  date_start: string;
  date_stop: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
};

export type MetaDaily = {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  purchases: number;
  revenue: number;
};

// Fetch daily ad insights for a date range (default: last 30 days).
export async function fetchMetaInsights(
  sinceISO?: string
): Promise<MetaDaily[]> {
  const { token, accountId } = getMetaConfig();

  const since =
    sinceISO ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);

  const fields = "spend,impressions,clicks,reach,actions,action_values";
  const timeRange = encodeURIComponent(
    JSON.stringify({ since, until })
  );

  const url =
    `https://graph.facebook.com/${API_VERSION}/${accountId}/insights` +
    `?fields=${fields}` +
    `&time_increment=1` +
    `&time_range=${timeRange}` +
    `&level=account` +
    `&limit=500` +
    `&access_token=${token}`;

  const results: MetaDaily[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta insights fetch failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as {
      data: MetaInsight[];
      paging?: { next?: string };
    };

    for (const row of data.data) {
      const purchases = extractAction(row.actions, [
        "purchase",
        "omni_purchase",
        "offsite_conversion.fb_pixel_purchase",
      ]);
      const revenue = extractAction(row.action_values, [
        "purchase",
        "omni_purchase",
        "offsite_conversion.fb_pixel_purchase",
      ]);
      results.push({
        date: row.date_start,
        spend: num(row.spend),
        impressions: int(row.impressions),
        clicks: int(row.clicks),
        reach: int(row.reach),
        purchases: Math.round(purchases),
        revenue,
      });
    }

    nextUrl = data.paging?.next ?? null;
  }

  return results;
}

function num(v?: string): number {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? 0 : n;
}
function int(v?: string): number {
  const n = parseInt(v ?? "0", 10);
  return isNaN(n) ? 0 : n;
}
function extractAction(
  actions: { action_type: string; value: string }[] | undefined,
  types: string[]
): number {
  if (!actions) return 0;
  for (const t of types) {
    const found = actions.find((a) => a.action_type === t);
    if (found) return num(found.value);
  }
  return 0;
}
