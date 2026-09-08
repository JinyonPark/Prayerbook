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
  "기본 문구는 그대로 두고, 선택한 기록의 숫자만 넣거나 빼서 복사하거나 공유할 수 있습니다. 사용한 형식은 다음에 다시 쓰입니다.";
export const SHARE_EMPTY_TEXT_MESSAGE = "복사할 내용을 입력해 주세요.";
export const SHARE_TOO_LONG_MESSAGE = "내용은 2,000자까지 복사하거나 공유할 수 있습니다.";
export const COPY_SUCCESS_MESSAGE = "편집한 기도 기록을 복사했습니다.";
export const COPY_FAILURE_MESSAGE = "기도 기록을 복사하지 못했습니다.\n다시 시도해 주세요.";
export const SHARE_FAILURE_MESSAGE = "기도 기록을 공유하지 못했습니다.\n다시 시도해 주세요.";
export const SHARE_COPY_FALLBACK_MESSAGE = "이 브라우저에서는 공유창을 열 수 없어\n편집한 내용을 복사했습니다.";

export const DATE_TOKEN = "{{date}}";
export const TODAY_TOKEN = "{{today}}";
export const LIFETIME_TOKEN = "{{lifetime}}";
export const TOTAL_TOKEN = "{{total}}";
export const ROUND_TOKEN = "{{round}}";
export const CURRENT_TOKEN = "{{current}}";
export const ELIGIBLE_TOKEN = "{{eligible}}";

export const DEFAULT_SHARE_TEMPLATE = [
  SHARE_RECORD_TITLE,
  "",
  DATE_TOKEN,
  `오늘 총 ${TODAY_TOKEN}회 기도했습니다.`,
  `지금까지 총 ${LIFETIME_TOKEN}회 기도했습니다.`,
  `Total ${TOTAL_TOKEN}독 완료`,
  `${ROUND_TOKEN}독 진행 중 ${CURRENT_TOKEN} / ${ELIGIBLE_TOKEN}`,
].join("\n");

const FIELD_TOKENS: Record<ShareFieldId, string[]> = {
  today: [TODAY_TOKEN],
  lifetime: [LIFETIME_TOKEN],
  total: [TOTAL_TOKEN],
  progress: [ROUND_TOKEN, CURRENT_TOKEN, ELIGIBLE_TOKEN],
};

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
  template: string;
  editedText: string;
  isDirty: boolean;
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

export function isDefaultShareTemplate(template: string): boolean {
  return template.replace(/\r\n/g, "\n") === DEFAULT_SHARE_TEMPLATE;
}

