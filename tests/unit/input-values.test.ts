import { describe, expect, it } from "vitest";
import { normalizePrayerInputValues } from "@/lib/prayers/input-values";

describe("기도 입력 JSON 검증", () => {
  it("허용되지 않은 key를 거부한다", () => {
    expect(() => normalizePrayerInputValues({ hack: "x" } as never)).toThrow("INVALID_INPUT_KEY");
  });

  it("자녀 이름 20명 초과를 거부한다", () => {
    expect(() => normalizePrayerInputValues({ child_names: Array.from({ length: 21 }, (_, i) => `이름${i}`) })).toThrow(
      "TOO_MANY_NAMES",
    );
  });

  it("중복 이름을 제거하고 태그를 텍스트로 만든다", () => {
    expect(normalizePrayerInputValues({ child_names: ["민수", "민수", "<script>은혜"] })).toEqual({
      child_names: ["민수", "script은혜"],
    });
  });

  it("16KB를 넘는 JSON을 거부한다", () => {
    expect(() => normalizePrayerInputValues({ wish_text: "가".repeat(20000) })).toThrow("INPUT_TOO_LARGE");
  });
});
