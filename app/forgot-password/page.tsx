import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<p className="p-8">비밀번호 재설정 화면을 준비하는 중입니다.</p>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
