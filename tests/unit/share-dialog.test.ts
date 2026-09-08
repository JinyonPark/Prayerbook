import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relative: string) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("복사·공유 공통 팝업", () => {
  const card = readSource("components/dashboard/TodayPrayerCard.tsx");
  const dialog = readSource("components/dashboard/ShareContentDialog.tsx");
  const modal = readSource("components/ui/Modal.tsx");

  it("홈 카드가 같은 ShareContentDialog를 한 번만 연다", () => {
    expect(card).toContain("ShareContentDialog");
    expect(card).not.toContain("<Modal");
    expect(dialog).toContain('openShareDialog("copy")');
    expect(dialog).toContain('openShareDialog("share")');
    expect(dialog.match(/<Modal/g)?.length).toBe(1);
  });

  it("copy와 share 제목·주요 버튼을 구분한다", () => {
    expect(dialog).toContain("shareDialogTitle");
    expect(dialog).toContain("현재 주요 동작은 복사입니다.");
    expect(dialog).toContain("현재 주요 동작은 공유입니다.");
    expect(dialog).toContain('aria-label="오늘의 기도 결과 복사"');
    expect(dialog).toContain('aria-label="오늘의 기도 결과 공유하기"');
  });

  it("중첩 Modal이나 두 번째 미리보기 팝업을 만들지 않는다", () => {
    expect(dialog).not.toContain("SharePreview");
    expect(dialog).not.toContain("ShareModal");
    expect(dialog).toContain("copyTextToClipboard(state.editedText)");
    expect(dialog).toContain("text: state.editedText");
    expect(dialog).not.toContain("localStorage");
    expect(dialog).not.toContain("dangerouslySetInnerHTML");
    expect(dialog).not.toContain("contenteditable");
  });

  it("실제 checkbox와 textarea, focus 복원, visualViewport Modal을 사용한다", () => {
    expect(dialog).toContain('type="checkbox"');
    expect(dialog).toContain("<textarea");
    expect(dialog).toContain("copyButtonRef");
    expect(dialog).toContain("shareButtonRef");
    expect(dialog).toContain("initialFocusRef");
    expect(modal).toContain("aria-modal");
    expect(modal).toContain("lockBodyScroll");
    expect(modal).toContain("useVisualViewport");
    expect(modal).toContain("safe-area-inset-bottom");
    expect(modal).toContain("lastFocus.current?.focus()");
  });
});
