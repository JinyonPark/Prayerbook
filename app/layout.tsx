import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { InstallPromptProvider } from "@/components/pwa/InstallPromptProvider";
import { INSTALL_CAPTURE_SCRIPT } from "@/lib/pwa/detect";
import { THEME_INIT_SCRIPT } from "@/lib/theme/preferences";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "기도훈련집",
  description: "기본 기도 1번부터 27번까지 기록하고 이어서 기도하는 웹앱",
  applicationName: "기도훈련집",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "기도훈련집",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png?v=5", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=5", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png?v=5", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3f5c4b" },
    { media: "(prefers-color-scheme: dark)", color: "#121416" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSansKr.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-[var(--bg)] text-[var(--text)] antialiased">
        <a className="skip-link" href="#main">
          본문으로 건너뛰기
        </a>
        <InstallPromptProvider>{children}</InstallPromptProvider>
      </body>
    </html>
  );
}
