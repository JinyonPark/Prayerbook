import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, env: false, supabase: "missing-env" }, { status: 503 });
  }

  try {
    const base = url.replace(/\/$/, "");
    const authHealth = await fetch(`${base}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    const rest = await fetch(`${base}/rest/v1/prayer_items?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });
    const reachable = authHealth.ok || rest.status > 0;
    return NextResponse.json(
      {
        ok: reachable,
        env: true,
        supabase: authHealth.ok ? "ok" : `auth-${authHealth.status}`,
        rest: rest.ok ? "ok" : `http-${rest.status}`,
      },
      { status: reachable ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ ok: false, env: true, supabase: "unreachable" }, { status: 503 });
  }
}
