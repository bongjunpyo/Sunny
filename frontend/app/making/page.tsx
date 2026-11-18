import { Header } from '../../components/common/Header';
import { Footer } from '../../components/common/Footer';
import { ProductionGallery } from '../../components/site/ProductionGallery';
import { Intro, c } from '../../components/site/ui';

export const metadata = {
  title: 'SUNNY — 제작 기록',
  description: '사포질, 광변색 염료 도포, UV 경화, 줄꿰기까지 SUNNY의 제작 과정을 기록합니다.',
};

export default function MakingPage() {
  return (
    <>
      <Header />
      <main id="main">
        <Intro title="손끝에서 만들어지는 기록." eyebrow="THE MAKING OF SUNNY">
          사포로 다듬고, 붓으로 도포하고.<br />
          비즈가 하나의 장신구로 이어지는 과정을 담습니다.
        </Intro>
        <div className={c('archive-page')}>
          <ProductionGallery />
        </div>
      </main>
      <Footer />
    </>
  );
}
