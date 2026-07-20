import { prisma } from "./prisma";

export type Range = "7d" | "30d" | "90d" | "all";

export function rangeToDate(range: Range): Date | undefined {
  const now = Date.now();
  switch (range) {
    case "7d":
      return new Date(now - 7 * 864e5);
    case "30d":
      return new Date(now - 30 * 864e5);
    case "90d":
      return new Date(now - 90 * 864e5);
    case "all":
      return undefined;
  }
}

export type Overview = {
  revenue: number;
  orders: number;
  aov: number;
  cogs: number;
  adSpend: number;
  codCharges: number;
  shipping: number;
  otherExpenses: number;
  grossProfit: number;
  netProfit: number;
  roas: number;
  cashIn: number;
  cashOut: number;
  cashBalance: number;
  inventoryValue: number;
  lowStockCount: number;
  pendingCod: number;
};

export async function getOverview(range: Range): Promise<Overview> {
  const since = rangeToDate(range);
  const dateFilter = since ? { gte: since } : undefined;

  const [orders, adAgg, codAgg, expenses, products, cashIn, cashOut] =
    await Promise.all([
      prisma.order.findMany({
        where: {
          cancelled: false,
          ...(dateFilter ? { shopifyCreatedAt: dateFilter } : {}),
        },
        select: { totalPrice: true, cogs: true, totalShipping: true },
      }),
      prisma.metaAdDaily.aggregate({
        _sum: { spend: true, revenue: true },
        where: dateFilter ? { date: dateFilter } : {},
      }),
      prisma.codCharge.aggregate({
        _sum: { amount: true },
        where: dateFilter ? { chargedAt: dateFilter } : {},
      }),
      prisma.expense.findMany({
        where: dateFilter ? { spentAt: dateFilter } : {},
        select: { amount: true, category: true },
      }),
      prisma.product.findMany({
        select: { stock: true, buyPrice: true, lowStockAlert: true },
      }),
      prisma.cashFlow.aggregate({
        _sum: { amount: true },
        where: { type: "in", ...(dateFilter ? { happenedAt: dateFilter } : {}) },
      }),
      prisma.cashFlow.aggregate({
        _sum: { amount: true },
        where: { type: "out", ...(dateFilter ? { happenedAt: dateFilter } : {}) },
      }),
    ]);

  const revenue = sum(orders.map((o) => o.totalPrice));
  const cogs = sum(orders.map((o) => o.cogs));
  const shipping = sum(orders.map((o) => o.totalShipping));
  const orderCount = orders.length;
  const adSpend = adAgg._sum.spend ?? 0;
  const codCharges = codAgg._sum.amount ?? 0;
  const otherExpenses = sum(
    expenses.filter((e) => e.category !== "Ads").map((e) => e.amount)
  );

  const grossProfit = revenue - cogs;
  const netProfit =
    revenue - cogs - adSpend - codCharges - otherExpenses;

  const inventoryValue = sum(products.map((p) => p.stock * p.buyPrice));
  const lowStockCount = products.filter(
    (p) => p.stock <= p.lowStockAlert
  ).length;

  const pendingCodAgg = await prisma.codCharge.aggregate({
    _sum: { codCollected: true },
    where: { status: "pending" },
  });

  return {
    revenue,
    orders: orderCount,
    aov: orderCount ? revenue / orderCount : 0,
    cogs,
    adSpend,
    codCharges,
    shipping,
    otherExpenses,
    grossProfit,
    netProfit,
    roas: adSpend ? revenue / adSpend : 0,
    cashIn: cashIn._sum.amount ?? 0,
    cashOut: cashOut._sum.amount ?? 0,
    cashBalance: (cashIn._sum.amount ?? 0) - (cashOut._sum.amount ?? 0),
    inventoryValue,
    lowStockCount,
    pendingCod: pendingCodAgg._sum.codCollected ?? 0,
  };
}

// Daily time series for charts (revenue, ad spend, profit) over a range.
export async function getDailySeries(range: Range) {
  const since = rangeToDate(range) ?? new Date(Date.now() - 30 * 864e5);

  const [orders, ads] = await Promise.all([
    prisma.order.findMany({
      where: { cancelled: false, shopifyCreatedAt: { gte: since } },
      select: { totalPrice: true, cogs: true, shopifyCreatedAt: true },
    }),
    prisma.metaAdDaily.findMany({
      where: { date: { gte: since } },
      select: { date: true, spend: true, revenue: true },
    }),
  ]);

  const map = new Map<
    string,
    { date: string; revenue: number; cogs: number; adSpend: number }
  >();

  const ensure = (key: string) => {
    if (!map.has(key))
      map.set(key, { date: key, revenue: 0, cogs: 0, adSpend: 0 });
    return map.get(key)!;
  };

  for (const o of orders) {
    const key = o.shopifyCreatedAt.toISOString().slice(0, 10);
    const row = ensure(key);
    row.revenue += o.totalPrice;
    row.cogs += o.cogs;
  }
  for (const a of ads) {
    const key = a.date.toISOString().slice(0, 10);
    const row = ensure(key);
    row.adSpend += a.spend;
  }

  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      revenue: Math.round(r.revenue),
      adSpend: Math.round(r.adSpend),
      profit: Math.round(r.revenue - r.cogs - r.adSpend),
    }));
}

// Expense breakdown by category (for pie chart).
export async function getExpenseBreakdown(range: Range) {
  const since = rangeToDate(range);
  const dateFilter = since ? { gte: since } : undefined;

  const [expenses, adAgg, codAgg, orders] = await Promise.all([
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      where: dateFilter ? { spentAt: dateFilter } : {},
    }),
    prisma.metaAdDaily.aggregate({
      _sum: { spend: true },
      where: dateFilter ? { date: dateFilter } : {},
    }),
    prisma.codCharge.aggregate({
      _sum: { amount: true },
      where: dateFilter ? { chargedAt: dateFilter } : {},
    }),
    prisma.order.aggregate({
      _sum: { cogs: true },
      where: {
        cancelled: false,
        ...(dateFilter ? { shopifyCreatedAt: dateFilter } : {}),
      },
    }),
  ]);

  const result: { name: string; value: number }[] = [];
  const push = (name: string, value: number) => {
    if (value > 0) result.push({ name, value: Math.round(value) });
  };

  push("COGS (Inventory)", orders._sum.cogs ?? 0);
  push("Meta Ads", adAgg._sum.spend ?? 0);
  push("COD Charges", codAgg._sum.amount ?? 0);
  for (const e of expenses) {
    if (e.category !== "Ads") push(e.category, e._sum.amount ?? 0);
  }

  return result;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
