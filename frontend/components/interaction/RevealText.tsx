"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import styles from "./RevealText.module.css";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/** 문구를 단어로 나누고, 화면에 들어올 때 아래에서 차례로 나타낸다. */
export function RevealText({
  text,
  as: Tag = "p",
}: {
  text: string;
  as?: "h2" | "p";
}) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!rootRef.current) return;

      const split = SplitText.create(rootRef.current, {
        type: "words, chars",
        wordsClass: styles.word,
      });
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(split.words, { y: 0, opacity: 1 });
        rootRef.current?.setAttribute("data-reveal", "done");
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          split.words,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.04,
            ease: "power2.out",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top 80%",
              once: true,
            },
            onComplete: () => {
              rootRef.current?.setAttribute("data-reveal", "done");
            },
          },
        );
      });

      return () => {
        mm.revert();
        split.revert();
      };
    },
    { scope: rootRef },
  );

  return (
      <Tag
    ref={(element) => {
      rootRef.current = element;
    }}
    data-reveal="pending"
  >
      {text}
    </Tag>
  );
}
