import { test, expect } from "@playwright/test";

test("설치 API 미지원 환경에서 수동 안내를 표시한다", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "BeforeInstallPromptEvent", { value: undefined });
  });
  await page.goto("/install");
  await expect(page.getByText("브라우저 메뉴", { exact: false }).first()).toBeVisible();
});

test("로그인 화면에 앱 설치 버튼이 있다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "앱 설치" })).toBeVisible();
});

test("설치되어 있지 않으면 설치 버튼으로 안내를 연다", async ({ page }) => {
  await page.goto("/install");
  await page.getByRole("button", { name: "앱 설치" }).click();
  await expect(page.getByRole("dialog", { name: "앱으로 설치하기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "기기별 설치 방법" })).toBeVisible();
});

test("Chrome 설치 창이 있으면 버튼이 바로 설치를 요청한다", async ({ page }) => {
  await page.addInitScript(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      preventDefault() {},
      prompt() {
        window.__prayerbookPromptCalled = true;
        return Promise.resolve();
      },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.__prayerbookInstallPrompt = event;
  });
  await page.goto("/install");
  await page.getByRole("button", { name: "앱 설치" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__prayerbookPromptCalled))).toBeTruthy();
  await expect(page.getByRole("dialog", { name: "앱으로 설치하기" })).toHaveCount(0);
});

test("standalone 환경에서는 설치 버튼과 카드가 숨겨질 수 있다", async ({ page }) => {
  await page.addInitScript(() => {
    window.matchMedia = (query) => ({
      matches: query.includes("display-mode: standalone"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
      onchange: null,
    });
  });
  await page.goto("/install");
  await expect(page.getByText("이미 앱으로 실행 중입니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "앱 설치" })).toHaveCount(0);
});
