import { NextResponse } from "next/server";
import { z } from "zod";
import { parseEmailInput } from "@/lib/auth/email";
import { parseAuthIdentifier } from "@/lib/auth/identifier";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { MAX_PASSWORD_LENGTH, MIN_LOGIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().max(254).optional(),
  identifier: z.string().max(254).optional(),
  password: z.string().min(MIN_LOGIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 400 });
  }

  const rawIdentifier = parsedBody.data.email ?? parsedBody.data.identifier ?? "";
  const identifier = parseAuthIdentifier(rawIdentifier);
  if ("error" in identifier) {
    return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 400 });
  }

  let email = identifier.kind === "email" ? identifier.email : "";
  if (identifier.kind === "loginId") {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("user_login_ids")
      .select("auth_email")
      .eq("login_id", identifier.loginId)
      .maybeSingle();
    if (!data?.auth_email) {
      return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 401 });
    }
    email = data.auth_email;
  }

  if (identifier.kind === "email") {
    const parsedEmail = parseEmailInput(identifier.email);
    if ("error" in parsedEmail) {
      return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 400 });
    }
    email = parsedEmail.email;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: parsedBody.data.password,
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("email not confirmed")) {
        return NextResponse.json({ error: AUTH_MESSAGES.unconfirmed, code: "unconfirmed" }, { status: 403 });
      }
      if (message.includes("security purposes") || message.includes("rate")) {
        return NextResponse.json({ error: AUTH_MESSAGES.rateLimit }, { status: 429 });
      }
      return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: AUTH_MESSAGES.network }, { status: 503 });
  }
}
