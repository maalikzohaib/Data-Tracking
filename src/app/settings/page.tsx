"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Truck, Copy, Check, ShieldCheck, Key, Globe, Eye, EyeOff } from "lucide-react";
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

  // PostEx Configuration State
  const [postexToken, setPostexToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [postexBaseUrl, setPostexBaseUrl] = useState("https://api.postex.pk");
  const [postexWebhookUrl, setPostexWebhookUrl] = useState("");
  const [postexHeaderKey, setPostexHeaderKey] = useState("X-Postex-Auth");
  const [postexHeaderVal, setPostexHeaderVal] = useState("");
  const [showHeaderVal, setShowHeaderVal] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [cronEnabled, setCronEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState(60);
  const [statusMapping, setStatusMapping] = useState<Record<string, string>>({});
  const [hasApiToken, setHasApiToken] = useState(false);

  const [savingPostex, setSavingPostex] = useState(false);
  const [postexSaveResult, setPostexSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [postexSyncing, setPostexSyncing] = useState(false);
  const [postexSyncResult, setPostexSyncResult] = useState<any | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const loadLogs = () => apiGet<{ logs: Log[] }>("/api/synclog").then((d) => setLogs(d.logs || []));

  const loadPostexConfig = async () => {
    try {
      const res = await fetch("/api/postex/config");
      const j = await res.json();
      if (j.ok && j.config) {
        setPostexBaseUrl(j.config.baseUrl || "https://api.postex.pk");
        setPostexWebhookUrl(j.config.webhookUrl || "");
        setPostexHeaderKey(j.config.webhookHeaderKey || "X-Postex-Auth");
        setWebhookEnabled(j.config.webhookEnabled ?? true);
        setCronEnabled(j.config.cronEnabled ?? true);
        setSyncInterval(j.config.syncIntervalMinutes || 60);
        setStatusMapping(j.config.statusMapping || j.config.defaultStatusMapping || {});
        setHasApiToken(j.config.hasApiToken);
        if (j.config.apiTokenMasked) {
          setPostexToken(j.config.apiTokenMasked);
        }
        if (j.config.webhookHeaderValueMasked) {
          setPostexHeaderVal(j.config.webhookHeaderValueMasked);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadLogs();
    loadPostexConfig();
  }, []);

  async function savePostexSettings() {
    setSavingPostex(true);
    setPostexSaveResult(null);
    try {
      const res = await fetch("/api/postex/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiToken: postexToken,
          baseUrl: postexBaseUrl,
          webhookHeaderKey: postexHeaderKey,
          webhookHeaderValue: postexHeaderVal,
          webhookEnabled,
          cronEnabled,
          syncIntervalMinutes: syncInterval,
          statusMapping,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostexSaveResult({ ok: true, message: "✅ PostEx settings saved successfully." });
        await loadPostexConfig();
      } else {
        setPostexSaveResult({ ok: false, message: `❌ ${data.error || "Failed to save settings"}` });
      }
    } catch (e) {
      setPostexSaveResult({ ok: false, message: `❌ ${String(e)}` });
    }
    setSavingPostex(false);
  }

  async function runPostexManualSync() {
    setPostexSyncing(true);
    setPostexSyncResult(null);
    try {
      const res = await fetch("/api/postex/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll: true }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPostexSyncResult(data);
        loadLogs();
      } else {
        setPostexSyncResult({ error: data.error || "PostEx sync failed" });
      }
    } catch (e) {
      setPostexSyncResult({ error: String(e) });
    }
    setPostexSyncing(false);
  }

  function copyWebhookUrl() {
    if (!postexWebhookUrl) return;
    navigator.clipboard.writeText(postexWebhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  }

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
          }, meta days: ${data.result?.meta ?? "?"}, postex: ${JSON.stringify(data.result?.postex ?? "done")}`,
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
      <PageHeader title="Settings" subtitle="Shopify, Meta & PostEx Courier automated tracking control" />

      {/* PostEx Courier Integration Section */}
      <Card className="mb-6 border-aloe/40">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-shopify-lg bg-aloe text-black flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-heading-md text-text">PostEx Courier Integration</h2>
              <p className="text-micro text-muted">Automatic order tracking, webhooks & status reconciliation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runPostexManualSync}
              disabled={postexSyncing || !hasApiToken}
              className="btn-ghost text-xs flex items-center gap-1.5"
              title="Reconcile all active PostEx orders immediately"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${postexSyncing ? "animate-spin" : ""}`} />
              <span>{postexSyncing ? "Syncing PostEx…" : "Sync PostEx Now"}</span>
            </button>
            <button
              onClick={savePostexSettings}
              disabled={savingPostex}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{savingPostex ? "Saving…" : "Save PostEx Settings"}</span>
            </button>
          </div>
        </div>

        {postexSaveResult && (
          <div className={`p-3.5 rounded-shopify-md mb-5 text-xs flex items-center gap-2 ${postexSaveResult.ok ? "bg-aloe/20 text-black border border-aloe" : "bg-bad/15 text-bad border border-bad/30"}`}>
            {postexSaveResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span>{postexSaveResult.message}</span>
          </div>
        )}

        {postexSyncResult && (
          <div className="p-4 rounded-shopify-md bg-panel2 border border-border mb-5 text-xs">
            {postexSyncResult.error ? (
              <div className="text-bad flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Error: {postexSyncResult.error}</span>
              </div>
            ) : (
              <div>
                <div className="font-semibold text-text mb-1">PostEx Sync Complete</div>
                <div className="text-muted">
                  Checked: <strong className="text-text">{postexSyncResult.checked}</strong> · 
                  Updated: <strong className="text-good">{postexSyncResult.updated}</strong> · 
                  Unchanged: <strong className="text-text">{postexSyncResult.unchanged}</strong> · 
                  Failed: <strong className={postexSyncResult.failed > 0 ? "text-bad" : "text-text"}>{postexSyncResult.failed}</strong>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: API & Webhooks */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="label flex items-center justify-between">
                <span>PostEx Merchant API Token</span>
                <span className="text-micro text-muted font-normal">Stored securely server-side</span>
              </label>
              <div className="relative flex items-center">
                <input
                  className="input font-mono pr-9"
                  type={showToken ? "text" : "password"}
                  placeholder="Paste PostEx API Token (token header)"
                  value={postexToken}
                  onChange={(e) => setPostexToken(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 text-muted hover:text-text"
                  title="Show/Hide Token"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">PostEx Base URL</label>
              <input
                className="input font-mono"
                value={postexBaseUrl}
                onChange={(e) => setPostexBaseUrl(e.target.value)}
                placeholder="https://api.postex.pk"
              />
            </div>

            <div className="pt-2 border-t border-border">
              <label className="label flex items-center justify-between">
                <span>Webhook URL (Copy to PostEx Portal)</span>
                {copiedWebhook && <span className="text-good text-micro font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Copied!</span>}
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  className="input font-mono bg-panel2 select-all text-muted text-xs"
                  value={postexWebhookUrl}
                />
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="btn-ghost !px-3 shrink-0 flex items-center gap-1"
                  title="Copy Webhook URL"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Webhook Header Key</label>
                <input
                  className="input font-mono"
                  value={postexHeaderKey}
                  onChange={(e) => setPostexHeaderKey(e.target.value)}
                  placeholder="X-Postex-Auth"
                />
              </div>
              <div>
                <label className="label">Webhook Secret Value</label>
                <div className="relative flex items-center">
                  <input
                    className="input font-mono pr-9"
                    type={showHeaderVal ? "text" : "password"}
                    value={postexHeaderVal}
                    onChange={(e) => setPostexHeaderVal(e.target.value)}
                    placeholder="Optional secret verification"
                  />
                  <button
                    type="button"
                    onClick={() => setShowHeaderVal(!showHeaderVal)}
                    className="absolute right-2.5 text-muted hover:text-text"
                  >
                    {showHeaderVal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text">
                <input
                  type="checkbox"
                  checked={webhookEnabled}
                  onChange={(e) => setWebhookEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-text focus:ring-text accent-text"
                />
                <span>Enable Webhook Receiver</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text">
                <input
                  type="checkbox"
                  checked={cronEnabled}
                  onChange={(e) => setCronEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-text focus:ring-text accent-text"
                />
                <span>Enable Scheduled Sync</span>
              </label>
            </div>
          </div>

          {/* Right Column: Status Normalization Mapping */}
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="label mb-0">PostEx Status Mapping Rules</div>
                <div className="text-micro text-muted">Maps PostEx transaction codes to dashboard internal statuses</div>
              </div>
            </div>

            <div className="border border-border rounded-shopify-md overflow-hidden bg-panel2 max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-panel text-left text-eyebrow text-muted">
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">PostEx Meaning</th>
                    <th className="py-2 px-3">Internal Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { code: "0001", meaning: "At Merchant Warehouse", default: "Pending" },
                    { code: "0003", meaning: "At PostEx Warehouse", default: "In Transit" },
                    { code: "0004", meaning: "Package on Route", default: "Out for Delivery" },
                    { code: "0005", meaning: "Delivered", default: "Delivered" },
                    { code: "0008", meaning: "Delivery Under Review", default: "Under Review" },
                    { code: "0013", meaning: "Attempt Made / Failed", default: "Delivery Attempt" },
                    { code: "0002", meaning: "Returned to Origin", default: "Returned" },
                    { code: "0006", meaning: "Return in Transit", default: "Return in Transit" },
                    { code: "0014", meaning: "Return Initiated", default: "Return Initiated" },
                  ].map((row) => (
                    <tr key={row.code} className="hover:bg-panel/40">
                      <td className="py-1.5 px-3 font-mono font-medium">{row.code}</td>
                      <td className="py-1.5 px-3 text-muted">{row.meaning}</td>
                      <td className="py-1.5 px-3">
                        <input
                          className="bg-panel border border-border rounded px-2 py-0.5 text-xs text-text w-full focus:outline-none focus:border-text"
                          value={statusMapping[row.code] ?? row.default}
                          onChange={(e) =>
                            setStatusMapping({
                              ...statusMapping,
                              [row.code]: e.target.value,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded bg-panel2 border border-border text-micro text-muted leading-relaxed">
              💡 <strong>Smart Return Journey:</strong> The normalizer automatically inspects tracking history so return stages (Initiated → In Transit → Out for Delivery → Returned) are classified accurately without getting stuck.
            </div>
          </div>
        </div>
      </Card>

      {/* General System Sync & Credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Manual Master Sync">
          <p className="text-caption text-muted mb-5">
            Shopify orders + products, Meta ads aur PostEx active tracking ko abhi sync karo.
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
            <span>{syncing ? "Syncing… (thoda time lagega)" : "Sync All Services"}</span>
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
              <span>META_ACCESS_TOKEN + META_AD_ACCOUNT_ID</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span>POSTEX_API_TOKEN (Configured in PostEx settings above)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span>
                PostEx Webhook URL:{" "}
                <code className="text-text bg-panel2 px-1.5 py-0.5 rounded-shopify-xs text-micro">/api/webhooks/postex</code>
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
                    <td className="py-3 px-2 font-medium capitalize">{l.source}</td>
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
