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
    <div
      className="w-full max-w-md bg-panel border border-border p-10 relative"
      style={{
        borderRadius: "20px",
        boxShadow: "0 8px 8px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex flex-col items-center text-center mb-10">
        <div className="h-12 w-12 rounded-pill bg-text flex items-center justify-center text-bg font-semibold text-lg mb-4">
          B
        </div>
        <h1 className="text-heading-xl text-text tracking-tight">Business Tracker</h1>
        <p className="text-caption text-muted mt-1.5">Personal Store & Order Analytics</p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-shopify-md bg-bad/8 border border-bad/20 text-bad text-xs font-medium text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="label">Username</label>
          <input
            type="text"
            required
            className="input"
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
            className="input"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="pt-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-sm font-medium tracking-wide disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>

      <div className="mt-10 text-center text-micro text-muted">
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
