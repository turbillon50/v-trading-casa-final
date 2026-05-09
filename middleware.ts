import { NextRequest, NextResponse } from "next/server";

/**
 * Auth middleware — bloquea TODO acceso a la app si no hay cookie firmada con
 * APP_PASSWORD. La página /login y /api/auth quedan abiertas para que Luis
 * pueda autenticarse. Todo lo demás redirige a /login si la cookie falta o
 * está mala.
 *
 * Variable de entorno requerida en Vercel:
 *   APP_PASSWORD = la misma que tiene Tanit en Railway
 *
 * Cookie 'tanit_auth' es httpOnly + signed (HMAC con APP_PASSWORD como secret).
 * Sin secret => fail-closed (todo bloqueado, salvo login).
 */

export const config = {
  // Aplicar a todo excepto: assets estáticos, /login, /api/auth, favicon, _next
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)"],
};

const COOKIE_NAME = "tanit_auth";

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const expected = await hmac(payload, secret);
    if (expected !== sig) return false;
    const decoded = JSON.parse(atob(payload));
    if (typeof decoded.exp !== "number") return false;
    return decoded.exp > Date.now();
  } catch {
    return false;
  }
}

async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Buffer.from(new Uint8Array(sig)).toString("hex");
}

export async function middleware(req: NextRequest) {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    // Fail-closed: si no hay secret configurado, todo redirige a /login
    // donde el usuario verá un error claro.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "no_secret_configured");
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token, secret))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
