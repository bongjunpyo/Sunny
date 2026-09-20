import type { Metadata } from "next";
import { getProducts } from "../../lib/api.ts";
import { CustomBuilder } from "../../components/custom/CustomBuilder.tsx";
import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import styles from "../../components/custom/custom.module.css";

export const metadata: Metadata = {
  title: "SUNNY — 커스텀",
  description: "반응색과 길이를 고르고 사진을 더해 나만의 구성을 만들어 봅니다.",
};

export default async function CustomPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const [products, { product }] = await Promise.all([getProducts(), searchParams]);
  // 주소에 없는 제품이 적혀 있으면 첫 제품으로 둔다
  const initialSlug = products.some((item) => item.slug === product) ? product : undefined;

  return (
    <>
      <Header dark={false} />
      <main className={styles.page}>
        <div className={styles.head}>CUSTOM</div>
        <h1 className={styles.title}>빛을 고르는 일.</h1>
        <p className={styles.lead}>
          반응색과 길이를 고르고, 원하면 사진을 더합니다. 지금은 화면 구성을 확인하는 단계라 주문은
          보낼 수 없습니다.
        </p>
        <CustomBuilder products={products} initialSlug={initialSlug} />
      </main>
      <Footer />
    </>
  );
}
