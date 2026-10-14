import Image from "next/image";
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
        {/* AI 생성 이미지 — Higgsfield · GPT Image 2.5 Flare 생성(2026-10-14, 요청 2e7762bb).
            실제 사진이 아니다. 밝기는 90~125% 사이를 천천히 반복한다(모션 감소면 고정) */}
        <figure className={styles.lightFigure}>
          <div className={styles.lightStudy}>
            <Image
              src="/images/our-story-flare.webp"
              alt="검은 바탕에서 사방으로 금빛 빛살이 번지며 뻗는 빛"
              fill
              sizes="(max-width: 700px) 100vw, 50vw"
            />
          </div>
          <figcaption className={styles.caption}>빛과 그림자</figcaption>
        </figure>
      </div>
    </section>
  );
}
