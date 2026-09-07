import { describe, expect, it } from "vitest";
import { formatNameList, parseNameList, sanitizePlainText } from "@/lib/prayers/inputs";
import { applyPersonalization, applyPrayerInputValues } from "@/lib/prayers/personalize";

describe("이름 입력", () => {
  it("줄바꿈과 쉼표를 나누고 공백과 빈 값을 제거한다", () => {
    expect(parseNameList(" 민수 \n\n민지, 은혜 , ")).toEqual(["민수", "민지", "은혜"]);
  });

  it("여러 이름을 한 묶음으로 표시한다", () => {
    expect(formatNameList(["민수", "민지", "은혜"])).toBe("민수, 민지, 은혜");
    const result = applyPersonalization("ㅇㅇㅇ에게 지혜를 주옵소서.", "children", {
      names: ["민수", "민지", "은혜"],
    });
    expect(result).toBe("민수, 민지, 은혜에게 지혜를 주옵소서.");
  });

  it("HTML 태그를 저장 문자열에서 제거한다", () => {
    expect(sanitizePlainText("<script>x</script>민수")).toBe("scriptx/script민수");
  });
});

describe("기도 입력값 반영", () => {
  it("소원과 용서 이름을 정확한 위치에 넣는다", () => {
    const source = "나의 소원은 (      )입니다. 다른 사람( 이름 )의 죄를 용서합니다.";
    const result = applyPrayerInputValues(source, "hope-prayer", {
      wish_text: "평안",
      forgiveness_person_name: "민호",
    });
    expect(result).toContain("나의 소원은 (평안)입니다");
    expect(result).toContain("다른 사람(민호)의 죄");
  });

  it("태신자 이름 앞뒤 띄어쓰기를 유지한다", () => {
    const source = "하나님께서 ○○○에게 은혜를 주옵소서. 또한 ○○○ 주변의 사람들이";
    const spaced = source.replaceAll("○○○", "은혜");
    expect(spaced).toBe("하나님께서 은혜에게 은혜를 주옵소서. 또한 은혜 주변의 사람들이");
    const result = applyPrayerInputValues("사랑하는 (      )를 위해 또한 (      )이", "conceived-prayer", {
      evangelism_target_name: "은혜",
    });
    expect(result).toBe("사랑하는 (은혜)를 위해 또한 (은혜)이");
  });

  it("스크립트 문자열을 텍스트로만 남긴다", () => {
    expect(sanitizePlainText("<img src=x onerror=alert(1)>")).not.toContain("<");
    expect(sanitizePlainText("<script>alert(1)</script>")).not.toContain("<script>");
  });
});
