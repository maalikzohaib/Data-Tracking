"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/orders";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        router.push(from);
        router.refresh();
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-panel border border-border rounded-3xl p-8 shadow-card relative overflow-hidden">
      {/* Glow effect */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ backgroundImage: "linear-gradient(135deg, #10b981, #f5c451)" }}
      />

      <div className="flex flex-col items-center text-center mb-8">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-glow font-display mb-3"
          style={{ backgroundImage: "linear-gradient(135deg, #10b981, #f5c451)" }}
        >
          B
        </div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Business Tracker</h1>
        <p className="text-sm text-muted mt-1">Personal Store & Order Analytics</p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium text-center">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input
            type="text"
            required
            className="input text-sm"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="label">Password</label>
          <input
            type="password"
            required
            className="input text-sm"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-sm font-semibold tracking-wide"
          >
            {loading ? "Signing in..." : "Sign In to Business Tracker"}
          </button>
        </div>
      </form>

      <div className="mt-8 text-center text-xs text-muted">
        Session remains active for 8 hours.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text p-4 transition-colors">
      <Suspense fallback={<div className="text-muted text-sm py-10 text-center">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
