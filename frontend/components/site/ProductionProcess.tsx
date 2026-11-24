import { imagePath } from './data';
import { productionSteps } from './production';
import { Eyebrow } from './ui';
import styles from './ProductionGallery.module.css';

export function ProductionProcess() {
  return (
    <section aria-label="전체 제작 과정">
      <ol className={styles.processList} aria-label="제작 과정, 위에서 아래로 보기">
        {productionSteps.map((step) => (
          <li key={step.slug} id={`process-${step.slug}`} className={styles.processStep}>
            <div className={styles.photoFrame}>
              <img
                src={imagePath(step.image)}
                alt={step.alt}
                width={960}
                height={1200}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
            <div className={styles.copy}>
              <Eyebrow>{step.label}</Eyebrow>
              <h2>{step.title}</h2>
              {step.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
