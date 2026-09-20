import type { Metadata } from "next";
import { TextLink } from "../../components/common/TextLink.tsx";
import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "SUNNY — 브랜드 소개",
  description:
    "빛에 따라 드러나는 개인의 기록. 광변색 소재로 팔찌와 목걸이를 만드는 SUNNY의 시작과 방식.",
};

const MAKING_STEPS = ["모델링", "몰드", "성형", "전사", "도포", "조립"];

const TEAM = [
  { role: "웹 · 정보구조", work: "페이지 설계, 3D 씬 뼈대, 기록 정리" },
  { role: "인터랙션", work: "스크롤 연출, 실내·햇빛 발색 비교 화면" },
  { role: "서버 · 데이터", work: "서버 API, 콘텐츠 관리, 배포" },
];

export default function AboutPage() {
  return (
    <>
      <Header dark={false} />
      <main className={styles.page}>
        <div className={styles.head}>ABOUT</div>
        <h1 className={styles.title}>빛에 따라 드러나는 개인의 기록.</h1>
        <p className={styles.lead}>
          SUNNY는 햇빛을 만나면 색이 드러나는 비즈로 팔찌와 목걸이를 만듭니다. 실내에서는 조용한
          흰색에 가깝고, 밖으로 나가면 고른 색이 나타납니다. 빛이 닿는 동안에만 보이는 색을 몸에
          지니는 일 — 그것이 우리가 하려는 것입니다.
        </p>

        <section className={styles.section}>
          <h2>태양에서 시작했다</h2>
          <div>
            <p>
              바다는 윤슬로, 그늘은 잎 사이로 든 햇볕으로 빛을 입습니다. 모든 것은 저마다의 방식으로
              빛을 입고, 그 모습은 빛이 있는 동안에만 보입니다.
            </p>
            <p>
              우리는 그 순간을 붙잡아 두는 대신, 지니고 다닐 수 있는 형태로 옮기기로 했습니다.
              브랜드가 모아 온 관찰은 <b>제작 기록</b>에 하나씩 쌓입니다.
            </p>
            <TextLink href="/archive">빛을 입는 기록 보기</TextLink>
          </div>
        </section>

        <section className={styles.section}>
          <h2>광변색이란</h2>
          <div>
            <p>
              광변색 소재는 <b>햇빛(자외선)에 반응해 색이 변합니다.</b> 실내에서는 흰색에 가깝고,
              바깥으로 나가면 색이 드러납니다. 그늘로 들어오면 시간이 지나며 원래 색으로 돌아옵니다.
            </p>
            <p>
              색이 얼마나 짙게 드러나는지, 얼마나 빨리 돌아오는지는 <b>농도 · 노출 시간 · 날씨</b>에
              따라 다릅니다. 그래서 우리는 발색을 이야기할 때 늘 그 조건을 함께 적습니다.
            </p>
            <p className={styles.note}>
              광변색 소재는 자외선을 막아 주거나 건강에 도움을 주지 않습니다. SUNNY는 그런 효과를
              말하지 않습니다.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2>만드는 방식</h2>
          <div>
            <p>
              한 벌은 아래 단계를 거쳐 손으로 만들어집니다. 단계마다 남긴 사진과 메모는 제작 기록에
              올립니다.
            </p>
            <ul className={styles.steps}>
              {MAKING_STEPS.map((step, index) => (
                <li key={step}>
                  {String(index + 1).padStart(2, "0")} {step}
                </li>
              ))}
            </ul>
            <p className={styles.note}>
              지금은 형태를 찾아가는 단계입니다. 사이트에 보이는 제품 이미지는 형태 연구용
              그래픽이며, 판매 중인 상품이 아닙니다.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2>약속</h2>
          <ul className={styles.promises}>
            <li>
              <b>과장하지 않습니다.</b> 광변색은 색이 변한다는 사실까지만 말하고, 발색은 시험 조건과
              함께 적습니다.
            </li>
            <li>
              <b>동의받은 사진만 씁니다.</b> 커스텀 사진은 제작에만 쓰고, 브랜드 소개에 쓰려면 따로
              동의를 받습니다.
            </li>
            <li>
              <b>AI로 만든 이미지·영상은 그렇다고 적습니다.</b> 실제 촬영본과 구분합니다.
            </li>
            <li>
              <b>관측 자료는 출처를 밝힙니다.</b> 태양 관측 이미지는 제공처와 관측 시각을 함께
              표시하고, 확인하지 못하면 표시하지 않습니다.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>팀</h2>
          <div>
            <p>
              팀 <b>헬로 썬라이즈</b> — 2026학년도 2학기 창업캡스톤디자인 과제로 시작했습니다.
            </p>
            <ul className={styles.team}>
              {TEAM.map((member) => (
                <li key={member.role}>
                  <b>{member.role}</b>
                  <span>{member.work}</span>
                </li>
              ))}
            </ul>
            <p className={styles.note}>
              제품 제작을 맡은 팀원이 따로 있습니다. 문의는 사이트의 문의 기능으로 받습니다.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
