/**
 * 기존 미인증 사용자를 한 명만 확인 처리한다.
 * CI·migration에서 실행하지 않는다.
 *
 * 사용법:
 *   npx tsx scripts/confirm-existing-auth-user.ts <auth-user-uuid>
 *
 * 필요 환경 변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const userId = process.argv[2]?.trim();
if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
  console.error("사용법: npx tsx scripts/confirm-existing-auth-user.ts <auth-user-uuid>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
if (error) {
  console.error("확인 처리에 실패했습니다.", error.code ?? "", error.message.slice(0, 200));
  process.exit(1);
}

console.log("확인 처리됨:", data.user?.id);
