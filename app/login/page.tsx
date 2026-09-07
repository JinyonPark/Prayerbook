import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8">로그인 확인 중</p>}>
      <LoginForm />
    </Suspense>
  );
}
