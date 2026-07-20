"use client";

import { useEffect, useState } from "react";
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
  const [result, setResult] = useState<string | null>(null);

  const loadLogs = () => apiGet<{ logs: Log[] }>("/api/synclog").then((d) => setLogs(d.logs || []));

  useEffect(() => {
    loadLogs();
  }, []);

  async function runSync() {
    if (!secret) {
      setResult("Pehle CRON_SECRET daalo.");
      return;
    }
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cron/sync?secret=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (res.ok) {
        setResult(
          `✅ Sync complete — orders: ${data.result?.orders ?? "?"}, products: ${
            data.result?.products ?? "?"
          }, meta days: ${data.result?.meta ?? "?"}`
        );
      } else {
        setResult(`❌ ${data.error || "Sync failed"}`);
      }
    } catch (e) {
      setResult(`❌ ${String(e)}`);
    }
    setSyncing(false);
    loadLogs();
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Sync control aur system status" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Manual Sync">
          <p className="text-sm text-muted mb-4">
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
          <button className="btn-primary w-full" onClick={runSync} disabled={syncing}>
            {syncing ? "Syncing… (thoda time lagega)" : "🔄 Sync Now"}
          </button>
          {result && (
            <div className="mt-3 text-sm p-3 rounded-xl bg-panel2 border border-border">
              {result}
            </div>
          )}
        </Card>

        <Card title="Setup Checklist">
          <ul className="text-sm space-y-2 text-muted">
            <li>✅ <span className="text-text">.env</span> mein DATABASE_URL (Neon Postgres)</li>
            <li>✅ SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN</li>
            <li>✅ META_ACCESS_TOKEN + META_AD_ACCOUNT_ID (act_ prefix ke saath)</li>
            <li>✅ CRON_SECRET (koi lamba random string)</li>
            <li>✅ Deploy ke baad <span className="text-text">npm run db:push</span></li>
            <li>
              ✅ Shopify webhook (real-time orders):{" "}
              <code className="text-accent">/api/webhooks/shopify</code>
            </li>
          </ul>
        </Card>
      </div>

      <Card title="Sync Logs" className="mt-4">
        {logs.length === 0 ? (
          <EmptyState text="Abhi tak koi sync nahi hua." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-3 px-2">Source</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Count</th>
                  <th className="py-3 px-2">Message</th>
                  <th className="py-3 px-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="py-3 px-2 font-medium">{l.source}</td>
                    <td className="py-3 px-2">
                      <span className={`pill ${l.status === "success" ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}>
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
