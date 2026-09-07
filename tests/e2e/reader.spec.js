import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

test("로그인 후 기도문 320px에서 가로 스크롤이 없다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/prayers/dawn");
  await expect(page.getByRole("article")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBeFalsy();
});

test("자동 스크롤을 시작하고 멈출 수 있다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.goto("/prayers/dawn");
  await expect(page.getByText("자동 스크롤 꺼짐")).toBeVisible();
  await page.getByRole("button", { name: "자동 스크롤" }).click();
  await expect(page.getByText("자동 스크롤 중")).toBeVisible();
  await page.getByRole("button", { name: "일시정지" }).click();
  await expect(page.getByText("자동 스크롤 꺼짐")).toBeVisible();
});

test("xlarge 글씨에서도 가로 스크롤이 없다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.addInitScript(() => {
    localStorage.setItem(
      "prayerbook-prefs",
      JSON.stringify({ theme: "day", fontSize: "xlarge", lineHeight: "spacious", autoScrollSpeed: "normal" }),
    );
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.goto("/prayers/spouse");
  await expect(page.getByRole("article")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBeFalsy();
  await expect(page.locator("text=6)").first()).toBeVisible();
});
