"use client";

/** 히어로 연출 — 조수희 작업 자리.
 *
 *  지금은 아무것도 하지 않는다. 히어로 구간을 감싸고 그대로 보여준다.
 *  이슈에서 스크롤 진행률을 재어 아래 CSS 변수를 이 요소에 채운다.
 *
 *  채울 변수 (기본값은 Hero.module.css 에 있다):
 *    --hero-track      히어로 스크롤 길이        기본 100svh → 연출 시 255svh(모바일 195svh)
 *    --sun-x           태양 가로 위치            기본 78%
 *    --sun-scale       태양 배율                기본 1
 *    --copy-opacity    히어로 문구               기본 1
 *    --bottom-opacity  아래 줄                  기본 1
 *    --wash-opacity    종이색 덮기               기본 0
 *    --arrival-opacity 도착 문구                기본 0
 *    --progress-width  진행 표시 너비            기본 0
 *
 *  약속 (바꾸지 않는다): 바깥에서 받은 className · id · aria-label 을 그대로 쓴다.
 *  연출을 넣어도 문구는 읽을 수 있어야 한다. */
export function HeroMotion({
  className,
  id,
  label,
  children,
}: {
  className?: string;
  id?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className} id={id} aria-label={label} data-hero-motion="pending">
      {children}
    </section>
  );
}
