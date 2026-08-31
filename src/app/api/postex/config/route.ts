import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPostexConfig } from "@/lib/postex";
import { DEFAULT_POSTEX_CODE_MAP } from "@/lib/postex-status";

export const dynamic = "force-dynamic";

/**
 * Mask secret token for frontend display (e.g. pk_******3829)
 */
function maskToken(token: string | null): string {
  if (!token) return "";
  if (token.length <= 8) return "********";
  return token.slice(0, 4) + "*".repeat(token.length - 8) + token.slice(-4);
}

/**
 * GET /api/postex/config
 */
export async function GET(req: Request) {
  try {
    const config = await getPostexConfig();
    const origin = req.headers.get("origin") || req.headers.get("host") || "http://localhost:3000";
    const protocol = origin.startsWith("http") ? "" : "https://";
    const webhookUrl = `${protocol}${origin}/api/webhooks/postex`;

    return NextResponse.json({
      ok: true,
      config: {
        apiTokenMasked: maskToken(config.apiToken),
        hasApiToken: !!config.apiToken,
        baseUrl: config.baseUrl,
        webhookUrl,
        webhookHeaderKey: config.webhookHeaderKey,
        webhookHeaderValueMasked: maskToken(config.webhookHeaderValue),
        hasWebhookHeaderValue: !!config.webhookHeaderValue,
        webhookEnabled: config.webhookEnabled,
        cronEnabled: config.cronEnabled,
        syncIntervalMinutes: config.syncIntervalMinutes,
        statusMapping: config.statusMapping || DEFAULT_POSTEX_CODE_MAP,
        defaultStatusMapping: DEFAULT_POSTEX_CODE_MAP,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}

/**
 * POST /api/postex/config
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      apiToken,
      baseUrl,
      webhookHeaderKey,
      webhookHeaderValue,
      webhookEnabled,
      cronEnabled,
      syncIntervalMinutes,
      statusMapping,
    } = body;

    const existing = await prisma.postexConfig.findUnique({
      where: { id: "default" },
    });

    const updateData: any = {};

    // Only update token if a new non-masked value is provided
    if (apiToken !== undefined && !apiToken.includes("***")) {
      updateData.apiToken = apiToken ? apiToken.trim() : null;
    }

    if (baseUrl !== undefined) {
      updateData.baseUrl = baseUrl.trim() || "https://api.postex.pk";
    }

    if (webhookHeaderKey !== undefined) {
      updateData.webhookHeaderKey = webhookHeaderKey.trim() || "X-Postex-Auth";
    }

    if (webhookHeaderValue !== undefined && !webhookHeaderValue.includes("***")) {
      updateData.webhookHeaderValue = webhookHeaderValue ? webhookHeaderValue.trim() : null;
    }

    if (webhookEnabled !== undefined) {
      updateData.webhookEnabled = Boolean(webhookEnabled);
    }

    if (cronEnabled !== undefined) {
      updateData.cronEnabled = Boolean(cronEnabled);
    }

    if (syncIntervalMinutes !== undefined) {
      updateData.syncIntervalMinutes = parseInt(String(syncIntervalMinutes), 10) || 60;
    }

    if (statusMapping !== undefined) {
      updateData.statusMapping = statusMapping;
    }

    const saved = await prisma.postexConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      ok: true,
      message: "PostEx configuration saved successfully.",
      config: {
        hasApiToken: !!saved.apiToken,
        baseUrl: saved.baseUrl,
        webhookHeaderKey: saved.webhookHeaderKey,
        webhookEnabled: saved.webhookEnabled,
        cronEnabled: saved.cronEnabled,
        syncIntervalMinutes: saved.syncIntervalMinutes,
        statusMapping: saved.statusMapping || DEFAULT_POSTEX_CODE_MAP,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
