import Link from "next/link";
import { getProducts } from "../../lib/api.ts";
import type { Product } from "../../lib/types.ts";
import { ProductArt } from "./ProductArt.tsx";
import { TextLink } from "../common/TextLink.tsx";
import styles from "./main.module.css";

const KIND_LABEL = { bracelet: "팔찌", necklace: "목걸이" } as const;
const STATUS_LABEL = {
  planning: "기획 중",
  available: "판매 중",
  soldout: "품절",
} as const;

/** 컬렉션 — 데이터는 lib/api.ts 만 부른다 (지금은 mock). */
export async function CollectionsSection() {
  const products = await getProducts();

  return (
    <section className={`${styles.wrap} ${styles.collections}`} id="collections">
      <div className={styles.sectionHead}>
        <span>02 / COLLECTIONS</span>
        <span>팔찌와 목걸이, 하나의 언어</span>
      </div>
      <div className={styles.collectionTitle}>
        <h2 className={styles.headline}>Forms of light.</h2>
        <p>
          손목과 목선 위에 이어지는 빛.
          <br />
          서로 다른 형태로 전개할 두 컬렉션입니다.
        </p>
      </div>
      <div className={styles.productGrid}>
        {products.slice(0, 2).map((product: Product) => (
          <article key={product.slug}>
            <Link href={`/collection/${product.slug}`}>
              <ProductArt kind={product.kind} />
              <div className={styles.productMeta}>
                <h3>{product.name}</h3>
                <span>
                  {KIND_LABEL[product.kind]} 컬렉션 / {STATUS_LABEL[product.status]}
                </span>
              </div>
            </Link>
            <p className={styles.productNote}>{product.summary}</p>
          </article>
        ))}
      </div>
      <p className={styles.caption}>
        이미지는 형태 연구용 그래픽이며 실제 상품의 소재 · 디자인 · 가격을 나타내지 않습니다.
      </p>
      <TextLink href="/collection">컬렉션 전체 보기</TextLink>
    </section>
  );
}
