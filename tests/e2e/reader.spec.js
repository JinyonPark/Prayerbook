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

test("설정에서 자동 스크롤을 켤 수 있고 기도문 아래 버튼은 없다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/settings");
  const autoScroll = page.getByRole("group", { name: "자동 스크롤", exact: true });
  await expect(autoScroll.getByRole("button", { name: "꺼짐" })).toBeVisible();
  await autoScroll.getByRole("button", { name: "켜짐" }).click();
  await expect(page.getByRole("group", { name: "자동 스크롤 속도", exact: true })).toBeVisible();
  await page.goto("/prayers/dawn");
  await expect(page.getByRole("article")).toBeVisible();
  await expect(page.getByRole("button", { name: "자동 스크롤" })).toHaveCount(0);
  await expect(page.getByText("자동 스크롤 꺼짐")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "일시정지" })).toHaveCount(0);
  await page.goto("/settings");
  await page.getByRole("group", { name: "자동 스크롤", exact: true }).getByRole("button", { name: "꺼짐" }).click();
});

test("xlarge 글씨에서도 가로 스크롤이 없다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.addInitScript(() => {
    localStorage.setItem(
      "prayerbook-prefs",
      JSON.stringify({ theme: "day", fontSize: "xlarge", lineHeight: "spacious", autoScrollSpeed: "normal", autoScrollEnabled: false }),
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
