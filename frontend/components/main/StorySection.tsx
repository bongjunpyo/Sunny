import { TextLink } from "../common/TextLink.tsx";
import { RevealText } from "../interaction/RevealText.tsx";
import styles from "./main.module.css";

export function StorySection() {
  return (
    <section className={styles.wrap} id="story">
      <div className={styles.sectionHead}>
        <span>01 / OUR STORY</span>
        <span>태양과 교감한다는 것</span>
      </div>
      <div className={styles.storyGrid}>
        <div>
          <div className={styles.eyebrow}>A quiet connection.</div>
          {/* 수희의 연출 부품. 줄바꿈 태그 대신 최대 너비로 접는다 (부품 입력은 text·as 두 개) */}
          <div className={styles.revealHeadline}>
            <RevealText as="h2" text="빛은 지나가고, 감각은 머뭅니다." />
          </div>
          <div className={styles.revealBody}>
            <RevealText text="창가를 가로지르는 오후의 빛. 피부 위에 남는 짧은 온기. 우리는 일상 속 빛의 순간에서 시작합니다." />
          </div>
          <div className={styles.revealBody}>
            <RevealText text="SUNNY는 태양과의 연결을 몸에 지니는 형태로 풀어가는 브랜드입니다." />
          </div>
          <TextLink href="#collections" mark="↓">
            두 가지 형태의 시작
          </TextLink>
        </div>
        <div>
          <div
            className={styles.lightStudy}
            role="img"
            aria-label="사선으로 떨어지는 빛과 그림자의 추상 표현"
          >
            <span className={styles.imageLabel}>STUDY OF LIGHT — No. 01</span>
          </div>
          <p className={styles.caption}>빛과 그림자 · 코드로 구현한 브랜드 무드 연구</p>
        </div>
      </div>
    </section>
  );
}
