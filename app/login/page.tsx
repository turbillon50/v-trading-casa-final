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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black px-4">
      {/* Fondo: escena cinematica de la agente operando, direccion de arte
          negro absoluto + rosa neon aprobada 24-ago. Overlay para legibilidad
          del form, mas fuerte hacia el centro/abajo donde vive el formulario. */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: "url(/hero-trader.jpg)" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 60%, rgba(0,0,0,.55) 0%, rgba(0,0,0,.86) 55%, rgba(0,0,0,.96) 100%)",
        }}
        aria-hidden="true"
      />

      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-black/55 p-8 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,.7)]"
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
          className="w-full px-4 py-3 rounded-xl border border-border bg-bg-2 text-fg font-mono tracking-wide focus:outline-none focus:border-rose transition-colors"
        />

        {error && (
          <div className="px-3 py-2 rounded-lg border border-error/40 bg-error/10 text-error text-[12px] font-mono">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full py-3 rounded-xl bg-rose text-black font-semibold text-[14px] tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
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
