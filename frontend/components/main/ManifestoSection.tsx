import { RevealText } from "../interaction/RevealText.tsx";
import styles from "./main.module.css";

export function ManifestoSection() {
  return (
    <section className={styles.manifesto} aria-labelledby="manifesto-title">
      <div
        className={styles.manifestoArt}
        role="img"
        aria-label="어두운 공간 위에 드리운 타원형 빛의 추상 표현"
      />
      <div className={styles.manifestoCopy}>
        <span className={styles.eyebrow}>THE SUNNY PERSPECTIVE</span>
        <div className={styles.revealHeadline} id="manifesto-title">
          <RevealText as="h2" text="더 빛나기보다, 나의 빛에 가까이." />
        </div>
        <p>
          눈에 띄는 장식보다 오래 바라보게 되는 감각.
          <br />
          우리가 생각하는 빛은, 그런 모습에 가깝습니다.
        </p>
        <span className={styles.eyebrow}>BRAND MOOD / LIGHT &amp; FORM</span>
      </div>
    </section>
  );
}
