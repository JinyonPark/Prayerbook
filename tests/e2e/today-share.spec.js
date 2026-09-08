import { test, expect } from "@playwright/test";

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);
test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");

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
    const copy = page.getByRole("button", { name: "오늘의 기도 결과 복사" });
    await expect(copy).toBeVisible();
    const box = await copy.boundingBox();
    expect(box).toBeTruthy();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowX).toBeFalsy();
  });
}

test("320px에서 복사 팝업이 viewport 안에 있다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.setViewportSize({ width: 320, height: 640 });
  await mockVisualViewport(page, 56, 520, 320);
  await login(page);
  await page.goto("/");
  await page.getByRole("button", { name: "오늘의 기도 결과 복사" }).click();
  const dialog = page.getByRole("dialog", { name: "복사할 내용" });
  await expect(dialog).toBeVisible();
  const title = dialog.getByRole("heading", { name: "복사할 내용" });
  const copy = dialog.getByRole("button", { name: "복사" });
  for (const loc of [title, copy]) {
    const box = await loc.boundingBox();
    expect(box).toBeTruthy();
    expect(box.y).toBeGreaterThanOrEqual(54);
    expect(box.y + box.height).toBeLessThanOrEqual(56 + 520 + 2);
  }
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflowX).toBeFalsy();
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
  await copy.focus();
  await expect(copy).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "복사할 내용" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(copy).toBeFocused();
});

test("기록 화면에는 오늘의 기도 카드가 없다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "오늘의 기도 기록" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "오늘의 기도", exact: true })).toHaveCount(0);
});

test("결과 복사 흐름 A: 제목, 선택, 편집, 복사", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await installShareMocks(page);
  await login(page);
  await page.goto("/");
  await page.getByRole("button", { name: "오늘의 기도 결과 복사" }).click();
  const dialog = page.getByRole("dialog", { name: "복사할 내용" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(dialog.getByRole("checkbox")).toHaveCount(4);
  const editor = dialog.getByLabel("편집할 문구");
  await expect(editor).toHaveValue(/기도훈련집 오늘의 기록/);
  await editor.fill("오늘도 기도할 수 있어 감사합니다.");
  await dialog.getByRole("button", { name: "복사" }).click();
  await expect(dialog.getByText("편집한 기도 기록을 복사했습니다.")).toBeVisible();
  const copied = await page.evaluate(() => window.__copiedTexts.at(-1));
  expect(copied).toBe("오늘도 기도할 수 있어 감사합니다.");
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("공유하기 흐름 B: 제목, 편집, 공유, URL 없음", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await installShareMocks(page);
  await login(page);
  await page.goto("/");
  await page.getByRole("button", { name: "오늘의 기도 결과 공유하기" }).click();
  const dialog = page.getByRole("dialog", { name: "공유할 내용" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await dialog.getByLabel("편집할 문구").fill("오늘 16회 기도했습니다.");
  await dialog.getByRole("button", { name: "공유" }).click();
  const payload = await page.evaluate(() => window.__shareCalls.at(-1));
  expect(payload.title).toBe("기도훈련집 오늘의 기록");
  expect(payload.text).toBe("오늘 16회 기도했습니다.");
  expect(payload.url).toBeUndefined();
});

test("연속 실행 흐름 C: copy 닫기 후 share, 다시 copy", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/");
  await page.getByRole("button", { name: "오늘의 기도 결과 복사" }).click();
  await expect(page.getByRole("dialog", { name: "복사할 내용" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "오늘의 기도 결과 공유하기" }).click();
  const shareDialog = page.getByRole("dialog", { name: "공유할 내용" });
  await expect(shareDialog).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(shareDialog.getByText("현재 주요 동작은 공유입니다.")).toBeVisible();
  await shareDialog.getByRole("button", { name: "취소" }).click();
  await page.getByRole("button", { name: "오늘의 기도 결과 복사" }).click();
  const copyDialog = page.getByRole("dialog", { name: "복사할 내용" });
  await expect(copyDialog).toBeVisible();
  await expect(copyDialog.getByText("현재 주요 동작은 복사입니다.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("항목 선택 흐름 D: 선택 해제와 편집값 보호", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await login(page);
  await page.goto("/");
  await page.getByRole("button", { name: "오늘의 기도 결과 복사" }).click();
  const dialog = page.getByRole("dialog", { name: "복사할 내용" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("오늘 기도 횟수").uncheck();
  const editor = dialog.getByLabel("편집할 문구");
  await expect(editor).not.toHaveValue(/오늘 총 \d+회 기도했습니다/);
  await editor.fill("직접 작성한 공유 문구");
  await dialog.getByLabel("지금까지 누적 기도 횟수").uncheck();
  await expect(dialog.getByText("공유할 기록 선택이 변경되었습니다.")).toBeVisible();
  await expect(editor).toHaveValue("직접 작성한 공유 문구");
});
