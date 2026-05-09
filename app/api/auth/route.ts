import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth — recibe { password }, valida contra APP_PASSWORD env,
 * retorna Set-Cookie con token firmado HMAC.
 * DELETE /api/auth — borra cookie (logout).
 */

const COOKIE_NAME = "tanit_auth";
const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

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

async function makeToken(secret: string): Promise<string> {
  const payload = btoa(JSON.stringify({ exp: Date.now() + COOKIE_TTL_MS }));
  const sig = await hmac(payload, secret);
  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "APP_PASSWORD no configurada en servidor" },
      { status: 500 },
    );
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password.length === 0) {
    return NextResponse.json({ ok: false, error: "password requerido" }, { status: 400 });
  }

  // Comparación constant-time para no leak timing
  if (body.password.length !== secret.length) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta" }, { status: 401 });
  }
  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) {
    mismatch |= body.password.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta" }, { status: 401 });
  }

  const token = await makeToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_TTL_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
