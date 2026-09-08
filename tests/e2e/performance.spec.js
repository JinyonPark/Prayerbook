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

test("완료 클릭은 complete 요청 한 번이고 전체 새로고침이 없다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/prayers/dawn");
  await expect(page.getByRole("article")).toBeVisible();
  await expect(page.getByText(/누적 \d+회|누적 완료 \d+회/)).toBeVisible();
  let loads = 0;
  page.on("load", () => {
    loads += 1;
  });
  const completeCalls = [];
  const extraSummary = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "POST" && (url.includes("complete_prayer") || url.includes("/api/prayers/complete"))) {
      completeCalls.push(url);
    }
    if (url.includes("get_daily_prayer_summary") || url.includes("get_prayer_progress_summary") || url.includes("get_home_dashboard_summary")) {
      extraSummary.push(url);
    }
  });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  extraSummary.length = 0;
  await page.getByRole("button", { name: /이번 \d+독 기도 완료|한 번 더 완료 기록|기도 완료 기록/ }).click();
  await expect(page.getByText("저장 중")).toBeVisible();
  await expect(page.getByText("저장 완료")).toBeVisible({ timeout: 20000 });
  expect(completeCalls.length).toBe(1);
  expect(extraSummary.length).toBe(0);
  expect(loads).toBe(0);
});

test("다음 기도 이동이 전체 페이지 reload가 아니다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/prayers/dawn");
  await expect(page.getByRole("article")).toBeVisible();
  let loads = 0;
  page.on("load", () => {
    loads += 1;
  });
  await page.getByRole("link", { name: /다음 기도/ }).click();
  await expect(page).not.toHaveURL(/\/prayers\/dawn$/);
  await expect(page).toHaveURL(/\/prayers\//);
  expect(loads).toBe(0);
});
