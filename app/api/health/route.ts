import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, env: false, supabase: "missing-env" }, { status: 503 });
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/prayer_items?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });
    return NextResponse.json(
      {
        ok: response.ok,
        env: true,
        supabase: response.ok ? "ok" : `http-${response.status}`,
      },
      { status: response.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ ok: false, env: true, supabase: "unreachable" }, { status: 503 });
  }
}
