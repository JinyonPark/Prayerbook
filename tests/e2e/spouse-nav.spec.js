import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}

test("남편 선택 시 다음 기도가 아내 기도를 건너뛴다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "남편을 위한 기도" }).click();
  await page.goto("/prayers/home");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("link", { name: "다음 기도" }).click();
  await expect(page).toHaveURL(/\/prayers\/husband/);
  await expect(page.getByText("9. 남편을 위한 기도").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("link", { name: "다음 기도" }).click();
  await expect(page).toHaveURL(/\/prayers\/parents/);
  await expect(page).not.toHaveURL(/\/prayers\/wife/);
});

test("목차에서 제외된 배우자 기도도 직접 열 수 있다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "남편을 위한 기도" }).click();
  await page.goto("/prayers/dawn");
  await page.getByRole("button", { name: "목차", exact: true }).click();
  await page.getByRole("link", { name: /10\. 아내를 위한 기도/ }).click();
  await expect(page).toHaveURL(/\/prayers\/wife/);
  await expect(page.getByText("10. 아내를 위한 기도").first()).toBeVisible();
});
