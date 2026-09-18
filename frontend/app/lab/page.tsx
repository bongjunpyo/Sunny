import { RevealText } from "../../components/interaction/RevealText.tsx";
import styles from "./page.module.css";

export const metadata = { title: "SUNNY — 연출 연습 화면" };

/** 연습 화면. 브랜드 화면이 아니라 components/interaction 의 부품을 확인하는 곳이다.
 *  부품이 완성되면 메인 페이지의 제자리로 옮긴다. */
export default function LabPage() {
  return (
    <main className={styles.lab}>
      <p className={styles.note}>
        연출 연습 화면입니다. 브랜드 화면이 아니며, <code>components/interaction/</code> 의 부품이
        스크롤에서 어떻게 보이는지 확인하는 곳입니다.
      </p>

      <div className={styles.spacer}>아래로 스크롤 ↓</div>

      <section className={styles.block}>
        <RevealText as="h2" text="빛은 지나가고, 감각은 머뭅니다." />
        <RevealText text="창가를 가로지르는 오후의 빛. 피부 위에 남는 짧은 온기. 우리는 일상 속 빛의 순간에서 시작합니다." />
      </section>

      <div className={styles.spacer}>더 아래로 ↓</div>

      <section className={styles.block}>
        <RevealText as="h2" text="더 빛나기보다, 나의 빛에 가까이." />
        <RevealText text="눈에 띄는 장식보다 오래 바라보게 되는 감각. 우리가 생각하는 빛은, 그런 모습에 가깝습니다." />
      </section>
    </main>
  );
}
