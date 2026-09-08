import { formatKoreanDate } from "@/lib/progress/timezone";

export const SHARE_RECORD_TITLE = "기도훈련집 오늘의 기록";
export const SHARE_TEXT_MAX_LENGTH = 2000;

export const SHARE_FIELD_IDS = ["today", "lifetime", "total", "progress"] as const;
export type ShareFieldId = (typeof SHARE_FIELD_IDS)[number];
export type ShareFieldSelection = Record<ShareFieldId, boolean>;

export const DEFAULT_SHARE_SELECTION: ShareFieldSelection = {
  today: true,
  lifetime: true,
  total: true,
  progress: true,
};

export const SHARE_FIELD_LABELS: Record<ShareFieldId, string> = {
  today: "오늘 기도 횟수",
  lifetime: "지금까지 누적 기도 횟수",
  total: "전체 완료 독수",
  progress: "현재 독수 진행 상태",
};

export const SHARE_DIALOG_TITLE = "오늘의 기록";
export const SHARE_DIALOG_DESCRIPTION =
  "기록을 선택하고 문구를 편집한 뒤 복사하거나 공유할 수 있습니다. 사용한 형식은 다음에 다시 쓰입니다.";
export const SHARE_NO_FIELDS_MESSAGE = "공유할 기록을 하나 이상 선택해 주세요.";
export const SHARE_EMPTY_TEXT_MESSAGE = "복사할 내용을 입력해 주세요.";
export const SHARE_TOO_LONG_MESSAGE = "내용은 2,000자까지 복사하거나 공유할 수 있습니다.";
export const SHARE_SELECTION_CHANGED_MESSAGE = "공유할 기록 선택이 변경되었습니다.";
export const COPY_SUCCESS_MESSAGE = "편집한 기도 기록을 복사했습니다.";
export const COPY_FAILURE_MESSAGE = "기도 기록을 복사하지 못했습니다.\n다시 시도해 주세요.";
export const SHARE_FAILURE_MESSAGE = "기도 기록을 공유하지 못했습니다.\n다시 시도해 주세요.";
export const SHARE_COPY_FALLBACK_MESSAGE = "이 브라우저에서는 공유창을 열 수 없어\n편집한 내용을 복사했습니다.";

export type ShareRecordInput = {
  localDate: string;
  todayCount: number;
  lifetimeCount: number;
  totalCompleted: number;
  currentRound: number;
  currentCompletedCount: number;
  eligibleCount: number;
};

export type ShareDialogState = {
  selected: ShareFieldSelection;
  generatedText: string;
  editedText: string;
  isDirty: boolean;
  selectionChangedWhileDirty: boolean;
};

export type ShareFormatPreference = {
  selected: ShareFieldSelection;
  customTemplate: string | null;
};

export function emptyShareFormat(): ShareFormatPreference {
  return { selected: { ...DEFAULT_SHARE_SELECTION }, customTemplate: null };
}

export function hasAnyShareField(selected: ShareFieldSelection): boolean {
  return SHARE_FIELD_IDS.some((id) => selected[id]);
}

export function formatShareFieldLine(id: ShareFieldId, input: ShareRecordInput): string {
  switch (id) {
    case "today":
      return `오늘 총 ${input.todayCount}회 기도했습니다.`;
    case "lifetime":
      return `지금까지 총 ${input.lifetimeCount}회 기도했습니다.`;
    case "total":
      return `Total ${input.totalCompleted}독 완료`;
    case "progress":
      return `${input.currentRound}독 진행 중 ${input.currentCompletedCount} / ${input.eligibleCount}`;
  }
}

export function formatShareRecordText(
  input: ShareRecordInput,
  selected: ShareFieldSelection = DEFAULT_SHARE_SELECTION,
): string {
  const lines = [SHARE_RECORD_TITLE, "", formatKoreanDate(input.localDate)];
  for (const id of SHARE_FIELD_IDS) {
    if (selected[id]) lines.push(formatShareFieldLine(id, input));
  }
  return lines.join("\n");
}

export function shareTextLooksLikeDefaultTemplate(text: string): boolean {
  return (
    text.startsWith(`${SHARE_RECORD_TITLE}\n\n`) &&
    !text.includes("http://") &&
    !text.includes("https://") &&
    !text.includes("감사합니다") &&
    !/[\u{1F300}-\u{1FAFF}]/u.test(text)
  );
}

export function validateShareText(text: string): "ok" | "empty" | "too_long" {
  if (!text.trim()) return "empty";
  if (text.length > SHARE_TEXT_MAX_LENGTH) return "too_long";
  return "ok";
}

export function shareActionBlockReason(
  selected: ShareFieldSelection,
  editedText: string,
): "no_fields" | "empty" | "too_long" | null {
  if (!hasAnyShareField(selected)) return "no_fields";
  const validity = validateShareText(editedText);
  if (validity === "ok") return null;
  return validity;
}

