"use client";

import { useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./MagazineTitle.module.css";

gsap.registerPlugin(SplitText, ScrollTrigger, useGSAP);

export default function MagazineTitle() {
  const root = useRef<HTMLDivElement>(null);
  const headlineAnim = useRef<gsap.core.Tween | null>(null);

  const { contextSafe } = useGSAP(
    () => {
      const q = gsap.utils.selector(root);

      // ① type: "chars" — 제목을 글자 단위로 쪼개 한 글자씩 아래에서 올라오게
      // 한글은 글자만 쪼개면 단어 중간에서 줄이 바뀌므로 words로 한 번 묶어 둔다
      SplitText.create(q(`.${styles.headline}`), {
        type: "words, chars",
        mask: "chars", // 글자마다 잘라내는 틀을 씌워 '틀 밖에서 올라오는' 효과
        autoSplit: true, // 폰트 로딩·화면 폭이 바뀌면 다시 쪼갬
        onSplit(self) {
          headlineAnim.current = gsap.from(self.chars, {
            yPercent: 115,
            rotate: 8,
            duration: 1.2,
            ease: "expo.out",
            stagger: 0.07,
          });
          return headlineAnim.current;
        },
      });

      // ② type: "words" — 영문 부제를 단어 단위로 흐릿하게 나타나게
      SplitText.create(q(`.${styles.dek}`), {
        type: "words",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.words, {
            autoAlpha: 0,
            y: 20,
            filter: "blur(8px)",
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.06,
            delay: 0.7,
          }),
      });

      // ③ type: "lines" + ScrollTrigger — 본문을 스크롤해서 도착하면 한 줄씩
      (q(`.${styles.body} p`) as HTMLElement[]).forEach((p) => {
        SplitText.create(p, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 100,
              duration: 0.9,
              ease: "power3.out",
              stagger: 0.09,
              scrollTrigger: { trigger: p, start: "top 82%" },
            }),
        });
      });

      // ④ 인용구 — 스크롤 진행에 맞춰 글자가 흰색 → 주황으로 '발색'
      SplitText.create(q(`.${styles.quote}`), {
        type: "words, chars",
        autoSplit: true,
        onSplit: (self) =>
          gsap.fromTo(
            self.chars,
            { color: "#d9d1c4" },
            {
              color: "#e0461d",
              stagger: 0.02,
              ease: "none",
              scrollTrigger: { trigger: self.elements[0], start: "top 78%", end: "bottom 40%", scrub: true },
            },
          ),
      });
    },
    { scope: root },
  );

  // 클릭처럼 나중에 실행되는 함수는 contextSafe로 감싸야 정리(cleanup)가 됨
  const replay = contextSafe(() => headlineAnim.current?.restart());

  return (
    <div ref={root}>
      <section className={styles.spread}>
        <div className={styles.issue}>
          <span>Issue 01</span>
          <span>Sun</span>
          <span>2026 Autumn</span>
        </div>
        <span className={styles.tag}>type: chars · mask</span>
        <h2 className={styles.headline}>
          빛이 남기는 <span className={styles.accent}>색</span>
        </h2>
        <span className={`${styles.tag} ${styles.tagDek}`}>type: words</span>
        <p className={styles.dek}>The colour that sunlight leaves behind, one bead at a time.</p>
        <button type="button" className={styles.replay} onClick={replay}>
          ↻ 제목 다시 재생
        </button>
      </section>

      <section className={styles.article}>
        <span className={styles.tag}>type: lines · mask · ScrollTrigger</span>
        <div className={styles.body}>
          <p>
            실내에서는 모두 같은 흰색이다. 문을 열고 햇빛 아래로 한 걸음 나서는 순간, 비즈마다 숨겨 두었던 색이 올라온다. 누군가에게는
            보랏빛이고, 누군가에게는 산호색이다.
          </p>
          <p>
            같은 염료라도 농도가 짙을수록 색은 더 깊어진다. 우리는 그 차이를 세 단계로 나누고, 햇빛의 세기와 시간에 따라 달라지는 모습을
            한 권의 아카이브로 기록한다.
          </p>
        </div>

        <span className={styles.tag}>type: chars · scrub</span>
        <blockquote className={styles.quote}>“햇빛이 닿는 곳에서만 보이는 이야기.”</blockquote>
      </section>

      <div style={{ height: "40vh" }} />
    </div>
  );
}
