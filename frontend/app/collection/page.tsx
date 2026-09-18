import Link from "next/link";
import type { Metadata } from "next";
import { getProducts } from "../../lib/api.ts";
import { COLOR_LABEL, type ProductKind } from "../../lib/types.ts";
import { ProductArt } from "../../components/main/ProductArt.tsx";
import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "SUNNY — 컬렉션",
  description: "빛에 반응하는 팔찌와 목걸이. 형태 연구 중인 SUNNY의 컬렉션.",
};

const KIND_LABEL = { bracelet: "팔찌", necklace: "목걸이" } as const;
const FILTERS = [
  { value: undefined, label: "전체" },
  { value: "bracelet" as const, label: "팔찌" },
  { value: "necklace" as const, label: "목걸이" },
];

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const selected: ProductKind | undefined =
    kind === "bracelet" || kind === "necklace" ? kind : undefined;
  const products = await getProducts(selected);

  return (
    <>
      <Header dark={false} />
      <main className={styles.wrap}>
        <div className={styles.head}>
          <span>COLLECTIONS</span>
          <span>팔찌와 목걸이, 하나의 언어</span>
        </div>
        <h1 className={styles.title}>Forms of light.</h1>
        <p className={styles.lead}>
          손목과 목선 위에 이어지는 빛. 아직 형태를 찾아가는 중이라, 지금 보이는 것은 모두 연구
          단계의 기록입니다.
        </p>

        <nav className={styles.filters} aria-label="종류 고르기">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `/collection?kind=${f.value}` : "/collection"}
              aria-current={selected === f.value ? "true" : undefined}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        <div className={styles.grid}>
          {products.map((product) => (
            <Link key={product.slug} href={`/collection/${product.slug}`}>
              <ProductArt kind={product.kind} />
              <div className={styles.name}>
                <h2>{product.name}</h2>
                <span>
                  {KIND_LABEL[product.kind]} · 기획 중
                </span>
              </div>
              <p className={styles.summary}>{product.summary}</p>
              <p className={styles.summary}>
                반응색 {product.colors.map((c) => COLOR_LABEL[c]).join(" · ")}
              </p>
            </Link>
          ))}
        </div>

        <p className={styles.note}>
          이미지는 형태 연구용 그래픽이며 실제 상품의 소재 · 디자인 · 가격을 나타내지 않습니다.
        </p>
      </main>
      <Footer />
    </>
  );
}
