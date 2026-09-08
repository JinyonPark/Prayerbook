import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}

test("하단 메뉴 이동이 전체 페이지 reload가 아니다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  let loads = 0;
  page.on("load", () => {
    loads += 1;
  });
  const start = Date.now();
  await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "기도" }).click();
  await expect(page).toHaveURL(/\/prayers$/);
  console.log("home_to_prayers_ms", Date.now() - start, "loads", loads);
  expect(loads).toBe(0);
});

test("홈에서 이어 기도하기 링크가 prefetch된다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/");
  const continueLink = page.getByRole("link", { name: /계속 기도하기|1번 기도부터 시작하기/ }).first();
  await expect(continueLink).toBeVisible();
  const href = await continueLink.getAttribute("href");
  expect(href).toMatch(/^\/prayers\//);
});
