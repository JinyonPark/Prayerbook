import { NextResponse } from "next/server";
import { z } from "zod";
import { parseEmailInput } from "@/lib/auth/email";
import { AUTH_MESSAGES, MAIL_COOLDOWN_COOKIE, MAIL_COOLDOWN_SECONDS } from "@/lib/auth/messages";
import { signupConfirmCallbackUrl, siteUrlFromRequest } from "@/lib/auth/redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().min(1).max(254),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: AUTH_MESSAGES.invalidEmail }, { status: 400 });
  }

  const parsedEmail = parseEmailInput(parsedBody.data.email);
  if ("error" in parsedEmail) {
    return NextResponse.json({ error: parsedEmail.error }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  if (cookieHeader.split(";").some((part) => part.trim().startsWith(`${MAIL_COOLDOWN_COOKIE}=`))) {
    return NextResponse.json({ error: AUTH_MESSAGES.rateLimit, retryAfter: MAIL_COOLDOWN_SECONDS }, { status: 429 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsedEmail.email,
      options: {
        emailRedirectTo: signupConfirmCallbackUrl(siteUrlFromRequest(request)),
      },
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("security purposes") || message.includes("rate")) {
        return NextResponse.json({ error: AUTH_MESSAGES.rateLimit }, { status: 429 });
      }
    }

    const response = NextResponse.json({ ok: true, message: AUTH_MESSAGES.signupCheckEmail });
    response.cookies.set(MAIL_COOLDOWN_COOKIE, "1", {
      maxAge: MAIL_COOLDOWN_SECONDS,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return response;
  } catch {
    return NextResponse.json({ error: AUTH_MESSAGES.network }, { status: 503 });
  }
}
