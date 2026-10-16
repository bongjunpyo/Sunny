"use client";

import { useEffect, useRef } from "react";
import styles from "./SeaCover.module.css";

/** 윤슬 커버 — 수면 위를 옮겨 다니는 반사광 영상.
 *  시안: docs/design/stories-wearing-light.html
 *
 *  AI 생성물이다 — #72 초안 이미지를 Kling v2.5-turbo standard(Higgsfield API)로 image-to-video
 *  (2026-10-14, 요청 cc81f7c5, 조수희). 처음 10프레임을 덜고 끝 1초를 처음과 섞어 이음새를 없앴다(#86).
 *  화면 밖에서는 멈추고, 모션 감소 설정이면 포스터만 보인다. */
export function SeaCover({ label, tall = false }: { label: string; tall?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    <div className={tall ? `${styles.cover} ${styles.tall}` : styles.cover}>
      <video
        ref={ref}
        src="/videos/yunseul-loop.mp4"
        poster="/images/yunseul-poster.webp"
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
