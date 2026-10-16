"use client";

import { useEffect, useRef } from "react";

/** 태양 아지랑이 영상 — 화면에 보일 때만 재생하고, 자동재생이 거부되면 포스터를 그대로 둔다.
 *  specs/2026-09-18-main-page-design.md "태양 — 나중에 Higgsfield 영상으로 바꾼다" */
export function SunVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.play().catch(() => {}); // 거부되면 포스터 유지
      } else {
        video.pause();
      }
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      src="/videos/sun-haze-loop.mp4"
      poster="/images/sun-hero.webp"
      muted
      loop
      playsInline
      preload="auto"
    />
  );
}
