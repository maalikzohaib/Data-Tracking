"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { apiGet } from "@/lib/client";
import { fmtDate } from "@/lib/format";

type Log = {
  id: string;
  source: string;
  status: string;
  message: string | null;
  count: number;
  ranAt: string;
};

export default function SettingsPage() {
  const [secret, setSecret] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadLogs = () => apiGet<{ logs: Log[] }>("/api/synclog").then((d) => setLogs(d.logs || []));

  useEffect(() => {
    loadLogs();
  }, []);

  async function runSync() {
    if (!secret) {
      setResult({ ok: false, message: "Pehle CRON_SECRET daalo." });
      return;
    }
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cron/sync?secret=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (res.ok) {
        setResult({
          ok: true,
          message: `Sync complete — orders: ${data.result?.orders ?? "?"}, products: ${
            data.result?.products ?? "?"
          }, meta days: ${data.result?.meta ?? "?"}`,
        });
      } else {
        setResult({ ok: false, message: data.error || "Sync failed" });
      }
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    }
    setSyncing(false);
    loadLogs();
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Sync control aur system status" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Manual Sync">
          <p className="text-caption text-muted mb-5">
            Shopify orders + products aur Meta ads ko abhi sync karo. Auto-sync har ghante
            chalta hai (Vercel cron), lekin yahan se turant trigger kar sakte ho.
          </p>
          <label className="label">CRON_SECRET</label>
          <input
            className="input mb-3"
            type="password"
            placeholder="Apna CRON_SECRET daalo"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={runSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing… (thoda time lagega)" : "Sync Now"}</span>
          </button>
          {result && (
            <div className={`mt-4 text-caption p-4 rounded-shopify-md bg-panel2 border border-border flex items-center gap-2 ${result.ok ? "text-good" : "text-bad"}`}>
              {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}
        </Card>

        <Card title="Setup Checklist">
          <ul className="text-caption space-y-2.5 text-muted">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span><span className="text-text">.env</span> mein DATABASE_URL (Neon Postgres)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span>SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span>META_ACCESS_TOKEN + META_AD_ACCOUNT_ID (act_ prefix ke saath)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span>CRON_SECRET (koi lamba random string)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span>Deploy ke baad <span className="text-text">npm run db:push</span></span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span>
                Shopify webhook (real-time orders):{" "}
                <code className="text-text bg-panel2 px-1.5 py-0.5 rounded-shopify-xs text-micro">/api/webhooks/shopify</code>
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <Card title="Sync Logs" className="mt-5">
        {logs.length === 0 ? (
          <EmptyState text="Abhi tak koi sync nahi hua." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-eyebrow text-muted uppercase border-b border-border">
                  <th className="py-3 px-2">Source</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Count</th>
                  <th className="py-3 px-2">Message</th>
                  <th className="py-3 px-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border">
                    <td className="py-3 px-2 font-medium">{l.source}</td>
                    <td className="py-3 px-2">
                      <span className={`pill ${l.status === "success" ? "bg-aloe text-black" : "bg-bad/15 text-bad"}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">{l.count}</td>
                    <td className="py-3 px-2 text-muted max-w-xs truncate">{l.message || "—"}</td>
                    <td className="py-3 px-2 text-right text-muted">{fmtDate(l.ranAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
