"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * /login — única página accesible sin auth. Form simple con un input password.
 * En éxito, setea cookie via /api/auth y redirige a la URL original (?from=...) o /.
 */

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";
  const initialError = params.get("error");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    initialError === "no_secret_configured"
      ? "El servidor no tiene APP_PASSWORD configurada. Configúrala en Vercel."
      : null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        router.replace(from);
      } else {
        setError(j.error || "Error desconocido");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg dark:bg-[#050505] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-bg-1 dark:bg-[#0a0a0a] p-8 backdrop-blur"
      >
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-fg-3">
            V Trading
          </div>
          <h1 className="text-2xl font-semibold text-fg">Hola amor</h1>
          <p className="text-[13px] text-fg-3">Necesito tu contraseña.</p>
        </div>

        <input
          type="password"
          autoFocus
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-3 rounded-xl border border-border bg-bg-2 text-fg font-mono tracking-wide focus:outline-none focus:border-amber transition-colors"
        />

        {error && (
          <div className="px-3 py-2 rounded-lg border border-error/40 bg-error/10 text-error text-[12px] font-mono">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full py-3 rounded-xl bg-amber text-black font-semibold text-[14px] tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Validando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