export function shareActionBlockMessage(reason: ReturnType<typeof shareActionBlockReason>): string | null {
  if (reason === "no_fields") return SHARE_NO_FIELDS_MESSAGE;
  if (reason === "empty") return SHARE_EMPTY_TEXT_MESSAGE;
  if (reason === "too_long") return SHARE_TOO_LONG_MESSAGE;
  return null;
}

const DATE_LINE = /^\d{4}년 \d{1,2}월 \d{1,2}일$/;
const SHARE_LINE_MATCHERS: Array<{ id: ShareFieldId; test: (line: string) => boolean }> = [
  { id: "today", test: (line) => /^오늘 총 \d+회 기도했습니다\.$/.test(line) },
  { id: "lifetime", test: (line) => /^지금까지 총 \d+회 기도했습니다\.$/.test(line) },
  { id: "total", test: (line) => /^Total \d+독 완료$/.test(line) },
  { id: "progress", test: (line) => /^\d+독 진행 중 \d+ \/ \d+$/.test(line) },
];

export function parseShareSelection(value: unknown): ShareFieldSelection {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const selected: ShareFieldSelection = {
    today: row.today !== false,
    lifetime: row.lifetime !== false,
    total: row.total !== false,
    progress: row.progress !== false,
  };
  return hasAnyShareField(selected) ? selected : { ...DEFAULT_SHARE_SELECTION };
}

export function parseShareFormat(value: {
  share_selected_fields?: unknown;
  share_custom_template?: unknown;
} | null | undefined): ShareFormatPreference {
  const custom =
    typeof value?.share_custom_template === "string" ? value.share_custom_template.slice(0, SHARE_TEXT_MAX_LENGTH) : "";
  return {
    selected: parseShareSelection(value?.share_selected_fields),
    customTemplate: custom.trim() ? custom : null,
  };
}

export function shareFormatFromState(state: ShareDialogState): ShareFormatPreference | null {
  if (!hasAnyShareField(state.selected)) return null;
  return {
    selected: { ...state.selected },
    customTemplate: state.isDirty ? state.editedText : null,
  };
}

export function refreshShareTemplate(
  template: string,
  input: ShareRecordInput,
  selected: ShareFieldSelection,
): string {
  const date = formatKoreanDate(input.localDate);
  const next = template.replace(/\r\n/g, "\n").split("\n").flatMap((line) => {
    if (DATE_LINE.test(line)) return [date];
    const field = SHARE_LINE_MATCHERS.find((item) => item.test(line));
    if (!field) return [line];
    return selected[field.id] ? [formatShareFieldLine(field.id, input)] : [];
  });
  const text = next.join("\n");
  return text.length > SHARE_TEXT_MAX_LENGTH ? text.slice(0, SHARE_TEXT_MAX_LENGTH) : text;
}

export function createShareDialogState(
  input: ShareRecordInput,
  saved: ShareFormatPreference | null = null,
): ShareDialogState {
  const selected =
    saved?.selected && hasAnyShareField(saved.selected) ? { ...saved.selected } : { ...DEFAULT_SHARE_SELECTION };
  const generated = formatShareRecordText(input, selected);
  const edited = saved?.customTemplate ? refreshShareTemplate(saved.customTemplate, input, selected) : generated;
  return {
    selected,
    generatedText: generated,
    editedText: edited,
    isDirty: edited !== generated,
    selectionChangedWhileDirty: false,
  };
}

export function applyShareFieldToggle(
  state: ShareDialogState,
  field: ShareFieldId,
  input: ShareRecordInput,
): ShareDialogState {
  const selected = { ...state.selected, [field]: !state.selected[field] };
  if (!hasAnyShareField(selected)) {
    return { ...state, selected };
  }
  const generated = formatShareRecordText(input, selected);
  if (state.isDirty) {
    return {
      ...state,
      selected,
      generatedText: generated,
      selectionChangedWhileDirty: true,
    };
  }
  return {
    ...state,
    selected,
    generatedText: generated,
    editedText: generated,
    selectionChangedWhileDirty: false,
  };
}

export function keepEditedShareText(state: ShareDialogState): ShareDialogState {
  return { ...state, selectionChangedWhileDirty: false };
}

export function rebuildShareTextFromSelection(state: ShareDialogState, input: ShareRecordInput): ShareDialogState {
  if (!hasAnyShareField(state.selected)) return { ...state, selectionChangedWhileDirty: false };
  const generated = formatShareRecordText(input, state.selected);
  return {
    ...state,
    generatedText: generated,
    editedText: generated,
    isDirty: false,
    selectionChangedWhileDirty: false,
  };
}

export function editShareText(state: ShareDialogState, editedText: string): ShareDialogState {
  return {
    ...state,
    editedText,
    isDirty: editedText !== state.generatedText,
  };
}

export function refreshShareDialogStats(state: ShareDialogState, input: ShareRecordInput): ShareDialogState {
  if (!hasAnyShareField(state.selected)) return state;
  const generated = formatShareRecordText(input, state.selected);
  if (state.isDirty) {
    return { ...state, generatedText: generated };
  }
  return {
    ...state,
    generatedText: generated,
    editedText: generated,
  };
}
