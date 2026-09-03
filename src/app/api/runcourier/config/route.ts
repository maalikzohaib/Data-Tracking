import { NextResponse } from "next/server";
import { fetchStatusList, fetchThirdPartyGateways, getRunCourierConfig } from "@/lib/runcourier";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function maskToken(token: string | null): string {
  if (!token) return "";
  if (token.length <= 8) return "********";
  return token.slice(0, 4) + "*".repeat(token.length - 8) + token.slice(-4);
}

/**
 * GET /api/runcourier/config
 * Returns current configuration status (never leaking raw secrets)
 */
export async function GET() {
  try {
    const config = await getRunCourierConfig();
    const hasAuthKey = Boolean(config.authKey && config.authKey.trim().length > 0);

    return NextResponse.json({
      ok: true,
      config: {
        hasAuthKey,
        authKeyMasked: maskToken(config.authKey || null),
        endpoints: {
          currentStatus: "https://portal.runcourier.com/API/CurrentStatus.php",
          trackOrder: "https://portal.runcourier.com/API/TrackOrder.php",
          getOrderList: "https://portal.runcourier.com/API/GetOrderList.php",
          statusList: "https://portal.runcourier.com/API/StatusList.php",
          thirdPartyGateways: "https://portal.runcourier.com/API/getThirdpartyApiAndGateways.php",
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}

/**
 * POST /api/runcourier/config
 * - If body contains authKey: saves the auth key securely to the database
 * - Otherwise: tests connectivity to Run Courier API endpoints
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { authKey, test } = body;

    // Save authKey to DB if provided
    if (authKey !== undefined && typeof authKey === "string" && !authKey.includes("***")) {
      const cleanKey = authKey.trim();
      await prisma.runCourierConfig.upsert({
        where: { id: "default" },
        create: { id: "default", authKey: cleanKey },
        update: { authKey: cleanKey },
      });

      return NextResponse.json({
        ok: true,
        message: "Run Courier authentication key saved successfully.",
        hasAuthKey: cleanKey.length > 0,
      });
    }

    // Otherwise test connection
    const statuses = await fetchStatusList();
    const gateways = await fetchThirdPartyGateways();

    return NextResponse.json({
      ok: true,
      message: "Run Courier API connectivity verified successfully.",
      statusCount: statuses.length,
      gatewayCount: gateways.length,
      gateways: gateways.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
