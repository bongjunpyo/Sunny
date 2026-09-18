import { Sun } from "../scene/Sun.tsx";
import { TextLink } from "../common/TextLink.tsx";
import { Header } from "../common/Header.tsx";
import { HeroMotion } from "../interaction/HeroMotion.tsx";
import styles from "./Hero.module.css";

/** 히어로 — 검은 화면에 태양 하나.
 *
 *  움직임은 여기에 없다. 값은 전부 CSS 변수로 빼 두었고,
 *  `components/interaction/HeroMotion`(조수희)이 스크롤에 따라 그 변수를 채운다.
 *  변수를 아무도 채우지 않으면 기본값이 적용되어 지금 화면 그대로다. */
export function Hero() {
  return (
    <HeroMotion className={styles.track} id="top" label="SUNNY 브랜드 인트로">
      <div className={styles.hero}>
        <a className={styles.skip} href="#collections">
          컬렉션으로 바로 가기
        </a>
        <Header />
        {/* progress 를 주지 않으면 바깥 변수(--sun-x · --sun-scale)를 따른다 */}
        <Sun />
        <div className={styles.copy}>
          <div>Jewelry, in a different light.</div>
          <h1>
            Wear
            <br />
            the light.
          </h1>
          <p>빛을 지니는 방식.</p>
          <TextLink href="#collections">컬렉션 살펴보기</TextLink>
        </div>
        <div className={styles.bottom}>
          <span>태양에서 시작된, 몸에 머무는 빛.</span>
          <span>SCROLL TO DISCOVER ↓</span>
        </div>
        {/* 아래 셋은 연출이 켜질 때만 보인다 (기본 투명도 0) */}
        <div className={styles.wash} aria-hidden="true" />
        <div className={styles.arrival}>
          <div>
            <span className={styles.arrivalEyebrow}>FROM THE SUN, TO YOU</span>
            <p>
              멀리 있는 빛을,
              <br />
              가까이 지니는 일.
            </p>
          </div>
        </div>
        <div className={styles.progress} aria-hidden="true" />
      </div>
    </HeroMotion>
  );
}