export function formatShareFieldValue(id: ShareFieldId, input: ShareRecordInput): string {
  switch (id) {
    case "today":
      return String(input.todayCount);
    case "lifetime":
      return String(input.lifetimeCount);
    case "total":
      return String(input.totalCompleted);
    case "progress":
      return `${input.currentRound} · ${input.currentCompletedCount} / ${input.eligibleCount}`;
  }
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

function tokenValues(input: ShareRecordInput): Record<string, string> {
  return {
    [DATE_TOKEN]: formatKoreanDate(input.localDate),
    [TODAY_TOKEN]: String(input.todayCount),
    [LIFETIME_TOKEN]: String(input.lifetimeCount),
    [TOTAL_TOKEN]: String(input.totalCompleted),
    [ROUND_TOKEN]: String(input.currentRound),
    [CURRENT_TOKEN]: String(input.currentCompletedCount),
    [ELIGIBLE_TOKEN]: String(input.eligibleCount),
  };
}

export function renderShareTemplate(
  template: string,
  input: ShareRecordInput,
  selected: ShareFieldSelection = DEFAULT_SHARE_SELECTION,
): string {
  const values = tokenValues(input);
  let text = template.replace(/\r\n/g, "\n").replaceAll(DATE_TOKEN, values[DATE_TOKEN]);
  for (const id of SHARE_FIELD_IDS) {
    const fill = selected[id];
    for (const token of FIELD_TOKENS[id]) {
      text = text.replaceAll(token, fill ? values[token] : "");
    }
  }
  return text.length > SHARE_TEXT_MAX_LENGTH ? text.slice(0, SHARE_TEXT_MAX_LENGTH) : text;
}

export function formatShareRecordText(
  input: ShareRecordInput,
  selected: ShareFieldSelection = DEFAULT_SHARE_SELECTION,
): string {
  return renderShareTemplate(DEFAULT_SHARE_TEMPLATE, input, selected);
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
  _selected: ShareFieldSelection,
  editedText: string,
): "empty" | "too_long" | null {
  const validity = validateShareText(editedText);
  if (validity === "ok") return null;
  return validity;
}

export function shareActionBlockMessage(reason: ReturnType<typeof shareActionBlockReason>): string | null {
  if (reason === "empty") return SHARE_EMPTY_TEXT_MESSAGE;
  if (reason === "too_long") return SHARE_TOO_LONG_MESSAGE;
  return null;
}

const DATE_LINE = /^\d{4}년 \d{1,2}월 \d{1,2}일$/gm;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceStandaloneNumber(text: string, value: string, token: string): string {
  if (!value || text.includes(token)) return text;
  const pattern = new RegExp(`(?<!\\d)${escapeRegExp(value)}(?!\\d)`);
  return text.replace(pattern, token);
}

export function tokenizeShareTemplate(text: string, input: ShareRecordInput): string {
  if (!text.trim()) return DEFAULT_SHARE_TEMPLATE;
  let next = text.replace(/\r\n/g, "\n");
  const alreadyTokenized = Object.values(FIELD_TOKENS).some((tokens) => tokens.some((token) => next.includes(token)));
  if (alreadyTokenized) return next.replace(DATE_LINE, DATE_TOKEN);

  next = next.replace(DATE_LINE, DATE_TOKEN);
  next = next.replace(/^오늘 총 \d+회 기도했습니다\.$/gm, `오늘 총 ${TODAY_TOKEN}회 기도했습니다.`);
  next = next.replace(/^지금까지 총 \d+회 기도했습니다\.$/gm, `지금까지 총 ${LIFETIME_TOKEN}회 기도했습니다.`);
  next = next.replace(/^Total \d+독 완료$/gm, `Total ${TOTAL_TOKEN}독 완료`);
  next = next.replace(/^\d+독 진행 중 \d+ \/ \d+$/gm, `${ROUND_TOKEN}독 진행 중 ${CURRENT_TOKEN} / ${ELIGIBLE_TOKEN}`);
  next = next.replace(
    `${input.currentCompletedCount} / ${input.eligibleCount}`,
    `${CURRENT_TOKEN} / ${ELIGIBLE_TOKEN}`,
  );
  const replacements: Array<{ value: string; token: string }> = [
    { value: String(input.lifetimeCount), token: LIFETIME_TOKEN },
    { value: String(input.todayCount), token: TODAY_TOKEN },
    { value: String(input.totalCompleted), token: TOTAL_TOKEN },
    { value: String(input.currentRound), token: ROUND_TOKEN },
    { value: String(input.currentCompletedCount), token: CURRENT_TOKEN },
    { value: String(input.eligibleCount), token: ELIGIBLE_TOKEN },
  ].sort((a, b) => b.value.length - a.value.length);
  for (const item of replacements) {
    next = replaceStandaloneNumber(next, item.value, item.token);
  }
  return next;
}

function restoreUncheckedTokens(previous: string, next: string, selected: ShareFieldSelection): string {
  let result = next;
  const restorers: Array<{ selected: boolean; empty: string; tokenized: string; token: string }> = [
    {
      selected: selected.today,
      empty: "오늘 총 회",
      tokenized: `오늘 총 ${TODAY_TOKEN}회`,
      token: TODAY_TOKEN,
    },
    {
      selected: selected.lifetime,
      empty: "지금까지 총 회",
      tokenized: `지금까지 총 ${LIFETIME_TOKEN}회`,
      token: LIFETIME_TOKEN,
    },
    {
      selected: selected.total,
      empty: "Total 독 완료",
      tokenized: `Total ${TOTAL_TOKEN}독 완료`,
      token: TOTAL_TOKEN,
    },
    {
      selected: selected.progress,
      empty: "독 진행 중  / ",
      tokenized: `${ROUND_TOKEN}독 진행 중 ${CURRENT_TOKEN} / ${ELIGIBLE_TOKEN}`,
      token: ROUND_TOKEN,
    },
  ];
  for (const item of restorers) {
    if (item.selected || result.includes(item.token) || !previous.includes(item.token)) continue;
    if (result.includes(item.empty)) result = result.replace(item.empty, item.tokenized);
  }
  return result;
}

export function extractShareTemplate(
  text: string,
  input: ShareRecordInput,
  selected: ShareFieldSelection,
  previousTemplate: string,
): string {
  const normalized = text.replace(/\r\n/g, "\n");
  if (renderShareTemplate(previousTemplate, input, selected) === normalized) return previousTemplate;

  let next = normalized.replace(DATE_LINE, DATE_TOKEN);
  if (selected.progress) {
    next = next.replace(
      `${input.currentCompletedCount} / ${input.eligibleCount}`,
      `${CURRENT_TOKEN} / ${ELIGIBLE_TOKEN}`,
    );
    next = replaceStandaloneNumber(next, String(input.currentRound), ROUND_TOKEN);
    next = replaceStandaloneNumber(next, String(input.currentCompletedCount), CURRENT_TOKEN);
    next = replaceStandaloneNumber(next, String(input.eligibleCount), ELIGIBLE_TOKEN);
  }
  if (selected.lifetime) next = replaceStandaloneNumber(next, String(input.lifetimeCount), LIFETIME_TOKEN);
  if (selected.today) next = replaceStandaloneNumber(next, String(input.todayCount), TODAY_TOKEN);
  if (selected.total) next = replaceStandaloneNumber(next, String(input.totalCompleted), TOTAL_TOKEN);
  return restoreUncheckedTokens(previousTemplate, next, selected);
}

export function parseShareSelection(value: unknown): ShareFieldSelection {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const selected: ShareFieldSelection = {
    today: row.today !== false,
    lifetime: row.lifetime !== false,
    total: row.total !== false,
    progress: row.progress !== false,
  };
  return selected;
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

export function shareFormatFromState(state: ShareDialogState): ShareFormatPreference {
  return {
    selected: { ...state.selected },
    customTemplate: isDefaultShareTemplate(state.template) ? null : state.template,
  };
}

export function refreshShareTemplate(
  template: string,
  input: ShareRecordInput,
  selected: ShareFieldSelection,
): string {
  return renderShareTemplate(tokenizeShareTemplate(template, input), input, selected);
}

export function createShareDialogState(
  input: ShareRecordInput,
  saved: ShareFormatPreference | null = null,
): ShareDialogState {
  const selected = saved?.selected ?? { ...DEFAULT_SHARE_SELECTION };
  const template = saved?.customTemplate
    ? tokenizeShareTemplate(saved.customTemplate, input)
    : DEFAULT_SHARE_TEMPLATE;
  return {
    selected,
    template,
    editedText: renderShareTemplate(template, input, selected),
    isDirty: !isDefaultShareTemplate(template),
  };
}

export function applyShareFieldToggle(
  state: ShareDialogState,
  field: ShareFieldId,
  input: ShareRecordInput,
): ShareDialogState {
  const selected = { ...state.selected, [field]: !state.selected[field] };
  return {
    ...state,
    selected,
    editedText: renderShareTemplate(state.template, input, selected),
  };
}

export function rebuildShareTextFromSelection(state: ShareDialogState, input: ShareRecordInput): ShareDialogState {
  return {
    selected: state.selected,
    template: DEFAULT_SHARE_TEMPLATE,
    editedText: renderShareTemplate(DEFAULT_SHARE_TEMPLATE, input, state.selected),
    isDirty: false,
  };
}

export function editShareText(state: ShareDialogState, editedText: string, input: ShareRecordInput): ShareDialogState {
  const template = extractShareTemplate(editedText, input, state.selected, state.template);
  return {
    ...state,
    template,
    editedText,
    isDirty: !isDefaultShareTemplate(template),
  };
}

export function refreshShareDialogStats(state: ShareDialogState, input: ShareRecordInput): ShareDialogState {
  return {
    ...state,
    editedText: renderShareTemplate(state.template, input, state.selected),
  };
}
