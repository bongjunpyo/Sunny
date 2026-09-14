"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { COLOR_LABEL, SAMPLE_BEADS, activatedColor } from "@/lib/bead";
import styles from "./ScrollSun.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STAGES = [
  { time: "실내", uv: 0, copy: "창문 안쪽. 자외선이 닿지 않아 비즈는 모두 흰색입니다." },
  { time: "오전 10시", uv: 4, copy: "밖으로 나오면 농도가 높은 비즈부터 색이 먼저 올라옵니다." },
  { time: "정오", uv: 9, copy: "자외선이 가장 강한 시간. 같은 색도 농도에 따라 진하기가 다릅니다." },
];

export default function ScrollSun() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const beads = q(`.${styles.bead}`) as HTMLElement[];
      const colorsAt = (uv: number) => SAMPLE_BEADS.map((b) => activatedColor(b, uv));
      const uvEl = q(`.${styles.uvNumber}`)[0] as HTMLElement;
      const captions = q(`.${styles.caption}`);

      const mm = gsap.matchMedia();

      // 움직임 줄이기 설정을 켠 사람에게는 애니메이션 없이 결과만 보여준다
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(q(`.${styles.window}`), { autoAlpha: 0 });
        gsap.set(q(`.${styles.sun}`), { autoAlpha: 1, yPercent: -8, scale: 1.1, "--glow": 1 });
        beads.forEach((el, i) => (el.style.backgroundColor = colorsAt(9)[i]));
        gsap.set(captions, { autoAlpha: 0 });
        gsap.set(captions[2], { autoAlpha: 1 });
        uvEl.textContent = "9";
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(q(`.${styles.sun}`), { autoAlpha: 0, yPercent: 135, scale: 0.7 });
        gsap.set(captions.slice(1), { autoAlpha: 0, y: 24 });

        const counter = { uv: 0 };
        const showUv = () => (uvEl.textContent = counter.uv.toFixed(0));

        // 핵심: 타임라인 하나를 만들고, 진행도를 스크롤에 묶는다
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: q(`.${styles.stage}`)[0],
            start: "top top", // 무대 윗변이 화면 윗변에 닿으면 시작
            end: "+=300%", // 화면 높이 3배만큼 스크롤하는 동안 진행
            scrub: 1, // 스크롤을 1초 늦게 부드럽게 따라감 (보간)
            pin: true, // 진행되는 동안 무대를 화면에 고정
          },
        });

        // ① 실내 → 오전
        tl.to(q(`.${styles.window}`), { autoAlpha: 0, scale: 1.25, duration: 0.6 })
          .to(q(`.${styles.sky}`), { "--sky-top": "#8fc0e6", "--sky-bottom": "#f6d6b0", duration: 1 }, "<")
          .to(q(`.${styles.sun}`), { autoAlpha: 1, yPercent: 40, scale: 0.9, "--glow": 0.6, duration: 1 }, "<")
          .to(beads, { backgroundColor: (i: number) => colorsAt(STAGES[1].uv)[i], stagger: 0.04, duration: 0.7 }, "<0.3")
          .to(counter, { uv: STAGES[1].uv, onUpdate: showUv, duration: 1 }, "<")
          .to(captions[0], { autoAlpha: 0, y: -24, duration: 0.3 }, "<")
          .to(captions[1], { autoAlpha: 1, y: 0, duration: 0.3 }, ">-0.1")

          // ② 오전 → 정오
          .to(q(`.${styles.sky}`), { "--sky-top": "#2f7fd6", "--sky-bottom": "#ffe4bd", duration: 1 })
          .to(q(`.${styles.sun}`), { yPercent: -8, scale: 1.1, "--glow": 1, duration: 1 }, "<")
          .to(beads, { backgroundColor: (i: number) => colorsAt(STAGES[2].uv)[i], stagger: 0.04, duration: 0.7 }, "<0.2")
          .to(counter, { uv: STAGES[2].uv, onUpdate: showUv, duration: 1 }, "<")
          .to(captions[1], { autoAlpha: 0, y: -24, duration: 0.3 }, "<")
          .to(captions[2], { autoAlpha: 1, y: 0, duration: 0.3 }, ">-0.1")
          .to({}, { duration: 0.5 }); // 끝 장면을 잠깐 붙잡아 둠
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root}>
      <section className={styles.intro}>
        <p className="kicker">Chapter 01</p>
        <h2 className="serif">해가 뜨는 시간</h2>
        <p>천천히 스크롤을 내려보세요 ↓</p>
      </section>

      <section className={styles.stage}>
        <div className={styles.sky} />
        <div className={styles.sun} />
        <div className={styles.ground} />
        <div className={styles.window} />

        <div className={styles.meta}>
          <p>Chapter 01 — 해가 뜨는 시간</p>
        </div>
        <div className={styles.uvBox}>
          <span>UV</span>
          <strong className={styles.uvNumber}>0</strong>
        </div>

        <div className={styles.captions}>
          {STAGES.map((s) => (
            <div key={s.time} className={styles.caption}>
              <b>{s.time}</b>
              <p>{s.copy}</p>
            </div>
          ))}
        </div>

        <div className={styles.strip}>
          {SAMPLE_BEADS.map((bead, i) => (
            <div key={bead.id} className={styles.slot}>
              <div className={styles.beadRow}>
                <div className={styles.bead} />
                {i < SAMPLE_BEADS.length - 1 && <span className={styles.spacer} />}
              </div>
              <small>
                {COLOR_LABEL[bead.color]} {bead.concentration}%
              </small>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.outro}>
        <p>스크롤을 다시 올리면 모든 변화가 거꾸로 되돌아갑니다. 스크롤 위치 = 애니메이션 진행도이기 때문입니다.</p>
      </section>
    </div>
  );
}
