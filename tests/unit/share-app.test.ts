import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_VERSION } from "@/lib/app-version";
import {
  APP_SHARE_TEXT,
  APP_SHARE_TITLE,
  APP_SHARE_URL,
  appShareContainsPersonalData,
  prayerBookShareData,
} from "@/lib/share-app";

function readSource(relative: string) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

const personal = [
  "user@example.com",
  "login_id_jin",
  "박진영",
  "하준",
  "김태신",
  "건강하게 해주세요",
  "용서할사람",
  "어머니",
  "허리디스크",
  "auth-user-uuid-1234",
  "access-token-example",
  "refresh-token-example",
];

describe("기도훈련집 앱 공유 payload", () => {
  it("운영 URL, 앱 이름, 소개 문구만 담는다", () => {
    const payload = prayerBookShareData();
    expect(payload.title).toBe("기도훈련집");
    expect(payload.title).toBe(APP_SHARE_TITLE);
    expect(payload.url).toBe("https://prayer-book-chi.vercel.app/");
    expect(payload.url).toBe(APP_SHARE_URL);
    expect(payload.text).toBe(APP_SHARE_TEXT);
    expect(payload.text).toContain("기도훈련집을 공유합니다.");
    expect(payload.text).toContain("매일 기도하며 기도 진행 상황을 기록할 수 있는 기도훈련집입니다.");
    expect(payload.text).not.toContain("http");
    expect(payload.text).not.toContain(payload.url);
  });

  it("사용자 정보, 기도 횟수, 토큰을 포함하지 않는다", () => {
    const payload = prayerBookShareData();
    expect(appShareContainsPersonalData(payload, personal)).toBe(false);
    expect(payload.url).not.toMatch(/[?&]/);
    expect(payload.text).not.toContain("오늘");
    expect(payload.text).not.toContain("Total");
    expect(payload.text).not.toContain("누적");
  });

  it("package.json 버전을 한 곳에서 사용한다", () => {
    const pkg = JSON.parse(readSource("package.json")) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    expect(readSource("components/settings/AppInfoSection.tsx")).toContain("APP_VERSION");
    expect(readSource("components/settings/AppInfoSection.tsx")).not.toContain("v1.0.0");
  });
});

describe("앱 공유와 오늘의 기록 공유 분리", () => {
  const settings = readSource("components/settings/SettingsView.tsx");
  const info = readSource("components/settings/AppInfoSection.tsx");
  const sheet = readSource("components/settings/AppShareSheet.tsx");
  const shareApp = readSource("lib/share-app.ts");
  const todayDialog = readSource("components/dashboard/ShareContentDialog.tsx");

  it("설정 하단에 앱 정보 및 공유 섹션을 두고 설치 안내와 버전을 함께 둔다", () => {
    expect(settings).toContain("AppInfoSection");
    expect(settings.indexOf("<AppInfoSection")).toBeGreaterThan(settings.indexOf("계정"));
    expect(settings.indexOf("<AppInfoSection")).toBeLessThan(settings.indexOf("저작권"));
    expect(info).toContain("앱 정보 및 공유");
    expect(info).toContain("기도훈련집 공유하기");
    expect(info).toContain("가족과 지인에게 공유하기");
    expect(info).toContain("앱 설치 안내");
    expect(info).toContain("홈 화면에 설치하여 앱처럼 사용할 수 있습니다.");
    expect(info).toContain('href="/install"');
    expect(info).toContain("버전 정보");
    expect(info).not.toContain("공유하면 앱이 설치");
  });

  it("공유하기를 누르기 전에 Bottom Sheet를 연다", () => {
    expect(info).toContain("AppShareSheet");
    expect(sheet).toContain('title="기도훈련집 공유"');
    expect(sheet).toContain('variant="sheet"');
    expect(sheet).toContain("showHandle");
    expect(sheet).toContain("공유하기");
    expect(sheet).toContain("링크 복사");
    expect(sheet).toContain("취소");
    expect(sheet).toContain("APP_SHARE_URL");
    expect(sheet).toContain("sharePrayerBookApp");
    expect(sheet).toContain("copyPrayerBookUrl");
    expect(sheet).not.toContain("navigator.share()");
  });

  it("오늘의 기록 공유 로직을 교체하지 않는다", () => {
    expect(todayDialog).not.toContain("sharePrayerBookApp");
    expect(todayDialog).not.toContain("APP_SHARE_URL");
    expect(todayDialog).toContain("shareOrCopyText({ text: next.editedText })");
    expect(shareApp).not.toContain("shareOrCopyText");
    expect(shareApp).not.toContain("formatDaily");
    expect(settings).not.toContain("ShareContentDialog");
  });

  it("Supabase나 공유 로그를 추가하지 않는다", () => {
    for (const source of [shareApp, sheet, info]) {
      expect(source).not.toMatch(/supabase/i);
      expect(source).not.toContain("createBrowserSupabaseClient");
      expect(source).not.toContain(".insert");
      expect(source).not.toContain(".rpc");
      expect(source).not.toContain("share_count");
      expect(source).not.toContain("fetch(");
    }
  });

  it("기존 설정 항목을 유지한다", () => {
    expect(settings).toContain("읽기 설정");
    expect(settings).toContain("배우자 기도 선택");
    expect(settings).toContain("이름·중보기도");
    expect(settings).toContain("기도 횟수 관리");
    expect(settings).toContain("AccountSecurity");
    expect(settings).toContain("로그아웃");
    expect(settings).toContain("회원 탈퇴");
  });
});
