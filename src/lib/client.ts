"use client";

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text().catch(() => "");
  if (!text || text.trim() === "") {
    return {} as T;
  }
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    return {} as T;
  }
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text().catch(() => "");
  if (!text || text.trim() === "") {
    return {} as T;
  }
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    return {} as T;
  }
}
