import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.placeholder}>
      <span className={styles.eyebrow}>Jewelry, in a different light.</span>
      <h1 className={styles.title}>
        Wear
        <br />
        the light.
      </h1>
      <p className={styles.note}>
        앱 뼈대만 세운 자리표시 화면이다. 메인 구성은 다음 이슈에서
        <code> docs/design/brand-preview.html </code>
        시안대로 채운다.
      </p>
    </main>
  );
}
