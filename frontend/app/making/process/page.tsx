import { Header } from '../../../components/common/Header';
import { Footer } from '../../../components/common/Footer';
import { ProductionProcess } from '../../../components/site/ProductionProcess';
import { Intro, TextLink, c } from '../../../components/site/ui';

export const metadata = {
  title: 'SUNNY — 전체 제작 기록',
  description: '사포질부터 광변색 염료 도포, UV 경화, 줄꿰기까지 한 장신구로 이어지는 전체 제작 과정입니다.',
};

export default function ProductionProcessPage() {
  return (
    <>
      <Header />
      <main id="main">
        <Intro title="하나의 장신구가 되기까지." eyebrow="THE MAKING OF SUNNY / PROCESS">
          사포질부터 줄꿰기까지.<br />
          아래로 스크롤하며 전체 제작 과정을 살펴보세요.
        </Intro>
        <div className={c('archive-page')}>
          <ProductionProcess />
          <div className={c('article-back')}>
            <TextLink href="/making">제작 기록 목록으로 돌아가기</TextLink>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
