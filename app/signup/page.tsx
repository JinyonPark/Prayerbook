import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="p-8">회원가입 화면을 준비하는 중입니다.</p>}>
      <SignupForm />
    </Suspense>
  );
}
