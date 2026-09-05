import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8">로그인 확인 중</p>}>
      <AuthPanel />
    </Suspense>
  );
}
