import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

const viewports = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
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

async function mockVisualViewport(page, offsetTop, height, width) {
  await page.addInitScript(
    ({ offsetTop: top, height: viewportHeight, width: viewportWidth }) => {
      const viewport = {
        offsetTop: top,
        height: viewportHeight,
        width: viewportWidth,
        addEventListener() {},
        removeEventListener() {},
      };
      Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    },
    { offsetTop, height, width },
  );
}

test("로그인 후 오늘의 기도 카드가 보인다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "오늘의 기도" })).toBeVisible();
});

for (const viewport of viewports) {
  test(`${viewport.width}px에서 오늘의 기도 버튼이 잘리지 않는다`, async ({ page }) => {
    test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
    await page.setViewportSize(viewport);
    await login(page);
    await page.goto("/");
    const card = page.getByRole("heading", { name: "오늘의 기도" });
    await expect(card).toBeVisible();
    const action = page.getByRole("link", { name: "기도 시작하기" }).or(page.getByRole("button", { name: "오늘의 기도 결과 복사" }));
    await expect(action.first()).toBeVisible();
    const box = await action.first().boundingBox();
    expect(box).toBeTruthy();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowX).toBeFalsy();
  });
}

test("320px에서 복사와 공유 미리보기가 viewport 안에 있다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 320, height: 640 });
  await mockVisualViewport(page, 56, 520, 320);
  await login(page);
  await page.goto("/");
  const copy = page.getByRole("button", { name: "오늘의 기도 결과 복사" });
  if ((await copy.count()) === 0) {
    await expect(page.getByRole("link", { name: "기도 시작하기" })).toBeVisible();
    return;
  }
  await copy.click();
  const dialog = page.getByRole("dialog", { name: "공유할 내용" });
  await expect(dialog).toBeVisible();
  const title = dialog.getByRole("heading", { name: "공유할 내용" });
  const share = dialog.getByRole("button", { name: "공유" });
  for (const loc of [title, share]) {
    const box = await loc.boundingBox();
    expect(box).toBeTruthy();
    expect(box.y).toBeGreaterThanOrEqual(54);
    expect(box.y + box.height).toBeLessThanOrEqual(56 + 520 + 2);
  }
});

test("주간·야간 모드에서 오늘의 기도 카드가 보인다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.addInitScript(() => {
    localStorage.setItem(
      "prayerbook-prefs",
      JSON.stringify({ theme: "night", fontSize: "default", lineHeight: "comfortable", autoScrollSpeed: "normal", autoScrollEnabled: false }),
    );
  });
  await login(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "오늘의 기도" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
});

test("키보드만으로 복사 버튼을 열 수 있다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/");
  const copy = page.getByRole("button", { name: "오늘의 기도 결과 복사" });
  if ((await copy.count()) === 0) {
    const start = page.getByRole("link", { name: "기도 시작하기" });
    await start.focus();
    await expect(start).toBeFocused();
    return;
  }
  await copy.focus();
  await expect(copy).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "공유할 내용" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "공유할 내용" })).toHaveCount(0);
});

test("기록 화면에는 오늘의 기도 카드가 없다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "오늘의 기도 기록" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "오늘의 기도", exact: true })).toHaveCount(0);
});
