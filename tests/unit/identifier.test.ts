import { describe, expect, it } from "vitest";
import { parseAuthIdentifier, syntheticAuthEmail } from "@/lib/auth/identifier";

describe("로그인 식별자", () => {
  it("이메일을 소문자로 정규화한다", () => {
    expect(parseAuthIdentifier("  Jin@Example.com ")).toEqual({
      kind: "email",
      email: "jin@example.com",
    });
  });

  it("아이디를 소문자로 정규화한다", () => {
    expect(parseAuthIdentifier("Jin_01")).toEqual({
      kind: "loginId",
      loginId: "jin_01",
    });
  });

  it("짧은 아이디와 잘못된 문자를 거른다", () => {
    expect(parseAuthIdentifier("ab")).toEqual({
      error: "아이디는 3~20자의 영문, 숫자와 ., _, - 만 사용할 수 있습니다.",
    });
    expect(parseAuthIdentifier("홍길동")).toEqual({
      error: "아이디는 3~20자의 영문, 숫자와 ., _, - 만 사용할 수 있습니다.",
    });
  });

  it("아이디용 내부 이메일을 만든다", () => {
    expect(syntheticAuthEmail("jin_01")).toBe("u-jin_01@id.prayerbook.app");
  });
});
