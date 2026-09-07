import { test, expect } from "@playwright/test";

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

test("manifest 파일 접근 가능", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe("기도훈련집");
  expect(manifest.short_name).toBe("기도훈련집");
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe("#3f5c4b");
  expect(manifest.icons.some((icon) => icon.sizes === "192x192")).toBeTruthy();
  expect(manifest.icons.some((icon) => icon.sizes === "512x512")).toBeTruthy();
});

test("192px 및 512px 아이콘 존재", async ({ request }) => {
  expect((await request.get("/icons/icon-192.png")).ok()).toBeTruthy();
  expect((await request.get("/icons/icon-512.png")).ok()).toBeTruthy();
});

test("로그인 화면이 표시된다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "기도훈련집" })).toBeVisible();
  await expect(page.getByText("Copyright © 오병이어교회")).toBeVisible();
  await expect(page.getByText("권영구 담임목사")).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  await expect(page.getByRole("link", { name: "비밀번호를 잊으셨나요?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "회원가입" })).toBeVisible();
  await expect(page.getByRole("button", { name: "앱 설치" })).toBeVisible();
});

for (const viewport of viewports) {
  test(`${viewport.width}x${viewport.height}에서 가로 스크롤이 없다`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBeFalsy();
  });
}

test("키보드만으로 로그인 주요 컨트롤을 사용할 수 있다", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("설치 안내 페이지가 기기별 설명을 보여준다", async ({ page }) => {
  await page.goto("/install");
  await expect(page.getByRole("heading", { name: /iPhone|Android|Windows|macOS|현재/ }).first()).toBeVisible();
  await expect(page.getByText("앱 설치 또는 홈 화면에 추가", { exact: false }).first()).toBeVisible();
});

test("390px에서 로그인 버튼이 화면 밖으로 나가지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  const box = await page.getByRole("button", { name: "로그인" }).boundingBox();
  expect(box).toBeTruthy();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(844);
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
});

test("xlarge 글자 크기에서도 가로 스크롤이 없다", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "prayerbook-prefs",
      JSON.stringify({ theme: "night", fontSize: "xlarge", lineHeight: "spacious" }),
    );
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/login");
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasOverflow).toBeFalsy();
});
