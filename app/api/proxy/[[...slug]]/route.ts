import { NextRequest } from "next/server";

const BACKEND = "http://178.105.135.26";

async function handle(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await ctx.params;
  const path = slug ? slug.join("/") : "";
  const search = req.nextUrl.search || "";
  const url = path ? BACKEND + "/" + path + search : BACKEND + search;
  const isPost = req.method !== "GET" && req.method !== "HEAD";
  const body = isPost ? await req.text() : undefined;
  const upstream = await fetch(url, {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const maxDuration = 60;
