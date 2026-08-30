import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
  const orders = await prisma.order.findMany({
    orderBy: { shopifyCreatedAt: "desc" },
    take: limit,
    include: { lineItems: true },
  });
  return NextResponse.json({ orders });
}

// ------------------------------------------------------------
//  Manual order create
// ------------------------------------------------------------
const createSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerCity: z.string().optional(),
  itemName: z.string().optional(),
  totalPrice: z.number().nonnegative(), // sell price
  cogs: z.number().nonnegative().optional(), // cost
  stage: z.enum(["processing", "shipped", "completed", "cancelled"]).default("processing"),
  confirmationStatus: z.string().optional(),
  shippingAdvance: z.number().nonnegative().optional(),
  courier: z.string().optional(),
  paymentMethod: z.string().optional(),
  itemCount: z.number().int().positive().optional(),
  isPacked: z.boolean().optional(),
  isCourierHanded: z.boolean().optional(),
  remarks: z.string().optional(),
  specialDetails: z.string().optional(),
  deliveryStatus: z.string().optional(),
  labelColor: z.string().optional(),
  note: z.string().optional(),
  happenedAt: z.string().optional(),
});

// Stage se financial status derive karo.
function stageToFinancial(stage: string): { financialStatus: string; cancelled: boolean } {
  if (stage === "completed") return { financialStatus: "paid", cancelled: false };
  if (stage === "cancelled") return { financialStatus: "cancelled", cancelled: true };
  return { financialStatus: "pending", cancelled: false };
}

