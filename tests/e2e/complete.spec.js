import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}

test("완료 저장이 인터넷 오류로 잘못 표시되지 않는다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/prayers/dawn");
  await expect(page.getByRole("article")).toBeVisible();
  const beforeText = await page.getByText(/누적 \d+회/).first().textContent();
  const before = Number(beforeText?.match(/누적 (\d+)회/)?.[1] ?? "0");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: /이번 \d+독 기도 완료|한 번 더 완료 기록|기도 완료 기록/ }).click();
  await expect(page.getByText("인터넷에 연결할 수 없습니다")).toHaveCount(0);
  await expect(page.getByText("서버에 연결할 수 없습니다")).toHaveCount(0);
  await expect(page.getByText("저장 완료")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(new RegExp(`누적 ${before + 1}회`))).toBeVisible();
});
