"use client";

import dynamic from "next/dynamic";

const R3FScene = dynamic(() => import("./R3FScene"), {
  ssr: false,
  loading: () => <div className="stage stage--loading">3D 장면 불러오는 중…</div>,
});

export default function R3FLoader() {
  return <R3FScene />;
}
