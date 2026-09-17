import { Hero } from "../components/main/Hero.tsx";
import { StorySection } from "../components/main/StorySection.tsx";
import { CollectionsSection } from "../components/main/CollectionsSection.tsx";
import { ManifestoSection } from "../components/main/ManifestoSection.tsx";
import { SolarJournalSection } from "../components/main/SolarJournalSection.tsx";
import { Footer } from "../components/common/Footer.tsx";

/** 메인 — 시안 docs/design/brand-preview.html 의 구간을 순서대로 조립한다.
 *  스크롤 연출은 다음 이슈에서 components/interaction 이 이 구조 위에 얹는다. */
export default function HomePage() {
  return (
    <>
      <main>
        <Hero />
        <StorySection />
        <CollectionsSection />
        <ManifestoSection />
        <SolarJournalSection />
      </main>
      <Footer />
    </>
  );
}
