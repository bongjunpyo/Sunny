import Link from 'next/link';
import { imagePath } from './data';
import { productionSteps } from './production';
import { c, Eyebrow } from './ui';
import styles from './ProductionGallery.module.css';

export function ProductionGallery() {
  return (
    <section aria-label="제작 기록 목록">
      <div className={`${c('filter-row')} ${styles.bar}`}>
        <div className={c('filter-buttons')}>
          {productionSteps.map((step) => (
            <span key={step.slug} className={c('filter')}>{step.category}</span>
          ))}
        </div>
        <span className={c('micro')}>MAKING JOURNAL</span>
      </div>
      <ol className={styles.grid}>
        {productionSteps.map((step) => (
          <li key={step.slug}>
            <Link href={`/making/process#process-${step.slug}`} className={styles.photoLink} aria-label={`${step.title} — 전체 제작 기록`} draggable={false}>
              <div className={styles.photoFrame} data-step={step.slug}>
                <img src={imagePath(step.image)} alt={step.alt} width={960} height={1200} loading="lazy" draggable={false} />
              </div>
              <div className={styles.caption}>
                <Eyebrow>{step.label}</Eyebrow>
                <h3>{step.title}</h3>
                <p className={c('small-copy')}>{step.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
      <Link href="/making/process" className={styles.sharedLink}>
        <span>빛을 관찰하는 기록</span>
        <span aria-hidden="true">↗</span>
      </Link>
    </section>
  );
}
