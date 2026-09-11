import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/auth/redirect";
import { hasPublicEnv } from "@/lib/validation/env";

function destinationFor(type: string | null, next: string): string {
  if (type === "recovery") return "/reset-password";
  if (next === "/reset-password") return "/reset-password";
  if (type === "signup" || type === "email" || type === "invite") return "/";
  if (next === "/login") return "/";
  return next;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/");
  const destination = destinationFor(type, next);

  if (!hasPublicEnv()) {
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(new URL("/auth/error?reason=missing", origin));
  }

  const redirectResponse = NextResponse.redirect(new URL(destination, origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          for (const cookie of cookiesToSet) {
            redirectResponse.cookies.set(cookie.name, cookie.value, cookie.options);
          }
        },
      },
    },
  );

  let failed = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  }

  if (failed) {
    return NextResponse.redirect(new URL("/auth/error?reason=expired", origin));
  }

  return redirectResponse;
}
