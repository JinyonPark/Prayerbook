import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE_SELECTION,
  SHARE_TEXT_MAX_LENGTH,
  applyShareFieldToggle,
  createShareDialogState,
  editShareText,
  formatShareFieldValue,
  formatShareRecordText,
  hasAnyShareField,
  parseShareFormat,
  rebuildShareTextFromSelection,
  refreshShareTemplate,
  shareActionBlockReason,
  shareFormatFromState,
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

  it("오늘 기도만 선택하면 오늘 숫자만 들어가고 문구는 남는다", () => {
    expect(
      formatShareRecordText(sample, { today: true, lifetime: false, total: false, progress: false }),
    ).toBe(
      [
        "기도훈련집 오늘의 기록",
        "",
        "2026년 9월 8일",
        "오늘 총 16회 기도했습니다.",
        "지금까지 총 회 기도했습니다.",
        "Total 독 완료",
        "독 진행 중  / ",
      ].join("\n"),
    );
  });

  it("누적 기도만 선택하면 누적 숫자만 들어간다", () => {
    const text = formatShareRecordText(sample, { today: false, lifetime: true, total: false, progress: false });
    expect(text).toContain("오늘 총 회 기도했습니다.");
    expect(text).toContain("지금까지 총 79회 기도했습니다.");
    expect(text).toContain("Total 독 완료");
    expect(text).not.toMatch(/오늘 총 \d+회/);
  });

  it("Total만 선택하면 Total 숫자만 들어간다", () => {
    const text = formatShareRecordText(sample, { today: false, lifetime: false, total: true, progress: false });
    expect(text).toContain("Total 3독 완료");
    expect(text).not.toContain("오늘 총 16회");
    expect(text).not.toContain("지금까지 총 79회");
  });

  it("현재 진행만 선택하면 진행 숫자만 들어간다", () => {
    const text = formatShareRecordText(sample, { today: false, lifetime: false, total: false, progress: true });
    expect(text).toContain("4독 진행 중 1 / 26");
    expect(text).toContain("오늘 총 회 기도했습니다.");
  });

  it("오늘 기도와 Total만 선택해도 문구 순서는 고정된다", () => {
    const text = formatShareRecordText(sample, { today: true, lifetime: false, total: true, progress: false });
    expect(text).toContain("오늘 총 16회 기도했습니다.");
    expect(text).toContain("Total 3독 완료");
    expect(text.indexOf("오늘 총 16회")).toBeLessThan(text.indexOf("Total 3독"));
  });

  it("선택 순서와 관계없이 문장 순서는 고정된다", () => {
    const toggledProgressFirst = applyShareFieldToggle(
      applyShareFieldToggle(
        createShareDialogState(sample),
        "today",
        sample,
      ),
      "lifetime",
      sample,
    );
    expect(toggledProgressFirst.editedText).toBe(
      [
        "기도훈련집 오늘의 기록",
        "",
        "2026년 9월 8일",
        "오늘 총 회 기도했습니다.",
        "지금까지 총 회 기도했습니다.",
        "Total 3독 완료",
        "4독 진행 중 1 / 26",
      ].join("\n"),
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

  it("체크 항목의 값은 숫자로만 보여 준다", () => {
    expect(formatShareFieldValue("today", sample)).toBe("16");
    expect(formatShareFieldValue("lifetime", sample)).toBe("79");
    expect(formatShareFieldValue("total", sample)).toBe("3");
    expect(formatShareFieldValue("progress", sample)).toBe("4 · 1 / 26");
  });

  it("네 항목을 모두 해제해도 문구가 있으면 복사할 수 있다", () => {
    const none = { today: false, lifetime: false, total: false, progress: false };
    expect(hasAnyShareField(none)).toBe(false);
    expect(shareActionBlockReason(none, formatShareRecordText(sample, none))).toBeNull();
    expect(shareActionBlockReason(none, "   ")).toBe("empty");
  });
});

describe("복사·공유 형식 저장", () => {
  it("저장한 선택 항목으로 다음 문구를 만든다", () => {
    const saved = parseShareFormat({
      share_selected_fields: { today: true, lifetime: false, total: true, progress: false },
      share_custom_template: null,
    });
    const state = createShareDialogState(sample, saved);
    expect(state.selected).toEqual({ today: true, lifetime: false, total: true, progress: false });
    expect(state.editedText).toContain("오늘 총 16회 기도했습니다.");
    expect(state.editedText).toContain("Total 3독 완료");
    expect(state.editedText).not.toContain("지금까지 총 79회");
    expect(state.isDirty).toBe(false);
  });

  it("저장한 편집 문구는 날짜와 숫자만 오늘 값으로 바꾸고 나머지 형식은 유지한다", () => {
    const saved = parseShareFormat({
      share_selected_fields: { today: true, lifetime: true, total: true, progress: true },
      share_custom_template: [
        "오늘도 기도할 수 있어 감사합니다.",
        "",
        "기도훈련집 오늘의 기록",
        "",
        "2026년 9월 7일",
        "오늘 총 10회 기도했습니다.",
        "지금까지 총 70회 기도했습니다.",
        "Total 3독 완료",
        "4독 진행 중 1 / 26",
      ].join("\n"),
    });
    const nextDay = { ...sample, localDate: "2026-09-09", todayCount: 20, lifetimeCount: 90 };
    const text = refreshShareTemplate(saved.customTemplate ?? "", nextDay, saved.selected);
    expect(text).toBe(
      [
        "오늘도 기도할 수 있어 감사합니다.",
        "",
        "기도훈련집 오늘의 기록",
        "",
        "2026년 9월 9일",
        "오늘 총 20회 기도했습니다.",
        "지금까지 총 90회 기도했습니다.",
        "Total 3독 완료",
        "4독 진행 중 1 / 26",
      ].join("\n"),
    );
    const restored = createShareDialogState(nextDay, saved);
    expect(restored.editedText).toBe(text);
    expect(restored.isDirty).toBe(true);
  });

  it("기본 문구를 쓰면 다음에도 기본 형식으로 연다", () => {
    let state = createShareDialogState(sample);
    expect(shareFormatFromState(state).customTemplate).toBeNull();
    state = editShareText(state, "직접 작성한 문구", sample);
    expect(shareFormatFromState(state).customTemplate).toBe("직접 작성한 문구");
  });
});

describe("복사·공유 공통 팝업", () => {
  it("복사와 공유가 같은 editedText를 사용한다", () => {
    let state = createShareDialogState(sample);
    state = editShareText(state, "오늘도 기도할 수 있어 감사합니다.", sample);
    expect(state.editedText).toBe("오늘도 기도할 수 있어 감사합니다.");
    expect(state.editedText).not.toBe(formatShareRecordText(sample, DEFAULT_SHARE_SELECTION));
    expect(shareActionBlockReason(state.selected, state.editedText)).toBeNull();
  });

  it("체크를 빼면 숫자만 사라지고 다시 켜면 숫자가 돌아온다", () => {
    let state = createShareDialogState(sample);
    expect(state.editedText).toContain("오늘 총 16회 기도했습니다.");
    state = applyShareFieldToggle(state, "today", sample);
    expect(state.editedText).toContain("오늘 총 회 기도했습니다.");
    expect(state.editedText).not.toMatch(/오늘 총 \d+회/);
    expect(state.editedText).toContain("지금까지 총 79회 기도했습니다.");
    state = applyShareFieldToggle(state, "today", sample);
    expect(state.editedText).toContain("오늘 총 16회 기도했습니다.");
    state = applyShareFieldToggle(state, "total", sample);
    expect(state.editedText).toContain("Total 독 완료");
    expect(state.editedText).not.toContain("Total 3독");
    state = applyShareFieldToggle(state, "total", sample);
    expect(state.editedText).toContain("Total 3독 완료");
  });

  it("직접 고친 문구에서도 숫자만 넣었다 뺀다", () => {
    let state = createShareDialogState(sample);
    state = editShareText(state, "기도훈련집 16독 누적 79독", sample);
    expect(state.editedText).toBe("기도훈련집 16독 누적 79독");
    state = applyShareFieldToggle(state, "today", sample);
    expect(state.editedText).toBe("기도훈련집 독 누적 79독");
    state = applyShareFieldToggle(state, "today", sample);
    expect(state.editedText).toBe("기도훈련집 16독 누적 79독");
    state = applyShareFieldToggle(state, "lifetime", sample);
    expect(state.editedText).toBe("기도훈련집 16독 누적 독");
    state = applyShareFieldToggle(state, "lifetime", sample);
    expect(state.editedText).toBe("기도훈련집 16독 누적 79독");
  });

  it("기본 문구로 되돌리기가 동작한다", () => {
    let state = createShareDialogState(sample);
    state = editShareText(state, "직접 작성한 문구", sample);
    state = applyShareFieldToggle(state, "today", sample);
    state = rebuildShareTextFromSelection(state, sample);
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
