export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __prayerbookInstallPrompt?: BeforeInstallPromptEvent | null;
    __prayerbookInstalled?: boolean;
  }
}

export const INSTALL_CAPTURE_SCRIPT = `(() => {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean(window.navigator.standalone);
  if (standalone) window.__prayerbookInstalled = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.__prayerbookInstallPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    window.__prayerbookInstallPrompt = null;
    window.__prayerbookInstalled = true;
  });
})();`;

export type InstallPlatform =
  | "android"
  | "iphone"
  | "ipad"
  | "windows-chrome"
  | "windows-edge"
  | "mac"
  | "kakao"
  | "other";

export function isKakaoInApp(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /KAKAOTALK/i.test(userAgent);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = "standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return media || iosStandalone;
}

export function detectPlatform(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): InstallPlatform {
  const ua = userAgent;
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  const isIPadOS = typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone/.test(ua)) return "iphone";
  if (/iPad/.test(ua) || isIPadOS) return "ipad";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua) && /Edg/i.test(ua)) return "windows-edge";
  if (/Windows/i.test(ua) && /Chrome/i.test(ua)) return "windows-chrome";
  if (/Mac OS X/.test(ua)) return "mac";
  return "other";
}

export function getInstallSteps(platform: InstallPlatform): { title: string; steps: string[] } {
  switch (platform) {
    case "android":
      return {
        title: "Android 휴대폰 및 태블릿",
        steps: [
          "브라우저 메뉴를 엽니다.",
          "앱 설치 또는 홈 화면에 추가를 선택합니다.",
          "안내에 따라 설치를 완료합니다.",
        ],
      };
    case "iphone":
      return {
        title: "iPhone",
        steps: [
          "Safari 하단의 공유 버튼을 누릅니다.",
          "홈 화면에 추가를 선택합니다.",
          "추가를 눌러 홈 화면에 아이콘을 만듭니다.",
        ],
      };
    case "ipad":
      return {
        title: "iPad",
        steps: [
          "Safari 상단 또는 하단의 공유 버튼을 누릅니다.",
          "홈 화면에 추가를 선택합니다.",
          "추가를 눌러 홈 화면에 아이콘을 만듭니다.",
        ],
      };
    case "windows-chrome":
      return {
        title: "Windows Chrome",
        steps: [
          "주소창 오른쪽의 설치 아이콘을 확인합니다.",
          "아이콘이 없으면 브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 찾습니다.",
          "안내에 따라 설치합니다.",
        ],
      };
    case "windows-edge":
      return {
        title: "Windows Edge",
        steps: [
          "주소창 또는 브라우저 메뉴를 엽니다.",
          "앱 설치 또는 이 사이트를 앱으로 설치를 선택합니다.",
          "안내에 따라 설치합니다.",
        ],
      };
    case "mac":
      return {
        title: "macOS",
        steps: [
          "지원되는 브라우저 메뉴를 엽니다.",
          "앱 설치 또는 독에 추가 / 홈 화면에 추가를 선택합니다.",
          "설치가 보이지 않으면 현재 브라우저는 수동 설치만 지원할 수 있습니다.",
        ],
      };
    case "kakao":
      return {
        title: "카카오톡 브라우저",
        steps: [
          "카카오톡 인앱 브라우저에서는 앱을 바로 설치할 수 없습니다.",
          "오른쪽 위 메뉴에서 다른 브라우저로 열기를 선택합니다.",
          "Chrome 또는 Safari에서 다시 앱 설치를 누릅니다.",
        ],
      };
    default:
      return {
        title: "현재 브라우저",
        steps: [
          "브라우저 메뉴를 엽니다.",
          "앱 설치 또는 홈 화면에 추가 항목을 찾습니다.",
          "해당 항목이 없으면 이 브라우저는 설치를 지원하지 않을 수 있습니다. 브라우저에서 그대로 사용할 수 있습니다.",
        ],
      };
  }
}
