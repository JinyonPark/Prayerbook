import { describe, expect, it } from "vitest";
import { toUserMessage } from "@/lib/errors/user-message";

describe("사용자 오류 메시지", () => {
  it("이미 가입된 이메일은 안내 문구를 보여준다", () => {
    expect(toUserMessage(new Error("User already registered"))).toBe("이미 가입된 아이디 또는 이메일입니다.");
    expect(toUserMessage({ message: "A user with this email address has already been registered", code: "email_exists" })).toBe(
      "이미 가입된 아이디 또는 이메일입니다.",
    );
    expect(toUserMessage({ message: "User already exists", code: "user_already_exists" })).toBe(
      "이미 가입된 아이디 또는 이메일입니다.",
    );
    expect(toUserMessage({ message: "For security purposes, you can only request this after 59 seconds." })).toBe(
      "요청이 너무 많습니다.\n잠시 후 다시 시도해 주세요.",
    );
  });
});
