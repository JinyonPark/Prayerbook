import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE_SELECTION,
  SHARE_TEXT_MAX_LENGTH,
  applyShareFieldToggle,
  createShareDialogState,
  editShareText,
  formatShareRecordText,
  hasAnyShareField,
  keepEditedShareText,
  rebuildShareTextFromSelection,
  shareActionBlockReason,
  shareDialogTitle,
  sharePrimaryAction,
  shareTextLooksLikeDefaultTemplate,
  type ShareRecordInput,
} from "@/lib/progress/share-content";
import {
  applySuccessfulCompleteToDaily,
  emptyDailySummary,
  formatDailyCopyText,
  formatDailyPreviewText,
  formatDailyShareText,
  shareTextContainsForbiddenPersonalData,
} from "@/lib/progress/daily";

const sample: ShareRecordInput = {
  localDate: "2026-09-08",
  todayCount: 16,
  lifetimeCount: 79,
  totalCompleted: 3,
  currentRound: 4,
  currentCompletedCount: 1,
  eligibleCount: 26,
};

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
];

describe("기본 공유 문구", () => {
  it("네 항목을 모두 선택하면 지정된 형식과 줄바꿈이 일치한다", () => {
    const text = formatShareRecordText(sample);
    expect(text).toBe(
      [
        "기도훈련집 오늘의 기록",
        "",
        "2026년 9월 8일",
        "오늘 총 16회 기도했습니다.",
        "지금까지 총 79회 기도했습니다.",
        "Total 3독 완료",
        "4독 진행 중 1 / 26",
      ].join("\n"),
    );
    expect(text).not.toContain("http");
    expect(text).not.toContain("감사합니다");
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(shareTextLooksLikeDefaultTemplate(text)).toBe(true);
  });

  it("오늘 기도만 선택하면 해당 문장만 포함한다", () => {
    expect(
      formatShareRecordText(sample, { today: true, lifetime: false, total: false, progress: false }),
    ).toBe(`기도훈련집 오늘의 기록\n\n2026년 9월 8일\n오늘 총 16회 기도했습니다.`);
  });

  it("누적 기도만 선택하면 해당 문장만 포함한다", () => {
    expect(
      formatShareRecordText(sample, { today: false, lifetime: true, total: false, progress: false }),
    ).toBe(`기도훈련집 오늘의 기록\n\n2026년 9월 8일\n지금까지 총 79회 기도했습니다.`);
  });

  it("Total만 선택하면 해당 문장만 포함한다", () => {
    expect(
      formatShareRecordText(sample, { today: false, lifetime: false, total: true, progress: false }),
    ).toBe(`기도훈련집 오늘의 기록\n\n2026년 9월 8일\nTotal 3독 완료`);
  });

  it("현재 진행만 선택하면 해당 문장만 포함한다", () => {
    expect(
      formatShareRecordText(sample, { today: false, lifetime: false, total: false, progress: true }),
    ).toBe(`기도훈련집 오늘의 기록\n\n2026년 9월 8일\n4독 진행 중 1 / 26`);
  });

  it("오늘 기도와 Total만 선택해도 순서는 고정된다", () => {
    expect(
      formatShareRecordText(sample, { today: true, lifetime: false, total: true, progress: false }),
    ).toBe(`기도훈련집 오늘의 기록\n\n2026년 9월 8일\n오늘 총 16회 기도했습니다.\nTotal 3독 완료`);
  });

  it("선택 순서와 관계없이 문장 순서는 고정된다", () => {
    const toggledProgressFirst = applyShareFieldToggle(
      applyShareFieldToggle(
        createShareDialogState("copy", sample),
        "today",
        sample,
      ),
      "lifetime",
      sample,
    );
    expect(toggledProgressFirst.generatedText).toBe(
      `기도훈련집 오늘의 기록\n\n2026년 9월 8일\nTotal 3독 완료\n4독 진행 중 1 / 26`,
    );
  });

  it("0회와 0독도 정상 출력한다", () => {
    const text = formatShareRecordText({
      ...sample,
      todayCount: 0,
      lifetimeCount: 0,
      totalCompleted: 0,
      currentRound: 1,
      currentCompletedCount: 0,
      eligibleCount: 26,
    });
    expect(text).toContain("오늘 총 0회 기도했습니다.");
    expect(text).toContain("지금까지 총 0회 기도했습니다.");
    expect(text).toContain("Total 0독 완료");
    expect(text).toContain("1독 진행 중 0 / 26");
  });

  it("진행 분모를 입력값으로 출력하고 26을 하드코딩하지 않는다", () => {
    const text = formatShareRecordText({ ...sample, eligibleCount: 27 });
    expect(text).toContain("4독 진행 중 1 / 27");
    expect(text).not.toContain("/ 26");
  });

  it("네 항목을 모두 해제하면 복사와 공유를 막는다", () => {
    const none = { today: false, lifetime: false, total: false, progress: false };
    expect(hasAnyShareField(none)).toBe(false);
    expect(shareActionBlockReason(none, formatShareRecordText(sample))).toBe("no_fields");
  });
});

