import type { CSSProperties } from "react";
import Image from "next/image";
import { sunTransform } from "./sunTransform.ts";
import { SunVideo } from "./SunVideo.tsx";
import styles from "./Sun.module.css";

/** 태양 — 씬의 공개 부품.
 *
 *  입력은 `progress`(히어로 스크롤 진행률 0~1)와 `reduced`(모션 감소)뿐이다.
 *  이 두 입력을 지키면 속을 Higgsfield 영상이나 WebGL 로 바꿔도
 *  바깥 화면 코드는 고치지 않는다 → specs/2026-09-18-main-page-design.md
 *
 *  지금 속은 AI 생성 이미지다 — Higgsfield Soul 2 생성(2026-10-08, 요청 8ce52ce0)에
 *  얼룩 제거·2배 업스케일 보정, 그 위에 코드로 만든 아지랑이 8초 반복 영상. 실제 태양 사진이 아니다. */
export function Sun({
  progress,
  isMobile = false,
  reduced = false,
}: {
  /** 주지 않으면 바깥(히어로)의 CSS 변수를 따른다 — 연출 부품이 채운다 */
  progress?: number;
  isMobile?: boolean;
  reduced?: boolean;
}) {
  const driven = progress === undefined;
  const { xPercent, scale } = sunTransform(reduced ? 0 : (progress ?? 0), isMobile);
  const style = driven
    ? undefined
    : ({ "--sun-x": `${xPercent}%`, "--sun-scale": scale } as CSSProperties);

  return (
    <div
      className={styles.sun}
      style={style}
      data-static={!driven && (progress === 0 || reduced) ? "true" : "false"}
      aria-hidden="true"
    >
      {/* 원반 지름이 상자의 88.7%(이전 SVG r=266/300과 같은 비율).
          검은 배경은 screen 합성으로 페이지 배경에 녹인다. 모션 감소면 영상 대신 정지 사진 */}
      <Image
        className={styles.still}
        src="/images/sun-hero.webp"
        alt=""
        width={1758}
        height={1758}
        loading="eager"
        fetchPriority="high"
      />
      {!reduced && <SunVideo className={styles.motion} />}
    </div>
  );
}
