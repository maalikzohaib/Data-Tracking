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

  // Run Courier Configuration State
  const [hasRcAuthKey, setHasRcAuthKey] = useState(false);
  const [rcAuthKeyMasked, setRcAuthKeyMasked] = useState("");
  const [rcAuthKeyInput, setRcAuthKeyInput] = useState("");
  const [showRcKey, setShowRcKey] = useState(false);
  const [savingRc, setSavingRc] = useState(false);
  const [rcSaveResult, setRcSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [rcTesting, setRcTesting] = useState(false);
  const [rcTestResult, setRcTestResult] = useState<{ ok: boolean; message: string; gatewayCount?: number } | null>(null);
  const [rcSyncing, setRcSyncing] = useState(false);
  const [rcSyncResult, setRcSyncResult] = useState<any | null>(null);

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

  const loadRcConfig = async () => {
    try {
      const res = await fetch("/api/runcourier/config");
      const j = await res.json();
      if (j.ok && j.config) {
        setHasRcAuthKey(j.config.hasAuthKey);
        setRcAuthKeyMasked(j.config.authKeyMasked || "");
        if (j.config.authKeyMasked) {
          setRcAuthKeyInput(j.config.authKeyMasked);
        }
      }
    } catch {
      // ignore
    }
  };

  async function saveRcSettings() {
    setSavingRc(true);
    setRcSaveResult(null);
    try {
      const res = await fetch("/api/runcourier/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authKey: rcAuthKeyInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setRcSaveResult({ ok: true, message: "✅ Run Courier auth key saved successfully." });
        await loadRcConfig();
      } else {
        setRcSaveResult({ ok: false, message: `❌ ${data.error || "Failed to save key"}` });
      }
    } catch (e: any) {
      setRcSaveResult({ ok: false, message: `❌ Error: ${String(e?.message || e)}` });
    }
    setSavingRc(false);
  }

  async function testRcConnection() {
    setRcTesting(true);
    setRcTestResult(null);
    try {
      const res = await fetch("/api/runcourier/config", { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        setRcTestResult({
          ok: true,
          message: `✅ Run Courier API Connected! Discovered ${j.gatewayCount ?? 0} underlying courier gateways (TCS, Leopard, Trax, BlueEx, M&P, etc.) and verified StatusList.php endpoint.`,
          gatewayCount: j.gatewayCount,
        });
      } else {
        setRcTestResult({ ok: false, message: `❌ Connection failed: ${j.error || "Unknown error"}` });
      }
    } catch (e: any) {
      setRcTestResult({ ok: false, message: `❌ Error: ${String(e?.message || e)}` });
    }
    setRcTesting(false);
  }

  async function runRcManualSync() {
    setRcSyncing(true);
    setRcSyncResult(null);
    try {
      const res = await fetch("/api/runcourier/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll: true }),
      });
      const data = await res.json();
      setRcSyncResult(data);
      loadLogs();
    } catch (e: any) {
      setRcSyncResult({ error: String(e?.message || e) });
    }
    setRcSyncing(false);
  }

  useEffect(() => {
    loadLogs();
    loadPostexConfig();
    loadRcConfig();
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
                    { code: "0002", meaning: "Un-Assigned / Cancelled", default: "Cancelled" },
                    { code: "0009", meaning: "Cancelled by Merchant", default: "Cancelled" },
                    { code: "0006", meaning: "Return in Transit", default: "Return in Transit" },
                    { code: "0014", meaning: "Return Initiated", default: "Return Initiated" },
                    { code: "0016", meaning: "Returned to Origin", default: "Returned" },
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

      {/* Run Courier Integration Section */}
      <Card className="mb-6 border-[#8b5cf6]/40">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-shopify-lg flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-heading-md text-text">Run Courier Integration</h2>
                <span className="pill text-micro bg-[#8b5cf6]/15 text-[#8b5cf6] font-semibold">Independent Provider</span>
              </div>
              <p className="text-micro text-muted">Direct Run Courier API tracking, status normalizer & multi-carrier gateways</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runRcManualSync}
              disabled={rcSyncing || !hasRcAuthKey}
              className="btn-ghost text-xs flex items-center gap-1.5"
              title="Reconcile all active Run Courier orders immediately"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rcSyncing ? "animate-spin" : ""}`} />
              <span>{rcSyncing ? "Syncing Run Courier…" : "Sync Run Courier Now"}</span>
            </button>
            <button
              onClick={testRcConnection}
              disabled={rcTesting}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{rcTesting ? "Verifying…" : "Test API Connection"}</span>
            </button>
            <button
              onClick={saveRcSettings}
              disabled={savingRc}
              className="btn-primary text-xs flex items-center gap-1.5"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{savingRc ? "Saving…" : "Save Run Courier Key"}</span>
            </button>
          </div>
        </div>

        {rcSaveResult && (
          <div className={`p-3.5 rounded-shopify-md mb-5 text-xs flex items-center gap-2 ${rcSaveResult.ok ? "bg-aloe/20 text-black border border-aloe" : "bg-bad/15 text-bad border border-bad/30"}`}>
            {rcSaveResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span>{rcSaveResult.message}</span>
          </div>
        )}

        {rcTestResult && (
          <div className={`p-3.5 rounded-shopify-md mb-5 text-xs flex items-center gap-2 ${rcTestResult.ok ? "bg-aloe/20 text-black border border-aloe" : "bg-bad/15 text-bad border border-bad/30"}`}>
            {rcTestResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span>{rcTestResult.message}</span>
          </div>
        )}

        {rcSyncResult && (
          <div className="p-4 rounded-shopify-md bg-panel2 border border-border mb-5 text-xs">
            {rcSyncResult.error ? (
              <div className="text-bad flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Error: {rcSyncResult.error}</span>
              </div>
            ) : (
              <div>
                <div className="font-semibold text-text mb-1">Run Courier Sync Complete</div>
                <div className="text-muted">
                  Checked: <strong className="text-text">{rcSyncResult.checked}</strong> · 
                  Updated: <strong className="text-good">{rcSyncResult.updated}</strong> · 
                  Unchanged: <strong className="text-text">{rcSyncResult.unchanged}</strong> · 
                  Failed: <strong className={rcSyncResult.failed > 0 ? "text-bad" : "text-text"}>{rcSyncResult.failed}</strong>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Left Column: Auth Status & Endpoints */}
          <div className="space-y-4">
            <div>
              <label className="label flex items-center justify-between">
                <span>Run Courier Auth Key</span>
                <span className="text-micro text-muted font-normal">Stored securely server-side or in .env</span>
              </label>
              <div className="relative flex items-center">
                <input
                  className="input font-mono pr-9"
                  type={showRcKey ? "text" : "password"}
                  placeholder="Paste Run Courier AUTH_KEY"
                  value={rcAuthKeyInput}
                  onChange={(e) => setRcAuthKeyInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowRcKey(!showRcKey)}
                  className="absolute right-2.5 text-muted hover:text-text"
                  title="Show/Hide Key"
                >
                  {showRcKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-muted text-micro mt-1.5 leading-relaxed">
                Enter your key and click <strong>Save Run Courier Key</strong>. It is securely saved server-side (or can be placed in <code className="text-text bg-panel px-1 py-0.5 rounded">.env</code> as <code className="text-text bg-panel px-1 py-0.5 rounded">RUN_COURIER_AUTH_KEY</code>).
              </p>
            </div>

            <div className="p-3.5 rounded bg-panel2 border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-text">Status</span>
                <span className={`pill text-micro ${hasRcAuthKey ? "bg-aloe text-black" : "bg-warn/20 text-warn"}`}>
                  {hasRcAuthKey ? "Key Configured" : "Missing Key"}
                </span>
              </div>
              {rcAuthKeyMasked && (
                <div className="mt-1 text-micro font-mono text-muted bg-panel p-2 rounded border border-border/60">
                  Active Key: {rcAuthKeyMasked}
                </div>
              )}
            </div>

            <div>
              <label className="label">Official Run Courier V2 API Endpoints</label>
              <div className="space-y-1.5 font-mono text-micro text-muted">
                <div className="p-2 rounded bg-panel2 border border-border/60 flex items-center justify-between">
                  <span className="text-text font-medium">Current Status</span>
                  <span>POST /API/CurrentStatus.php</span>
                </div>
                <div className="p-2 rounded bg-panel2 border border-border/60 flex items-center justify-between">
                  <span className="text-text font-medium">Tracking History</span>
                  <span>POST /API/TrackOrder.php</span>
                </div>
                <div className="p-2 rounded bg-panel2 border border-border/60 flex items-center justify-between">
                  <span className="text-text font-medium">Orders List</span>
                  <span>POST /API/GetOrderList.php</span>
                </div>
                <div className="p-2 rounded bg-panel2 border border-border/60 flex items-center justify-between">
                  <span className="text-text font-medium">Status List</span>
                  <span>GET /API/StatusList.php</span>
                </div>
                <div className="p-2 rounded bg-panel2 border border-border/60 flex items-center justify-between">
                  <span className="text-text font-medium">Underlying Gateways</span>
                  <span>GET /API/getThirdpartyApiAndGateways.php</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Multi-Carrier & Normalization Info */}
          <div className="space-y-4">
            <div className="p-3.5 rounded bg-panel2 border border-border text-micro leading-relaxed">
              <div className="font-semibold text-text mb-1">Underlying Courier Gateways</div>
              <p className="text-muted mb-2">
                Run Courier routes through third-party courier companies (TCS, Leopard, Trax, BlueEx, M&P). The system dynamically recognizes carriers without hardcoding IDs and shows carrier info on the shipment.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["TCS", "Leopard", "Trax", "BlueEx", "M&P"].map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded bg-panel border border-border/80 text-text font-medium">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded bg-panel2 border border-border text-micro leading-relaxed">
              <div className="font-semibold text-text mb-1">Status Normalization Layer</div>
              <p className="text-muted">
                Run Courier statuses (e.g. <em>New Booked</em>, <em>Parcel Received at office</em>, <em>Out for Delivery</em>, <em>Delivered</em>, <em>Return Received At Origin</em>) are mapped directly to your application&apos;s internal delivery statuses, seamlessly flowing orders across <strong>Active</strong>, <strong>Courier Handed</strong>, <strong>Delivered</strong>, and <strong>Archive</strong>.
              </p>
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
              <span>SHOPIFY_WEBHOOK_SECRET (for HMAC signature security)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
              <span>
                Shopify Webhook URL:{" "}
                <code className="text-text bg-panel2 px-1.5 py-0.5 rounded-shopify-xs text-micro">/api/webhooks/shopify</code>
              </span>
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
            <li className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${hasRcAuthKey ? "text-good" : "text-muted"}`} />
              <span>RUN_COURIER_AUTH_KEY (Run Courier API Key in .env)</span>
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
