import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUNNY — 빛을 지니는 방식",
  description:
    "빛에 따라 드러나는 개인의 기록. 광변색 소재로 만드는 비즈 팔찌·목걸이 브랜드 SUNNY.",
};

export const viewport: Viewport = {
  themeColor: "#eeeae2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* data-scroll-behavior: 페이지를 옮길 때만 부드러운 스크롤을 끈다.
       없으면 다른 페이지에서 넘어올 때 맨 위로 가지 않고 이전 위치에 머문다 (Next.js 안내) */
    <html lang="ko" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
