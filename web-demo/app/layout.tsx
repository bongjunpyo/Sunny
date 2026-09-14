import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

// 한글 폰트는 용량이 커서 preload 끔 (subsets 목록에 korean 없음)
const sans = Noto_Sans_KR({ variable: "--font-sans", weight: ["400", "500", "700"], preload: false });
const serif = Noto_Serif_KR({ variable: "--font-serif", weight: ["600", "900"], preload: false });

export const metadata: Metadata = {
  title: "빛이 남기는 색 — 웹 기술 예제",
  description: "TypeScript, GSAP ScrollTrigger·SplitText, Three.js, React Three Fiber 학습용 예제",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
