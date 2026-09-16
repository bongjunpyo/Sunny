"use client";

import dynamic from "next/dynamic";

// WebGL은 브라우저에만 있으므로 서버에서 미리 그리지 않게(ssr: false) 불러온다
const ThreeScene = dynamic(() => import("./ThreeScene"), {
  ssr: false,
  loading: () => <div className="stage stage--loading">3D 장면 불러오는 중…</div>,
});

export default function ThreeLoader() {
  return <ThreeScene />;
}
