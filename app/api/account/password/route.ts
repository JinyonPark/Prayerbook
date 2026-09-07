import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/validation/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  currentPassword: z.string().min(6).max(72),
  nextPassword: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "현재 비밀번호와 새 비밀번호를 확인해 주세요." }, { status: 400 });
  }
  if (parsedBody.data.currentPassword === parsedBody.data.nextPassword) {
    return NextResponse.json({ error: "새 비밀번호는 현재 비밀번호와 달라야 합니다." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const env = getPublicEnv();
  const verifier = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsedBody.data.currentPassword,
  });
  if (verifyError) {
    return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const { error } = await supabase.auth.updateUser({ password: parsedBody.data.nextPassword });
  if (error) {
    return NextResponse.json({ error: "비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
