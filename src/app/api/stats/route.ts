import { NextResponse } from "next/server";
import {
  getOverview,
  getDailySeries,
  getExpenseBreakdown,
  type Range,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "30d") as Range;

  try {
    const [overview, series, breakdown] = await Promise.all([
      getOverview(range),
      getDailySeries(range),
      getExpenseBreakdown(range),
    ]);
    return NextResponse.json({ overview, series, breakdown, range });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), hint: "Kya DATABASE_URL set hai? npm run db:push chalaya?" },
      { status: 500 }
    );
  }
}
