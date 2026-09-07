import { test, expect } from "@playwright/test";

test("비밀번호 재설정 화면이 안내를 보여준다", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "비밀번호 재설정" })).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByRole("button", { name: "재설정 링크 보내기" })).toBeVisible();
});

test("재설정 링크 없이 새 비밀번호 화면에 들어오면 다시 받기를 안내한다", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByText("비밀번호 재설정 링크가 만료되었거나")).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("link", { name: "새 링크 요청" })).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인으로 돌아가기" })).toBeVisible();
});
