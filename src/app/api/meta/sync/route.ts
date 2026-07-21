import { NextResponse } from "next/server";
import { syncMeta } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Meta ads ko manually refresh karo (button se). Sirf Meta, Shopify nahi.
export async function POST() {
  try {
    const count = await syncMeta();
    return NextResponse.json({ ok: true, days: count });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
