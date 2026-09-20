import Link from "next/link";
import type { Metadata } from "next";
import { getStories } from "../../lib/api.ts";
import { SeaCover } from "../../components/archive/SeaCover.tsx";
import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "SUNNY — 제작 기록",
  description: "모든 것은 저마다의 방식으로 빛을 입는다. SUNNY가 모아가는 빛을 입는 기록.",
};

export default async function ArchivePage() {
  const stories = await getStories();

  return (
    <>
      <Header dark={false} />
      <main className={styles.page}>
        <div className={styles.head}>ARCHIVE</div>
        <div className={styles.intro}>
          <h1 className={styles.title}>빛을 입는 기록.</h1>
          <p className={styles.lead}>
            모든 것은 저마다의 방식으로 빛을 입는다. 바다는 윤슬로. 그 방식을 하나씩 모읍니다.
          </p>
        </div>

        <div className={styles.grid}>
          {stories.map((story) => (
            <Link className={styles.card} key={story.slug} href={`/archive/${story.slug}`}>
              <SeaCover label={`STORY ${String(story.order).padStart(2, "0")} / ${story.subject}`} />
              <h2>{story.title}</h2>
              <p className={styles.word}>{story.word}</p>
              <p className={styles.meaning}>{story.wordMeaning}</p>
              <p className={styles.meta}>
                {story.date} · {story.stage}
              </p>
            </Link>
          ))}
        </div>

        <p className={styles.note}>
          커버는 코드로 그린 분위기 시안입니다. 실제 촬영이나 AI 생성물로 바꿀 때는 생성물이라고
          표기합니다.
        </p>
      </main>
      <Footer />
    </>
  );
}
