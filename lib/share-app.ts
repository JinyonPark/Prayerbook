import { PRODUCTION_ORIGIN } from "@/lib/auth/site-url";
import { copyTextToClipboard, isAbortError, type ShareOutcome } from "@/lib/progress/clipboard";

export const APP_SHARE_URL = `${PRODUCTION_ORIGIN}/`;
export const APP_SHARE_TITLE = "기도훈련집";
export const APP_SHARE_TEXT =
  "기도훈련집을 공유합니다.\n\n매일 기도하며 기도 진행 상황을 기록할 수 있는 기도훈련집입니다.";
export const APP_SHARE_COPY_SUCCESS = "링크가 복사되었습니다.";
export const APP_SHARE_COPY_FAILURE = "링크를 복사하지 못했습니다.\n주소를 길게 눌러 직접 복사해 주세요.";

export type PrayerBookShareData = {
  title: string;
  text: string;
  url: string;
};

export function prayerBookShareData(): PrayerBookShareData {
  return {
    title: APP_SHARE_TITLE,
    text: APP_SHARE_TEXT,
    url: APP_SHARE_URL,
  };
}

export async function copyPrayerBookUrl(): Promise<boolean> {
  return copyTextToClipboard(APP_SHARE_URL);
}

export async function sharePrayerBookApp(): Promise<ShareOutcome> {
  const data = prayerBookShareData();
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
        const copied = await copyPrayerBookUrl();
        return copied ? "copied" : "failed";
      }
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "cancelled";
      const copied = await copyPrayerBookUrl();
      return copied ? "copied" : "failed";
    }
  }
  const copied = await copyPrayerBookUrl();
  return copied ? "copied" : "failed";
}

export function appShareContainsPersonalData(
  payload: PrayerBookShareData,
  personalValues: Array<string | null | undefined>,
): boolean {
  const haystack = `${payload.title}\n${payload.text}\n${payload.url}`;
  return personalValues.some((value) => {
    const trimmed = value?.trim();
    return Boolean(trimmed && trimmed.length >= 2 && haystack.includes(trimmed));
  });
}
