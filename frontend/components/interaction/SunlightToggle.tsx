"use client";

import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { COLOR_LABEL, type PhotochromicColor } from "../../lib/types.ts";
import { COLOR_HEX, BEAD_BASE } from "../../lib/colors.ts";
import styles from "./SunlightToggle.module.css";

gsap.registerPlugin(useGSAP);

/** 발색 비교 — 조수희 작업 자리 (이슈 #56).
 *
 *  햇빛을 비추면 색이 서서히 드러나고, 다시 누르면 그늘 상태로 되돌아온다.
 *  색칠한 그림 위의 흰 종이를 걷어내듯, 실내 겹의 투명도로 색을 드러낸다.
 *
 *  약속 (바꾸지 않는다):
 *  - 입력은 `colors` 하나다 — 이 제품의 반응색 목록
 *  - 바깥 요소의 `data-lit` 를 `"on"` / `"off"` 로 둔다 (테스트가 본다)
 *  - 버튼에는 `aria-pressed` 를 둔다
 *  - 색은 `lib/colors.ts` 의 `COLOR_HEX` 를 쓴다. 직접 정하지 않는다
 *  - 화면에 "연출입니다. 실제 발색 속도·색과 다릅니다."를 적는다
 *  - 모션 감소 설정이면 애니메이션 없이 즉시 바뀐다 */
export function SunlightToggle({ colors }: { colors: PhotochromicColor[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const indoorRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP((context, contextSafe) => {
    const root = rootRef.current;
    const indoor = indoorRef.current;
    const light = lightRef.current;
    const button = buttonRef.current;
    if (!root || !indoor || !light || !button || !contextSafe) return;

    let lit = false;
    let timeline: gsap.core.Timeline | undefined;
    const media = gsap.matchMedia();

    // 도착 도장처럼, 연출이 끝났을 때만 상태와 버튼 문구를 확정한다.
    const finish = () => {
      root.dataset.lit = lit ? "on" : "off";
      button.setAttribute("aria-pressed", String(lit));
      button.textContent = lit ? "그늘로 돌아가기" : "햇빛 비추기";
      button.disabled = false;
    };

    media.add({ reduced: "(prefers-reduced-motion: reduce)",
      normal: "(prefers-reduced-motion: no-preference)" }, (mediaContext) => {
      const reduced = Boolean(mediaContext.conditions?.reduced);
      gsap.set(indoor, { opacity: lit ? 0 : 1 });
      gsap.set(light, { left: lit ? "120%" : "-20%", opacity: 0 });
      finish();

      // 재생 버튼처럼 두 겹 그림과 빛 띠를 하나의 시간표로 움직인다.
      const toggle = contextSafe(() => {
        if (button.disabled) return;
        lit = !lit;
        if (reduced) {
          gsap.set(indoor, { opacity: lit ? 0 : 1 });
          gsap.set(light, { left: lit ? "120%" : "-20%", opacity: 0 });
          finish();
          return;
        }

        button.disabled = true;
        const duration = lit ? 2.2 : 4;
        const ease = lit ? "power2.out" : "power1.inOut";
        timeline = gsap.timeline({ onComplete: finish });
        timeline.to(indoor, { opacity: lit ? 0 : 1, duration, ease }, 0)
          .to(light, { left: lit ? "120%" : "-20%", duration, ease }, 0)
          .to(light, { opacity: 0.55, duration: duration / 2, ease }, 0)
          .to(light, { opacity: 0, duration: duration / 2, ease }, duration / 2);
      });

      button.addEventListener("click", toggle);
      return () => {
        timeline?.kill();
        button.removeEventListener("click", toggle);
      };
    });
    return () => media.revert();
  }, { scope: rootRef });

  return (
    <div ref={rootRef} className={styles.root} data-lit="off" data-colors={colors.join(",")}>
      <div className={styles.stage} aria-hidden="true"
        style={{ "--bead-base": BEAD_BASE } as CSSProperties}>
        <div className={styles.layer}>
          {colors.map((color, index) => (
            <span className={styles.bead} key={`${color}-${index}`}
              style={{ "--bead-color": COLOR_HEX[color] } as CSSProperties} />
          ))}
        </div>
        <div ref={indoorRef} className={`${styles.layer} ${styles.indoor}`}>
          {colors.map((color, index) => (
            <span className={styles.bead} key={`${color}-${index}`} />
          ))}
        </div>
        <div ref={lightRef} className={styles.light} />
      </div>
      <p className={styles.caption}>반응색: {colors.map((color) => COLOR_LABEL[color]).join(" · ")}</p>
      <button ref={buttonRef} className={styles.button} type="button" aria-pressed="false" disabled>
        햇빛 비추기
      </button>
      <p className={styles.caption}>
        연출입니다. 실제 발색 속도·색과 다릅니다.<br />
        실제 발색은 농도 · 노출 시간 · 날씨에 따라 다릅니다.
      </p>
    </div>
  );
}
