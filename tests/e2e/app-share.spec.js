import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);
test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");

const APP_SHARE_URL = "https://prayer-book-chi.vercel.app/";
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

async function installShareMocks(page) {
  await page.addInitScript(() => {
    window.__copiedTexts = [];
    window.__shareCalls = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedTexts.push(text);
        },
        readText: async () => window.__copiedTexts.at(-1) ?? "",
      },
    });
    navigator.share = async (data) => {
      window.__shareCalls.push({ title: data.title, text: data.text, url: data.url });
    };
  });
}

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}

async function openSettingsShare(page) {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "앱 정보 및 공유" })).toBeVisible();
  await page.getByTestId("app-share-trigger").click();
  return page.getByRole("dialog", { name: "기도훈련집 공유" });
}

test("설정 하단에 앱 정보 및 공유 항목이 있다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "읽기 설정" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "앱 정보 및 공유" })).toBeVisible();
  await expect(page.getByRole("button", { name: /기도훈련집 공유하기/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /앱 설치 안내/ })).toBeVisible();
  await expect(page.getByTestId("app-version-row")).toContainText(/v\d+\.\d+\.\d+/);
  await expect(page.getByRole("heading", { name: "오늘의 기록" })).toHaveCount(0);
});

test("공유 Bottom Sheet에서 URL 확인, 복사, 닫기, 다시 열기", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await installShareMocks(page);
  await login(page);
  const dialog = await openSettingsShare(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("기도훈련집을 가족이나 교회 지인에게 공유해 보세요.")).toBeVisible();
  await expect(page.getByTestId("app-share-url")).toHaveText(APP_SHARE_URL);
  await expect(dialog.getByRole("button", { name: "공유하기" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "링크 복사" })).toBeVisible();
  await dialog.getByRole("button", { name: "링크 복사" }).click();
  await expect(dialog.getByText("링크가 복사되었습니다.")).toBeVisible();
  const copied = await page.evaluate(() => window.__copiedTexts.at(-1));
  expect(copied).toBe(APP_SHARE_URL);
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("dialog", { name: "기도훈련집 공유" })).toHaveCount(0);
  await expect(page.getByTestId("app-share-trigger")).toBeFocused();
  await page.getByTestId("app-share-trigger").click();
  await expect(page.getByRole("dialog", { name: "기도훈련집 공유" })).toBeVisible();
  await page.getByRole("dialog", { name: "기도훈련집 공유" }).getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("dialog", { name: "기도훈련집 공유" })).toHaveCount(0);
});

test("Web Share API payload는 앱 이름과 운영 URL만 담는다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await installShareMocks(page);
  await login(page);
  const dialog = await openSettingsShare(page);
  await dialog.getByRole("button", { name: "공유하기" }).click();
  const payload = await page.evaluate(() => window.__shareCalls.at(-1));
  expect(payload.title).toBe("기도훈련집");
  expect(payload.url).toBe(APP_SHARE_URL);
  expect(payload.text).toContain("기도훈련집을 공유합니다.");
  expect(payload.text).not.toContain(APP_SHARE_URL);
  expect(payload.url).not.toMatch(/[?&]/);
  await expect(dialog.getByText("공유가 완료되었습니다.")).toHaveCount(0);
  await expect(dialog.getByText("링크가 복사되었습니다.")).toHaveCount(0);
});

test("공유 취소 AbortError는 오류 문구를 띄우지 않는다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.addInitScript(() => {
    window.__copiedTexts = [];
    navigator.share = async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    };
  });
  await login(page);
  const dialog = await openSettingsShare(page);
  await dialog.getByRole("button", { name: "공유하기" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("app-share-notice")).toHaveText("");
  await expect(dialog.getByText("링크를 복사하지 못했습니다.")).toHaveCount(0);
});

test("Web Share 미지원이면 공유하기가 링크 복사 fallback을 쓴다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.addInitScript(() => {
    window.__copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedTexts.push(text);
        },
      },
    });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await login(page);
  const dialog = await openSettingsShare(page);
  await dialog.getByRole("button", { name: "공유하기" }).click();
  await expect(dialog.getByText("링크가 복사되었습니다.")).toBeVisible();
  const copied = await page.evaluate(() => window.__copiedTexts.at(-1));
  expect(copied).toBe(APP_SHARE_URL);
});

test("앱 설치 안내는 공유와 다른 화면으로 간다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/settings");
  await page.getByTestId("app-install-guide").click();
  await expect(page).toHaveURL(/\/install/);
  await expect(page.getByRole("heading", { name: "기도훈련집 공유" })).toHaveCount(0);
});

test("주간·야간 모드에서 앱 공유 섹션이 보인다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.addInitScript(() => {
    localStorage.setItem(
      "prayerbook-prefs",
      JSON.stringify({ theme: "night", fontSize: "default", lineHeight: "comfortable", autoScrollSpeed: "normal", autoScrollEnabled: false }),
    );
  });
  await login(page);
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.getByRole("heading", { name: "앱 정보 및 공유" })).toBeVisible();
  await page.getByRole("button", { name: "주간" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await expect(page.getByRole("heading", { name: "앱 정보 및 공유" })).toBeVisible();
});

for (const viewport of viewports) {
  test(`${viewport.width}x${viewport.height}에서 공유 Bottom Sheet가 가로로 넘치지 않는다`, async ({ page }) => {
    test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
    await page.setViewportSize(viewport);
    await login(page);
    const dialog = await openSettingsShare(page);
    await expect(dialog).toBeVisible();
    const share = dialog.getByRole("button", { name: "공유하기" });
    const copy = dialog.getByRole("button", { name: "링크 복사" });
    const url = page.getByTestId("app-share-url");
    for (const loc of [share, copy, url]) {
      const box = await loc.boundingBox();
      expect(box).toBeTruthy();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(16);
    }
    const shareBox = await share.boundingBox();
    expect(shareBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowX).toBeFalsy();
  });
}
