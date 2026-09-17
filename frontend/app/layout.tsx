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
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
