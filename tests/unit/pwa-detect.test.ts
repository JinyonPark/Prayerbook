import { describe, expect, it } from "vitest";
import { detectPlatform, getInstallSteps } from "@/lib/pwa/detect";

describe("설치 안내 플랫폼", () => {
  it("iPhone과 iPad, Android, Windows를 구분한다", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("iphone");
    expect(detectPlatform("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("ipad");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0")).toBe("windows-chrome");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/120.0.0.0")).toBe("windows-edge");
  });

  it("기기별 설치 단계를 제공한다", () => {
    expect(getInstallSteps("iphone").steps.length).toBeGreaterThan(0);
    expect(getInstallSteps("android").title).toContain("Android");
    expect(getInstallSteps("kakao").steps.join(" ")).toContain("다른 브라우저로 열기");
    expect(detectPlatform("Mozilla/5.0 KAKAOTALK")).toBe("kakao");
  });
});
