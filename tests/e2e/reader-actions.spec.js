import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

const viewports = [
  { width: 320, height: 640 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}

async function topHitIsButton(page, locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const button = el.closest("a,button");
    return {
      tag: el.tagName,
      closest: button?.tagName ?? null,
      text: (button?.textContent || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
    };
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(hit?.closest === "A" || hit?.closest === "BUTTON").toBeTruthy();
  return hit;
}

test("기도문 하단 버튼이 다른 요소에 가려지지 않는다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/prayers/dawn");
  await expect(page.getByRole("article")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await topHitIsButton(page, page.getByRole("button", { name: /기도 완료|한 번 더 완료 기록/ }).first());
  await topHitIsButton(page, page.getByRole("link", { name: "다음 기도" }));
  await topHitIsButton(page, page.getByRole("button", { name: "목차 이동" }));
});

for (const viewport of viewports) {
  test(`viewport ${viewport.width}x${viewport.height}에서 가로 스크롤이 없다`, async ({ page }) => {
    test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
    await page.setViewportSize(viewport);
    await login(page);
    await page.goto("/prayers/dawn");
    await expect(page.getByRole("article")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBeFalsy();
  });
}

test("자녀 기도 본문에는 이름 편집 버튼이 없다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/prayers/children");
  await expect(page.getByRole("heading", { level: 1 }).or(page.getByText("12. 자녀를 위한 기도"))).toBeVisible();
  await expect(page.getByRole("button", { name: "자녀 이름 입력" })).toHaveCount(0);
  await expect(page.getByText("설정에서만 수정할 수 있습니다")).toBeVisible();
});

test("상단 뒤로·홈과 목차 항목이 실제 링크로 이동한다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/prayers/dawn");
  await expect(page.getByRole("article")).toBeVisible();
  await topHitIsButton(page, page.getByRole("link", { name: "뒤로" }));
  await topHitIsButton(page, page.getByRole("link", { name: "홈" }));
  await page.getByRole("button", { name: "목차" }).click();
  await expect(page.getByRole("dialog", { name: "목차" })).toBeVisible();
  await page.getByRole("dialog", { name: "목차" }).getByRole("link").nth(1).click();
  await expect(page).not.toHaveURL(/\/prayers\/dawn\/?$/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/prayers\/[^/]+/, { timeout: 15000 });
});

test("하단 목차 이동은 목차 시트를 연다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/prayers/dawn");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "목차 이동" }).click();
  await expect(page.getByRole("dialog", { name: "목차" })).toBeVisible();
});
