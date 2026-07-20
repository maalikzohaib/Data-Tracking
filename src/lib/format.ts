export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "PKR";

export function fmtPKR(n: number): string {
  const rounded = Math.round(n);
  return `Rs ${rounded.toLocaleString("en-PK")}`;
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("en-PK");
}

export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `Rs ${(n / 1_000).toFixed(1)}k`;
  return `Rs ${Math.round(n)}`;
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
