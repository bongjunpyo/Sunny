import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getProducts } from "../../../lib/api.ts";
import { COLOR_LABEL } from "../../../lib/types.ts";
import { COLOR_HEX } from "../../../lib/colors.ts";
import { SunlightToggle } from "../../../components/interaction/SunlightToggle.tsx";
import { ProductArt } from "../../../components/main/ProductArt.tsx";
import { Header } from "../../../components/common/Header.tsx";
import { Footer } from "../../../components/common/Footer.tsx";
import styles from "./page.module.css";

const KIND_LABEL = { bracelet: "팔찌", necklace: "목걸이" } as const;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "SUNNY — 찾을 수 없는 제품" };
  return { title: `SUNNY — ${product.name}`, description: product.summary };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <>
      <Header dark={false} />
      <main className={styles.wrap}>
        <div className={styles.crumb}>
          <Link href="/collection">COLLECTIONS</Link> / {product.name}
        </div>

        <div className={styles.grid}>
          <div>
            <ProductArt kind={product.kind} />
            <p className={styles.crumb} style={{ border: 0, paddingTop: "var(--step-1)" }}>
              형태 연구용 그래픽 · 실제 상품 사진이 아닙니다
            </p>
          </div>

          <div>
            <h1 className={styles.title}>{product.name}</h1>
            <div className={styles.meta}>
              <span>{KIND_LABEL[product.kind]}</span>
              <span>기획 중</span>
            </div>

            <div className={styles.story}>
              {product.story.map((paragraph) => (
                <p key={paragraph.slice(0, 12)}>{paragraph}</p>
              ))}
            </div>

            <h2 className={styles.crumb} style={{ border: 0, padding: 0 }}>
              반응색
            </h2>
            <div className={styles.colors}>
              {product.colors.map((color) => (
                <span className={styles.color} key={color}>
                  <span
                    className={styles.swatch}
                    style={{ background: COLOR_HEX[color] }}
                    aria-hidden="true"
                  />
                  {COLOR_LABEL[color]}
                </span>
              ))}
            </div>
            <p className={styles.compare} style={{ border: 0, padding: 0, marginTop: 0 }}>
              햇빛(자외선)을 만나면 색이 드러납니다. 색이 드러나는 정도는 농도 · 노출 시간 ·
              날씨에 따라 다릅니다.
            </p>

            <section className={styles.compare}>
              <h2>실내 / 햇빛 비교</h2>
              <p>
                버튼을 누르면 햇빛이 들어와 색이 드러납니다. 다시 누르면 그늘 상태로 돌아옵니다.
                실제 발색 사진과 시험 조건(농도 · 노출 시간 · 날씨)은 준비되는 대로 함께 싣습니다.
              </p>
              {/* 연출은 components/interaction (조수희) 에서 채운다 — 이슈 #56 */}
              <SunlightToggle colors={product.colors} />
            </section>

            <Link className={styles.back} href="/collection">
              컬렉션으로 돌아가기 ↑
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
