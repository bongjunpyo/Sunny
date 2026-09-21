"use client";

  import { useRef } from "react";
  import gsap from "gsap";
  import { useGSAP } from "@gsap/react";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  import { clamp01, sunTransform } from "../scene/sunTransform.ts";

  gsap.registerPlugin(ScrollTrigger, useGSAP);

  /** 히어로 연출 — 조수희 작업 자리.
   *
   *  스크롤 진행률을 재어 아래 CSS 변수를 이 요소에 채운다.
   *
   *  채울 변수 (기본값은 Hero.module.css 에 있다):
   *    --hero-track      히어로 스크롤 길이        기본 100svh → 연출 시 255svh(모
   바일 195svh)
   *    --sun-x           태양 가로 위치            기본 78%
   *    --sun-scale       태양 배율                기본 1
   *    --copy-opacity    히어로 문구               기본 1
   *    --bottom-opacity  아래 줄                  기본 1
   *    --wash-opacity    종이색 덮기               기본 0
   *    --arrival-opacity 도착 문구                기본 0
   *    --progress-width  진행 표시 너비            기본 0
   *
   *  약속 (바꾸지 않는다): 바깥에서 받은 className · id · aria-label 을 그대로 쓴
   다.
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
    const rootRef = useRef<HTMLElement>(null);

    useGSAP(
      () => {
        const root = rootRef.current;
        if (!root) return;

        const mm = gsap.matchMedia();

        mm.add(
          {
            reduced: "(prefers-reduced-motion: reduce)",
            desktop: "(min-width: 701px)",
            mobile: "(max-width: 700px)",
          },
          (context) => {
            const { reduced, mobile } = context.conditions as {
              reduced: boolean;
              mobile: boolean;
            };

            if (reduced) {
              return;
            }

            const draw = (progress: number) => {
              const p = clamp01(progress);
              const { xPercent, scale } = sunTransform(p, mobile);

              root.style.setProperty("--sun-x", `${xPercent}%`);
              root.style.setProperty("--sun-scale", String(scale));
              root.style.setProperty(
                "--copy-opacity",
                String(1 - clamp01((p - 0.12) / 0.2)),
              );
              root.style.setProperty(
                "--bottom-opacity",
                String(1 - clamp01(p / 0.3)),
              );
              root.style.setProperty(
                "--wash-opacity",
                String(clamp01((p - 0.66) / 0.23)),
              );
              root.style.setProperty(
                "--arrival-opacity",
                String(clamp01((p - 0.85) / 0.1)),
              );
              root.style.setProperty("--progress-width", `${p * 100}%`);
            };

            root.dataset.heroMotion = "on";
            root.style.setProperty(
              "--hero-track",
              mobile ? "195svh" : "255svh",
            );

            const trigger = ScrollTrigger.create({
              trigger: root,
              start: "top top",
              end: "bottom bottom",
              onUpdate: (self) => draw(self.progress),
              onRefresh: (self) => draw(self.progress),
            });

            draw(trigger.progress);

            return () => {
              trigger.kill();
              root.dataset.heroMotion = "pending";

              for (const property of [
                "--hero-track",
                "--sun-x",
                "--sun-scale",
                "--copy-opacity",
                "--bottom-opacity",
                "--wash-opacity",
                "--arrival-opacity",
                "--progress-width",
              ]) {
                root.style.removeProperty(property);
              }
            };
          },
        );

        return () => {
          mm.revert();
        };
      },
      { scope: rootRef },
    );

    return (
      <section
        ref={rootRef}
        className={className}
        id={id}
        aria-label={label}
        data-hero-motion="pending"
      >
        {children}
      </section>
    );
  }