describe("팝업 모드", () => {
  it("copy 모드 제목과 주요 버튼이 복사다", () => {
    expect(shareDialogTitle("copy")).toBe("복사할 내용");
    expect(sharePrimaryAction("copy")).toBe("copy");
  });

  it("share 모드 제목과 주요 버튼이 공유다", () => {
    expect(shareDialogTitle("share")).toBe("공유할 내용");
    expect(sharePrimaryAction("share")).toBe("share");
  });

  it("닫은 뒤 다른 모드로 열면 이전 mode가 남지 않는다", () => {
    const copy = createShareDialogState("copy", sample);
    expect(copy.mode).toBe("copy");
    const share = createShareDialogState("share", sample);
    expect(share.mode).toBe("share");
    expect(share.mode).not.toBe(copy.mode);
  });
});

describe("편집값 보호", () => {
  it("복사와 공유가 같은 editedText를 사용한다", () => {
    let state = createShareDialogState("copy", sample);
    state = editShareText(state, "오늘도 기도할 수 있어 감사합니다.");
    expect(state.editedText).toBe("오늘도 기도할 수 있어 감사합니다.");
    expect(state.generatedText).toBe(formatShareRecordText(sample, DEFAULT_SHARE_SELECTION));
    expect(state.editedText).not.toBe(state.generatedText);
    expect(shareActionBlockReason(state.selected, state.editedText)).toBeNull();
  });

  it("사용자 편집 후 선택 변경은 편집값을 즉시 덮어쓰지 않는다", () => {
    let state = createShareDialogState("share", sample);
    state = editShareText(state, "직접 작성한 문구");
    state = applyShareFieldToggle(state, "today", sample);
    expect(state.editedText).toBe("직접 작성한 문구");
    expect(state.selectionChangedWhileDirty).toBe(true);
    state = keepEditedShareText(state);
    expect(state.editedText).toBe("직접 작성한 문구");
  });

  it("선택 항목으로 다시 만들기와 기본 문구로 되돌리기가 동작한다", () => {
    let state = createShareDialogState("copy", sample);
    state = editShareText(state, "직접 작성한 문구");
    state = applyShareFieldToggle(state, "today", sample);
    state = rebuildShareTextFromSelection(state, sample);
    expect(state.editedText).toBe(state.generatedText);
    expect(state.isDirty).toBe(false);
    expect(state.editedText).not.toContain("오늘 총 16회");
    expect(state.editedText).toContain("지금까지 총 79회 기도했습니다.");
  });

  it("공백 문구와 2,000자 초과는 복사·공유하지 않는다", () => {
    expect(shareActionBlockReason(DEFAULT_SHARE_SELECTION, "   ")).toBe("empty");
    expect(shareActionBlockReason(DEFAULT_SHARE_SELECTION, "a".repeat(SHARE_TEXT_MAX_LENGTH + 1))).toBe("too_long");
    expect(shareActionBlockReason(DEFAULT_SHARE_SELECTION, formatShareRecordText(sample))).toBeNull();
  });
});

describe("개인정보 제외", () => {
  it("기본 문구에 이메일, 이름, 소원, 질병명, 기도 항목명을 넣지 않는다", () => {
    const text = formatShareRecordText(sample);
    expect(shareTextContainsForbiddenPersonalData(text, personal)).toBe(false);
    expect(text).not.toContain("소원 기도");
    expect(text).not.toContain("user@example.com");
    expect(text).not.toContain("login_id");
    expect(text).not.toContain("display_name");
    expect(text).not.toContain("child_names");
    expect(text).not.toContain("evangelism_target_name");
    expect(text).not.toContain("wish_text");
    expect(text).not.toContain("disease_name");
  });
});

describe("완료 후 홈 캐시", () => {
  it("완료 성공 시 오늘 횟수와 누적 횟수를 함께 올린다", () => {
    const previous = emptyDailySummary("Asia/Seoul", "2026-09-08");
    const next = applySuccessfulCompleteToDaily(previous, {
      prayerItemId: "m1",
      prayerTitle: "새벽 기도",
      itemNumber: 1,
      category: "main",
    });
    expect(next.total_completion_count).toBe(1);
    expect(next.lifetime_completion_count).toBe(1);
    expect(
      applySuccessfulCompleteToDaily(next, {
        prayerItemId: "m1",
        prayerTitle: "새벽 기도",
        itemNumber: 1,
        category: "main",
        idempotent: true,
      }).lifetime_completion_count,
    ).toBe(1);
  });

  it("복사·공유·미리보기가 같은 기본 문구를 쓴다", () => {
    const summary = applySuccessfulCompleteToDaily(emptyDailySummary("Asia/Seoul", "2026-09-08"), {
      prayerItemId: "m1",
      prayerTitle: "새벽 기도",
      itemNumber: 1,
      category: "main",
    });
    const progress = {
      totalCompleted: 3,
      currentRound: 4,
      currentCompletedCount: 1,
      eligibleCount: 26,
    };
    expect(formatDailyCopyText(summary, progress)).toBe(formatDailyShareText(summary, progress));
    expect(formatDailyPreviewText(summary, progress)).toBe(formatDailyCopyText(summary, progress));
    expect(formatDailyCopyText(summary, progress)).not.toContain("새벽 기도");
    expect(formatDailyCopyText(summary, progress)).not.toContain("http");
  });
});
