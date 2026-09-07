import { test, expect } from "@playwright/test";

const sizes = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
];

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

for (const size of sizes) {
  test(`${size.width}x${size.height} 설치 안내창이 visual viewport 안에 있다`, async ({ page }) => {
    const offsetTop = 56;
    const height = size.height - 120;
    await page.setViewportSize(size);
    await mockVisualViewport(page, offsetTop, height, size.width);
    await page.goto("/install");
    await page.getByRole("button", { name: "앱 설치" }).click();
    const dialog = page.getByRole("dialog", { name: "앱으로 설치하기" });
    await expect(dialog).toBeVisible();
    const title = dialog.getByRole("heading", { name: "앱으로 설치하기" });
    const close = dialog.getByRole("button", { name: "닫기" }).first();
    const confirm = dialog.getByRole("link", { name: "기기별 설치 방법" });
    for (const loc of [title, close, confirm]) {
      const box = await loc.boundingBox();
      expect(box).toBeTruthy();
      expect(box.y).toBeGreaterThanOrEqual(offsetTop - 2);
      expect(box.y + box.height).toBeLessThanOrEqual(offsetTop + height + 2);
    }
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowX).toBeFalsy();
  });
}

test("Android 가로 모드에서 안내창이 viewport 안에 있다", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await mockVisualViewport(page, 40, 280, 800);
  await page.goto("/install");
  await page.getByRole("button", { name: "앱 설치" }).click();
  const dialog = page.getByRole("dialog", { name: "앱으로 설치하기" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(38);
  expect(box.y + box.height).toBeLessThanOrEqual(330);
});

test("안내창을 닫으면 원래 스크롤 위치가 유지된다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/install");
  await page.evaluate(() => window.scrollTo(0, 180));
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "앱 설치" }).click();
  await expect(page.getByRole("dialog", { name: "앱으로 설치하기" })).toBeVisible();
  await page.getByRole("dialog", { name: "앱으로 설치하기" }).getByRole("button", { name: "닫기" }).first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThan(8);
});

test("긴 안내는 내부 스크롤이 가능하다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockVisualViewport(page, 80, 400, 320);
  await page.goto("/install");
  await page.getByRole("button", { name: "앱 설치" }).click();
  const dialog = page.getByRole("dialog", { name: "앱으로 설치하기" });
  const canScroll = await dialog.evaluate((node) => {
    const body = [...node.querySelectorAll("div")].find((el) => {
      const overflow = getComputedStyle(el).overflowY;
      return overflow === "auto" || overflow === "scroll";
    });
    return Boolean(body);
  });
  expect(canScroll).toBeTruthy();
});
