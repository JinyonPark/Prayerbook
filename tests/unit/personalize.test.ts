import { describe, expect, it } from "vitest";
import { applyPersonalization, hasBatchim } from "@/lib/prayers/personalize";

describe("한글 받침", () => {
  it("받침 유무를 구분한다", () => {
    expect(hasBatchim("길동")).toBe(true);
    expect(hasBatchim("영희")).toBe(false);
    expect(hasBatchim("민수")).toBe(false);
  });
});

describe("기도문 개인화", () => {
  it("태신자 이름과 씨를 자연스럽게 바꾼다", () => {
    const source =
      "하나님 아버지의 이름이 (태신자 이름) 씨를 통하여 거룩히 여김 받으시기를 원합니다. 그리고 ㅇㅇㅇ씨가 하나님의 이름을 거룩히 여기는 일들을 하기 원합니다.";
    const result = applyPersonalization(source, "conceived-believer", { name: "김철수" });
    expect(result).toContain("김철수씨를 통하여");
    expect(result).toContain("김철수씨가");
    expect(result).not.toContain("ㅇㅇㅇ");
    expect(result).not.toContain("태신자 이름");
  });

  it("사람 이름에 조사 이/가, 을/를을 붙인다", () => {
    const source = "하나님 아버지의 이름이 (ㅇㅇㅇ)를 통하여 거룩히 여김 받으시기를 원합니다. 그리고 ㅇㅇㅇ가 하나님의 이름을 거룩히 여기는 일을 찾아서 하기를 원합니다.";
    const batchim = applyPersonalization(source, "faculties", { name: "길동" });
    expect(batchim).toContain("길동을 통하여");
    expect(batchim).toContain("그리고 길동이");
    const open = applyPersonalization(source, "faculties", { name: "영희" });
    expect(open).toContain("영희를 통하여");
    expect(open).toContain("그리고 영희가");
  });

  it("남편 이름과 중보기도 본문을 바꾼다", () => {
    const source = `남편(ㅇㅇㅇ)을 통하여 거룩히 여김 받으시기를 원합니다.

(남편을 위한 중보기도)

남편에게 풍성한 물질을 주셔서 하나님을 위하여 언제나 마음껏 드리게 하옵소서.

5) 하나님! 남편의 죄를 용서합니다.`;
    const result = applyPersonalization(source, "husband", {
      name: "민호",
      intercession: "민호가 직장에서 믿음을 지키게 하옵소서.",
    });
    expect(result).toContain("남편(민호)을 통하여");
    expect(result).toContain("민호가 직장에서 믿음을 지키게 하옵소서.");
    expect(result).not.toContain("(남편을 위한 중보기도)");
    expect(result).not.toContain("남편에게 풍성한 물질을 주셔서");
    expect(result).toContain("5) 하나님! 남편의 죄를 용서합니다.");
  });

  it("값이 없으면 원문을 그대로 둔다", () => {
    const source = "(교회를 위한 중보기도)\n\n우리 교회가 지역의 영혼들을 많이 구원하는 교회가 되기를 원합니다.\n\n5) 하나님!";
    expect(applyPersonalization(source, "church", {})).toBe(source);
  });

  it("목장 중보기도 제목의 띄어쓰기를 맞춘다", () => {
    const source = `(목장을 위한 중보 기도)

우리 목장이 지역의 영혼들을 많이 구원하는 목장이 되기를 원합니다.

5) 하나님! 다른 사람의 죄를 용서해 주시기 원합니다.`;
    const result = applyPersonalization(source, "cell-group", {
      intercession: "우리 목장이 이웃을 사랑하게 하옵소서.",
    });
    expect(result).toContain("우리 목장이 이웃을 사랑하게 하옵소서.");
    expect(result).not.toContain("(목장을 위한 중보 기도)");
    expect(result).toContain("5) 하나님! 다른 사람의 죄를 용서해 주시기 원합니다.");
  });

  it("태신자가 여러 명이면 처음만 이름을 넣고 나머지는 태신자들로 잇는다", () => {
    const source =
      "하나님 아버지의 이름이 (태신자 이름) 씨를 통하여 거룩히 여김 받으시기를 원합니다. 그리고 ㅇㅇㅇ씨가 하나님의 이름을 거룩히 여기는 일들을 하기 원합니다. 하나님의 나라가 ㅇㅇㅇ씨에게 이루어지기를 원합니다. ㅇㅇㅇ씨를 통하여 전파되기를 원합니다. ㅇㅇㅇ씨의 마음속에 있는 악에서 ㅇㅇㅇ씨를 구원하여 주옵소서. ㅇㅇㅇ씨는 연약하오니 힘을 공급하여 주옵소서.";
    const result = applyPersonalization(source, "conceived-believer", {
      names: ["김철수", "이영희"],
    });
    expect(result).toContain("김철수, 이영희씨를 통하여");
    expect(result).toContain("그리고 태신자들이");
    expect(result).toContain("태신자들에게 이루어지기를");
    expect(result).toContain("태신자들을 통하여");
    expect(result).toContain("태신자들의 마음속에");
    expect(result).toContain("태신자들은 연약하오니");
    expect(result).not.toContain("ㅇㅇㅇ");
    expect(result).not.toContain("태신자들씨");
    expect(result).not.toContain("태신자들가");
  });

  it("설정이 매번 표시이면 태신자 이름을 모두 반복한다", () => {
    const source =
      "하나님 아버지의 이름이 (태신자 이름) 씨를 통하여 거룩히 여김 받으시기를 원합니다. 그리고 ㅇㅇㅇ씨가 하나님의 이름을 거룩히 여기는 일들을 하기 원합니다.";
    const result = applyPersonalization(source, "conceived-believer", {
      names: ["김철수", "이영희"],
      nameRepeat: "all",
    });
    expect(result).toContain("김철수, 이영희씨를 통하여");
    expect(result).toContain("김철수, 이영희씨가");
    expect(result).not.toContain("태신자들");
  });

  it("사람을 위한 기도는 여러 이름을 함께 넣는다", () => {
    const source = "하나님 아버지의 이름이 (ㅇㅇㅇ)를 통하여 거룩히 여김 받으시기를 원합니다. 그리고 ㅇㅇㅇ가 하나님의 이름을 거룩히 여기는 일을 찾아서 하기를 원합니다.";
    const result = applyPersonalization(source, "faculties", { names: ["길동", "영희"] });
    expect(result).toContain("길동, 영희를 통하여");
    expect(result).toContain("그리고 길동, 영희가");
  });
});
