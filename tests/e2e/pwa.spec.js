import { test, expect } from "@playwright/test";

test("설치 API 미지원 환경에서 수동 안내를 표시한다", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "BeforeInstallPromptEvent", { value: undefined });
  });
  await page.goto("/install");
  await expect(page.getByText("브라우저 메뉴", { exact: false }).first()).toBeVisible();
});

test("standalone 환경에서는 설치 카드가 숨겨질 수 있다", async ({ page }) => {
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
});