// Order ke cash flows (Sales in + Shipping out) ko current stage ke hisaab se sync karo.
async function syncOrderCash(order: {
  id: string;
  orderNumber: string | null;
  totalPrice: number;
  shippingAdvance: number;
  stage: string | null;
  happenedAt: Date;
}) {
  const label = order.orderNumber ?? order.id;

  // Sales cash-in: sirf completed order pe.
  const saleExisting = await prisma.cashFlow.findFirst({
    where: { refId: order.id, source: "Sales" },
  });
  if (order.stage === "completed" && order.totalPrice > 0) {
    if (saleExisting) {
      await prisma.cashFlow.update({
        where: { id: saleExisting.id },
        data: { amount: order.totalPrice, happenedAt: order.happenedAt },
      });
    } else {
      await prisma.cashFlow.create({
        data: {
          type: "in",
          source: "Sales",
          amount: order.totalPrice,
          note: `Order ${label}`,
          refId: order.id,
          happenedAt: order.happenedAt,
        },
      });
    }
  } else if (saleExisting) {
    // processing/cancelled hua to sale cash-in hata do.
    await prisma.cashFlow.delete({ where: { id: saleExisting.id } });
  }

  // Shipping advance cash-out (jab bhi > 0).
  const shipExisting = await prisma.cashFlow.findFirst({
    where: { refId: order.id, source: "Shipping" },
  });
  if (order.shippingAdvance > 0) {
    if (shipExisting) {
      await prisma.cashFlow.update({
        where: { id: shipExisting.id },
        data: { amount: order.shippingAdvance },
      });
    } else {
      await prisma.cashFlow.create({
        data: {
          type: "out",
          source: "Shipping",
          amount: order.shippingAdvance,
          note: `Shipping advance — ${label}`,
          refId: order.id,
          happenedAt: order.happenedAt,
        },
      });
    }
  } else if (shipExisting) {
    await prisma.cashFlow.delete({ where: { id: shipExisting.id } });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const when = d.happenedAt ? new Date(d.happenedAt) : new Date();
  const { financialStatus, cancelled } = stageToFinancial(d.stage);

  // Manual order number: MAN-<count+1>
  const manualCount = await prisma.order.count({ where: { source: "manual" } });
  const orderNumber = `MAN-${String(manualCount + 1).padStart(4, "0")}`;

  const order = await prisma.order.create({
    data: {
      source: "manual",
      orderNumber,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      customerCity: d.customerCity,
      itemName: d.itemName,
      totalPrice: d.totalPrice,
      subtotalPrice: d.totalPrice,
      cogs: d.cogs ?? 0,
      stage: d.stage,
      financialStatus,
      fulfillmentStatus: d.stage === "completed" ? "fulfilled" : "unfulfilled",
      confirmationStatus: d.confirmationStatus ?? "pending",
      paymentMethod: d.paymentMethod ?? "COD",
      itemCount: d.itemCount ?? 1,
      shippingAdvance: d.shippingAdvance ?? 0,
      courier: d.courier,
      isPacked: d.isPacked ?? false,
      isCourierHanded: d.isCourierHanded ?? false,
      remarks: d.remarks,
      specialDetails: d.specialDetails,
      deliveryStatus: d.deliveryStatus ?? "pending under ATC",
      cancelled,
      shopifyCreatedAt: when,
    },
  });

  await syncOrderCash({
    id: order.id,
    orderNumber: order.orderNumber,
    totalPrice: order.totalPrice,
    shippingAdvance: order.shippingAdvance,
    stage: order.stage,
    happenedAt: when,
  });

  return NextResponse.json({ order });
}

// ------------------------------------------------------------
//  Update order (stage / shipping advance / courier / prices / status)
// ------------------------------------------------------------
const patchSchema = z.object({
  id: z.string().min(1),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerCity: z.string().optional(),
  itemName: z.string().optional(),
  stage: z.enum(["processing", "shipped", "completed", "cancelled"]).optional(),
  confirmationStatus: z.string().optional(),
  financialStatus: z.string().optional(),
  paymentMethod: z.string().optional(),
  shippingAdvance: z.number().nonnegative().optional(),
  courier: z.string().optional(),
  totalPrice: z.number().nonnegative().optional(),
  cogs: z.number().nonnegative().optional(),
  trackingId: z.string().optional(),
  trackingUrl: z.string().optional(),
  slipPrinted: z.boolean().optional(),
  isPacked: z.boolean().optional(),
  isCourierHanded: z.boolean().optional(),
  remarks: z.string().optional(),
  specialDetails: z.string().optional(),
  deliveryStatus: z.string().optional(),
  labelColor: z.string().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const {
    id,
    customerName,
    customerPhone,
    customerCity,
    itemName,
    stage,
    confirmationStatus,
    financialStatus,
    paymentMethod,
    shippingAdvance,
    courier,
    totalPrice,
    cogs,
    trackingId,
    trackingUrl,
    slipPrinted,
    isPacked,
    isCourierHanded,
    remarks,
    specialDetails,
    deliveryStatus,
    labelColor,
    archived,
  } = parsed.data;

  const stageData = stage
    ? {
        stage,
        ...stageToFinancial(stage),
        fulfillmentStatus: stage === "completed" ? "fulfilled" : "unfulfilled",
      }
    : {};

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...stageData,
      ...(customerName !== undefined ? { customerName } : {}),
      ...(customerPhone !== undefined ? { customerPhone } : {}),
      ...(customerCity !== undefined ? { customerCity } : {}),
      ...(itemName !== undefined ? { itemName } : {}),
      ...(confirmationStatus !== undefined ? { confirmationStatus } : {}),
      ...(financialStatus !== undefined ? { financialStatus } : {}),
      ...(paymentMethod !== undefined ? { paymentMethod } : {}),
      ...(shippingAdvance !== undefined ? { shippingAdvance } : {}),
      ...(courier !== undefined ? { courier } : {}),
      ...(totalPrice !== undefined ? { totalPrice } : {}),
      ...(cogs !== undefined ? { cogs } : {}),
      ...(trackingId !== undefined ? { trackingId } : {}),
      ...(trackingUrl !== undefined ? { trackingUrl } : {}),
      ...(slipPrinted !== undefined ? { slipPrinted } : {}),
      ...(isPacked !== undefined ? { isPacked } : {}),
      ...(isCourierHanded !== undefined ? { isCourierHanded } : {}),
      ...(remarks !== undefined ? { remarks } : {}),
      ...(specialDetails !== undefined ? { specialDetails } : {}),
      ...(deliveryStatus !== undefined ? { deliveryStatus } : {}),
      ...(labelColor !== undefined ? { labelColor } : {}),
      ...(archived !== undefined ? { archived } : {}),
    },
  });

  await syncOrderCash({
    id: order.id,
    orderNumber: order.orderNumber,
    totalPrice: order.totalPrice,
    shippingAdvance: order.shippingAdvance,
    stage: order.stage,
    happenedAt: order.shopifyCreatedAt,
  });

  return NextResponse.json({ order });
}

// ------------------------------------------------------------
//  Delete (manual orders only) — cash flows bhi hata do
// ------------------------------------------------------------
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (order.source !== "manual") {
    return NextResponse.json(
      { error: "Sirf manual orders delete ho sakte hain" },
      { status: 400 }
    );
  }

  await prisma.cashFlow.deleteMany({ where: { refId: id } });
  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
