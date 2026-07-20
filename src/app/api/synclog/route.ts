import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs = await prisma.syncLog.findMany({
    orderBy: { ranAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ logs });
}
