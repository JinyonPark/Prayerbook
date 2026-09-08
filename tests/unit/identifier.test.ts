import { describe, expect, it } from "vitest";
import { parseAuthIdentifier, syntheticAuthEmail, isSyntheticAuthEmail } from "@/lib/auth/identifier";

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
      loginId: "Jin_01",
      normalizedLoginId: "jin_01",
    });
  });

  it("짧은 아이디와 잘못된 문자를 거른다", () => {
    expect(parseAuthIdentifier("ab")).toMatchObject({ error: expect.stringContaining("아이디는") });
    expect(parseAuthIdentifier("jin@id")).toMatchObject({ error: expect.any(String) });
  });

  it("한글 아이디를 허용한다", () => {
    expect(parseAuthIdentifier("홍길동")).toEqual({
      kind: "loginId",
      loginId: "홍길동",
      normalizedLoginId: "홍길동",
    });
  });

  it("아이디용 내부 이메일을 만든다", () => {
    expect(syntheticAuthEmail("jin_01")).toBe("u-jin_01@id.prayerbook.app");
    expect(isSyntheticAuthEmail("u-jin_01@id.prayerbook.app")).toBe(true);
    expect(isSyntheticAuthEmail("jin@gmail.com")).toBe(false);
  });
});
