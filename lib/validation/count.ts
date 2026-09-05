import { z } from "zod";
import { MAX_COMPLETION_COUNT } from "@/lib/progress/calculate";

export const completionCountSchema = z
  .number({
    required_error: "완료 횟수를 입력해 주세요.",
    invalid_type_error: "완료 횟수는 0 이상의 정수여야 합니다.",
  })
  .int("완료 횟수는 소수일 수 없습니다.")
  .min(0, "완료 횟수는 음수일 수 없습니다.")
  .max(MAX_COMPLETION_COUNT, `완료 횟수는 ${MAX_COMPLETION_COUNT}회를 넘을 수 없습니다.`);

export const clientEventIdSchema = z.string().uuid("요청 식별자가 올바르지 않습니다.");
export const prayerItemIdSchema = z.string().uuid("기도 항목이 올바르지 않습니다.");

export const completePrayerInputSchema = z.object({
  prayerItemId: prayerItemIdSchema,
  clientEventId: clientEventIdSchema,
});

export const setPrayerCountInputSchema = z.object({
  prayerItemId: prayerItemIdSchema,
  newCount: completionCountSchema,
  clientEventId: clientEventIdSchema,
});

export const resetPrayerItemInputSchema = z.object({
  prayerItemId: prayerItemIdSchema,
  clientEventId: clientEventIdSchema,
});

export const clientEventOnlySchema = z.object({
  clientEventId: clientEventIdSchema,
});

export const bulkSetInputSchema = z.object({
  newCount: completionCountSchema,
  clientEventId: clientEventIdSchema,
});

export const scrollRatioSchema = z.number().min(0).max(1);
export const themeSchema = z.enum(["day", "night"]);
export const fontSizeSchema = z.enum(["small", "default", "large", "xlarge"]);
export const lineHeightSchema = z.enum(["compact", "comfortable", "spacious"]);

export type ThemeName = z.infer<typeof themeSchema>;
export type FontSizeName = z.infer<typeof fontSizeSchema>;
export type LineHeightName = z.infer<typeof lineHeightSchema>;

export function parseCountInput(raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, message: "완료 횟수를 입력해 주세요." };
  }
  if (!/^\d+$/.test(trimmed)) {
    if (/[가-힣a-zA-Z]/.test(trimmed)) {
      return { ok: false, message: "완료 횟수는 숫자만 입력할 수 있습니다." };
    }
    if (trimmed.includes(".") || trimmed.includes(",")) {
      return { ok: false, message: "완료 횟수는 소수일 수 없습니다." };
    }
    if (trimmed.startsWith("-")) {
      return { ok: false, message: "완료 횟수는 음수일 수 없습니다." };
    }
    return { ok: false, message: "완료 횟수는 0 이상의 정수여야 합니다." };
  }

  const value = Number(trimmed);
  const parsed = completionCountSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "완료 횟수가 올바르지 않습니다." };
  }
  return { ok: true, value: parsed.data };
}
