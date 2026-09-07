import { test, expect } from "@playwright/test";

const RESET_COPY = "입력한 이메일이 가입된 계정이라면";
const LOGIN_ERROR = "이메일 또는 비밀번호를 확인해 주세요.";

test("비로그인으로 홈에 가면 로그인으로 보낸다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page).toHaveURL(/next=/);
  await expect(page.getByRole("heading", { name: "기도훈련집" })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});

test("비로그인으로 설정에 가면 next를 붙인다", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
});

test("잘못된 비밀번호는 계정 존재 여부를 숨긴다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일").fill("nobody-not-registered@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("wrong-password-1");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.locator("p[role='alert']")).toContainText(LOGIN_ERROR, { timeout: 15000 });
  await expect(page.getByText("등록되지 않은 이메일")).toHaveCount(0);
  await expect(page).toHaveURL(/\/login/);
});

test("잘못된 callback은 오류 화면으로 간다", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/\/auth\/error/);
  await expect(page.getByText("비밀번호 재설정 링크가 만료되었거나")).toBeVisible();
  await expect(page.getByRole("link", { name: "새 링크 요청" })).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인으로 돌아가기" })).toBeVisible();
});

test("잘못된 code도 무한 로딩 없이 오류 화면으로 간다", async ({ page }) => {
  await page.goto("/auth/callback?code=invalid-code-value");
  await expect(page.getByText("비밀번호 재설정 링크가 만료되었거나")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("link", { name: "새 링크 요청" })).toBeVisible();
});

test("회원가입 비밀번호 확인이 다르면 전송하지 않는다", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("이메일").fill("qa-mismatch@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("long-enough");
  await page.getByLabel("비밀번호 확인").fill("different1");
  await page.getByRole("button", { name: "회원가입" }).click();
  await expect(page.locator("p[role='alert']")).toContainText("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
  await expect(page.getByRole("button", { name: "회원가입" })).toBeVisible();
});

test("짧은 비밀번호는 가입을 막는다", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("이메일").fill("qa-short@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("short");
  await page.getByLabel("비밀번호 확인").fill("short");
  await page.getByRole("button", { name: "회원가입" }).click();
  await expect(page.locator("p[role='alert']")).toHaveText("비밀번호는 최소 8자 이상 입력해 주세요.");
});

test("미가입 이메일 재설정도 같은 안내를 보여준다", async ({ page }) => {
  const unique = `unregistered-${Date.now()}@example.invalid`;
  await page.goto("/forgot-password");
  await page.getByLabel("이메일").fill(unique);
  await page.getByRole("button", { name: "재설정 링크 보내기" }).click();
  await expect(page.getByText(RESET_COPY)).toBeVisible();
  await expect(page.getByText("가입되지 않은 이메일")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "회원가입" })).toBeVisible();
  await expect(page.getByRole("button", { name: /다시 보낼 수 있습니다|메일 다시 보내기/ })).toBeDisabled();
});

const hasCreds = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

test("정상 로그인 후 세션이 유지된다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page).not.toHaveURL(/\/login/);
});

test("로그인 후 next 경로로 돌아간다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/settings/);
});

test("로그아웃 후 보호 페이지에 못 들어간다", async ({ page }) => {
  test.skip(!hasCreds, "E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 없음");
  await page.goto("/login");
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_USER_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/history");
  await expect(page).toHaveURL(/\/login/);
});
