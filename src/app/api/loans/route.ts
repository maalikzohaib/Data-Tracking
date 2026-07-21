import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Loan ke cash flows sync karo: principal = cash-in, repaid = cash-out.
async function syncLoanCash(loan: {
  id: string;
  lender: string;
  principal: number;
  repaid: number;
  borrowedAt: Date;
}) {
  // Principal cash-in (dedup by refId + source "Loan").
  const inExisting = await prisma.cashFlow.findFirst({
    where: { refId: loan.id, source: "Loan" },
  });
  if (loan.principal > 0) {
    if (inExisting) {
      await prisma.cashFlow.update({
        where: { id: inExisting.id },
        data: { amount: loan.principal, note: `Loan — ${loan.lender}` },
      });
    } else {
      await prisma.cashFlow.create({
        data: {
          type: "in",
          source: "Loan",
          amount: loan.principal,
          note: `Loan — ${loan.lender}`,
          refId: loan.id,
          happenedAt: loan.borrowedAt,
        },
      });
    }
  } else if (inExisting) {
    await prisma.cashFlow.delete({ where: { id: inExisting.id } });
  }

  // Repayment cash-out (dedup by refId + source "Loan Repayment").
  const outExisting = await prisma.cashFlow.findFirst({
    where: { refId: loan.id, source: "Loan Repayment" },
  });
  if (loan.repaid > 0) {
    if (outExisting) {
      await prisma.cashFlow.update({
        where: { id: outExisting.id },
        data: { amount: loan.repaid, note: `Loan repayment — ${loan.lender}` },
      });
    } else {
      await prisma.cashFlow.create({
        data: {
          type: "out",
          source: "Loan Repayment",
          amount: loan.repaid,
          note: `Loan repayment — ${loan.lender}`,
          refId: loan.id,
          happenedAt: new Date(),
        },
      });
    }
  } else if (outExisting) {
    await prisma.cashFlow.delete({ where: { id: outExisting.id } });
  }
}

export async function GET() {
  const loans = await prisma.loan.findMany({ orderBy: { borrowedAt: "desc" } });
  const totalBorrowed = loans.reduce((s, l) => s + l.principal, 0);
  const totalRepaid = loans.reduce((s, l) => s + l.repaid, 0);
  return NextResponse.json({
    loans,
    summary: {
      totalBorrowed,
      totalRepaid,
      outstanding: Math.max(totalBorrowed - totalRepaid, 0),
    },
  });
}

const createSchema = z.object({
  lender: z.string().min(1),
  principal: z.number().nonnegative(),
  repaid: z.number().nonnegative().optional(),
  note: z.string().optional(),
  borrowedAt: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const loan = await prisma.loan.create({
    data: {
      lender: d.lender,
      principal: d.principal,
      repaid: d.repaid ?? 0,
      note: d.note,
      borrowedAt: d.borrowedAt ? new Date(d.borrowedAt) : undefined,
    },
  });
  await syncLoanCash(loan);
  return NextResponse.json({ loan });
}

const patchSchema = z.object({
  id: z.string().min(1),
  repaid: z.number().nonnegative().optional(),
  principal: z.number().nonnegative().optional(),
  lender: z.string().optional(),
});

// Repayment update (kitna wapas kiya), ya principal/lender edit.
export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id, repaid, principal, lender } = parsed.data;
  const loan = await prisma.loan.update({
    where: { id },
    data: {
      ...(repaid !== undefined ? { repaid } : {}),
      ...(principal !== undefined ? { principal } : {}),
      ...(lender !== undefined ? { lender } : {}),
    },
  });
  await syncLoanCash(loan);
  return NextResponse.json({ loan });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.cashFlow.deleteMany({ where: { refId: id, source: { in: ["Loan", "Loan Repayment"] } } });
  await prisma.loan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
