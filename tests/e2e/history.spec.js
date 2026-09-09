import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

test.describe("기도 이력", () => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");

  async function login(page) {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
    await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
  }

  async function completeCurrentPrayer(page) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.getByRole("button", { name: /이번 \d+독 기도 완료|한 번 더 완료 기록|기도 완료 기록/ }).click();
    await expect(page.getByText("저장 완료")).toBeVisible({ timeout: 20000 });
  }

  test("홈에서는 이력 RPC를 호출하지 않고 이력 탭에서만 최근 30일을 조회한다", async ({ page }) => {
    const historyCalls = [];
    const monthlyCalls = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("get_recent_prayer_history")) historyCalls.push(url);
      if (url.includes("get_monthly_prayer_history")) monthlyCalls.push(url);
    });
    await login(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Total/ })).toBeVisible();
    expect(historyCalls.length).toBe(0);
    expect(monthlyCalls.length).toBe(0);
    await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "이력" }).click();
    await expect(page.getByRole("heading", { name: "기도 이력" }).first()).toBeVisible();
    await expect(page.getByText(/기도 이력을 불러오는 중|최근 30일 동안 완료한 기도|총 \d+회/)).toBeVisible();
    expect(historyCalls.length).toBe(1);
    expect(monthlyCalls.length).toBe(0);
    await page.getByRole("button", { name: "월별 요약" }).click();
    await expect(page.getByText(/월별 기도 기록을 불러오는 중|표시할 월별 기도 기록|총 \d+회/)).toBeVisible();
    expect(monthlyCalls.length).toBe(1);
  });

  test("기도 완료 후 오늘 이력에 제목과 횟수가 모인다", async ({ page }) => {
    await login(page);
    await page.goto("/prayers/dawn");
    await completeCurrentPrayer(page);
    await page.goto("/history");
    await expect(page.getByText(/하루를 시작하며 드리는 기도/)).toBeVisible();
    await expect(page.getByText(/\d+회/).first()).toBeVisible();
  });

  test("날짜 이력 삭제는 확인창만 사용하고 서버 삭제를 호출하지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await login(page);
    await page.goto("/history");
    const writes = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("supabase")) writes.push(request.url());
    });
    const dateMenu = page.getByRole("button", { name: "날짜 메뉴" }).first();
    if (await dateMenu.count()) {
      await dateMenu.click();
      await page.getByRole("button", { name: "이 날짜 이력 삭제" }).click();
      await expect(page.getByText("이 날짜의 기도 이력을 삭제하시겠습니까?")).toBeVisible();
      await page.getByRole("button", { name: "이력 삭제" }).click();
    }
    expect(writes.filter((url) => url.includes("delete_history") || url.includes("user_daily_prayer_stats"))).toHaveLength(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
