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

        const setVar = {
          "--hero-track": gsap.quickSetter(root, "--hero-track"),
          "--sun-x": gsap.quickSetter(root, "--sun-x", "%"),
          "--sun-scale": gsap.quickSetter(root, "--sun-scale"),
          "--copy-opacity": gsap.quickSetter(root, "--copy-opacity"),
          "--bottom-opacity": gsap.quickSetter(root, "--bottom-opacity"),
          "--wash-opacity": gsap.quickSetter(root, "--wash-opacity"),
          "--arrival-opacity": gsap.quickSetter(root, "--arrival-opacity"),
          "--progress-width": gsap.quickSetter(root, "--progress-width", "%"),
        };
        let isMobile = false;

        const applyProgress = (p: number) => {
          p = clamp01(p);
          const { xPercent, scale } = sunTransform(p, isMobile);

          setVar["--sun-x"](xPercent);
          setVar["--sun-scale"](scale);
          setVar["--copy-opacity"](1 - clamp01((p - 0.12) / 0.2));
          setVar["--bottom-opacity"](1 - clamp01(p / 0.3));
          setVar["--wash-opacity"](clamp01((p - 0.66) / 0.23));
          setVar["--arrival-opacity"](clamp01((p - 0.85) / 0.1));
          setVar["--progress-width"](p * 100);
        };

        const mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: reduce)", () => {
          // 모션 감소 설정에서는 변수도 건드리지 않고 정지 화면을 유지한다.
        });

        mm.add(
          "(prefers-reduced-motion: no-preference) and (max-width: 700px)",
          () => {
            isMobile = true;
            setVar["--hero-track"]("195svh");

            ScrollTrigger.create({
              trigger: root,
              start: "top top",
              end: "bottom bottom",
              scrub: true,
              onUpdate: (self) => applyProgress(self.progress),
            });

            applyProgress(0);
            root.dataset.heroMotion = "on";

            return () => {
              root.dataset.heroMotion = "pending";
              for (const property of Object.keys(setVar)) {
                root.style.removeProperty(property);
              }
            };
          },
        );

        mm.add(
          "(prefers-reduced-motion: no-preference) and (min-width: 701px)",
          () => {
            isMobile = false;
            setVar["--hero-track"]("255svh");

            ScrollTrigger.create({
              trigger: root,
              start: "top top",
              end: "bottom bottom",
              scrub: true,
              onUpdate: (self) => applyProgress(self.progress),
            });

            applyProgress(0);
            root.dataset.heroMotion = "on";

            return () => {
              root.dataset.heroMotion = "pending";
              for (const property of Object.keys(setVar)) {
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
