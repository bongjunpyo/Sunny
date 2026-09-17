import { Sun } from "../scene/Sun.tsx";
import { TextLink } from "../common/TextLink.tsx";
import { Header } from "../common/Header.tsx";
import styles from "./Hero.module.css";

/** 히어로 — 검은 화면에 태양 하나.
 *  움직임은 아직 없다. 스크롤 연출은 components/interaction 이슈에서 이 구조 위에 얹는다. */
export function Hero() {
  return (
    <section className={styles.track} id="top" aria-label="SUNNY 브랜드 인트로">
      <div className={styles.hero}>
        <a className={styles.skip} href="#collections">
          컬렉션으로 바로 가기
        </a>
        <Header />
        <Sun progress={0} />
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
      </div>
    </section>
  );
}
