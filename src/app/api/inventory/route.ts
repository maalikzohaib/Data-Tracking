import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { title: "asc" },
  });
  return NextResponse.json({ products });
}

const createSchema = z.object({
  title: z.string().min(1),
  sku: z.string().optional(),
  buyPrice: z.number().nonnegative().default(0),
  sellPrice: z.number().nonnegative().default(0),
  stock: z.number().int().default(0),
  lowStockAlert: z.number().int().default(5),
});

// Create a manual product (jo Shopify se sync nahi hua).
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const product = await prisma.product.create({ data: parsed.data });
  return NextResponse.json({ product });
}

const updateSchema = z.object({
  id: z.string(),
  buyPrice: z.number().nonnegative().optional(),
  sellPrice: z.number().nonnegative().optional(),
  stock: z.number().int().optional(),
  lowStockAlert: z.number().int().optional(),
});

// Update buy price / stock / alert (mainly buyPrice for COGS).
export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json({ product });
}
