import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStories, getStory } from "../../../lib/api.ts";
import { SeaCover } from "../../../components/archive/SeaCover.tsx";
import { Header } from "../../../components/common/Header.tsx";
import { Footer } from "../../../components/common/Footer.tsx";
import styles from "./page.module.css";

export async function generateStaticParams() {
  const stories = await getStories();
  return stories.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return { title: "SUNNY — 찾을 수 없는 기록" };
  return { title: `SUNNY — ${story.title}`, description: story.wordMeaning };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) notFound();

  return (
    <>
      <Header dark={false} />
      <main className={styles.page}>
        <div className={styles.crumb}>
          <Link href="/archive">ARCHIVE</Link> / {story.date} · {story.stage}
        </div>

        <h1 className={styles.title}>{story.title}</h1>
        <p className={styles.word}>
          <b>{story.word}</b>
          <span>{story.wordMeaning}</span>
        </p>

        <SeaCover
          label={`STORY ${String(story.order).padStart(2, "0")} / ${story.subject}`}
          tall
        />
        <p className={styles.crumb} style={{ border: 0, paddingTop: "var(--step-1)" }}>
          커버 · 코드로 그린 시안 (실제 촬영 아님)
        </p>

        <div className={styles.body}>
          {story.body.map((paragraph) => (
            <p key={paragraph.slice(0, 16)}>{paragraph}</p>
          ))}
        </div>

        {story.notes.length > 0 ? (
          <section className={styles.notes}>
            <h2>메모</h2>
            <ul>
              {story.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.test}>
          <h2>발색 시험 기록</h2>
          {story.test ? (
            <>
              <div className={styles.row}>
                <span>농도</span>
                <span>{story.test.concentration}</span>
              </div>
              <div className={styles.row}>
                <span>노출 시간</span>
                <span>{story.test.exposure}</span>
              </div>
              <div className={styles.row}>
                <span>날씨</span>
                <span>{story.test.weather}</span>
              </div>
              <p style={{ marginTop: "var(--step-2)" }}>{story.test.result}</p>
            </>
          ) : (
            <p>
              이 기록에는 발색 시험이 없습니다. 발색은 <b>농도 · 노출 시간 · 날씨</b>를 함께 적어야
              하므로, 조건을 기록한 시험만 싣습니다.
            </p>
          )}
        </section>

        <Link className={styles.back} href="/archive">
          기록 목록으로 ↑
        </Link>
      </main>
      <Footer />
    </>
  );
}
