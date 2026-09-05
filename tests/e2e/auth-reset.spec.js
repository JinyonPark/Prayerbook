import { test, expect } from "@playwright/test";

test("비밀번호 재설정 탭이 안내를 보여준다", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "비밀번호 재설정" }).click();
  await expect(page.getByRole("button", { name: "재설정 메일 보내기" })).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByText("아이디로 만든 계정은 재설정 메일을 보낼 수 없습니다.")).toBeVisible();
});

test("재설정 링크 없이 새 비밀번호 화면에 들어오면 다시 받기를 안내한다", async ({ page }) => {
  await page.goto("/auth/update-password");
  await expect(page.getByRole("heading", { name: "새 비밀번호 설정" })).toBeVisible();
  await expect(page.getByText("재설정 링크가 만료되었거나 유효하지 않습니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "재설정 메일 다시 받기" })).toBeVisible();
});
