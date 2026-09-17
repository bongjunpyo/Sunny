import type { CSSProperties } from "react";
import { sunTransform } from "./sunTransform.ts";
import styles from "./Sun.module.css";

/** 태양 — 씬의 공개 부품.
 *
 *  입력은 `progress`(히어로 스크롤 진행률 0~1)와 `reduced`(모션 감소)뿐이다.
 *  이 두 입력을 지키면 속을 Higgsfield 영상이나 WebGL 로 바꿔도
 *  바깥 화면 코드는 고치지 않는다 → specs/2026-09-18-main-page-design.md
 *
 *  지금 속은 시안의 SVG 원반이다. 코드로 그린 연출이며 실제 태양 사진이 아니다. */
export function Sun({
  progress = 0,
  isMobile = false,
  reduced = false,
}: {
  progress?: number;
  isMobile?: boolean;
  reduced?: boolean;
}) {
  const { xPercent, scale } = sunTransform(reduced ? 0 : progress, isMobile);
  const style = {
    "--sun-x": `${xPercent}%`,
    "--sun-scale": scale,
  } as CSSProperties;

  return (
    <div
      className={styles.sun}
      style={style}
      data-static={progress === 0 || reduced ? "true" : "false"}
      aria-hidden="true"
    >
      <svg viewBox="0 0 600 600">
        <defs>
          <radialGradient id="sunBase" cx="37%" cy="33%">
            <stop stopColor="#f1d09b" />
            <stop offset=".52" stopColor="#bd8243" />
            <stop offset=".85" stopColor="#8b4a26" />
            <stop offset="1" stopColor="#dfa05a" />
          </radialGradient>
          <filter id="sunTexture">
            <feTurbulence type="fractalNoise" baseFrequency=".025 .04" numOctaves="4" seed="24" />
            <feColorMatrix type="saturate" values="0" />
            <feBlend in="SourceGraphic" mode="soft-light" />
          </filter>
          <clipPath id="sunDisc">
            <circle cx="300" cy="300" r="266" />
          </clipPath>
          <radialGradient id="sunLimb">
            <stop offset=".64" stopColor="#120a05" stopOpacity="0" />
            <stop offset=".96" stopColor="#120a05" stopOpacity=".33" />
            <stop offset="1" stopColor="#f0bb78" stopOpacity=".6" />
          </radialGradient>
        </defs>
        <circle cx="300" cy="300" r="267" fill="#bd8146" opacity=".3" />
        <g clipPath="url(#sunDisc)">
          <circle cx="300" cy="300" r="266" fill="url(#sunBase)" />
          <circle cx="300" cy="300" r="266" fill="url(#sunBase)" filter="url(#sunTexture)" opacity=".58" />
          <circle cx="300" cy="300" r="266" fill="url(#sunLimb)" />
        </g>
      </svg>
    </div>
  );
}
