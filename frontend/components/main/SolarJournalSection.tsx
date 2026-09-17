import { TextLink } from "../common/TextLink.tsx";
import styles from "./main.module.css";

/** 태양 기록 — 실제 관측 자료 자리.
 *  서버 API 가 없는 동안에는 "불러오지 못함"을 그대로 보여준다.
 *  감성 연출용 이미지나 AI 이미지를 이 자리에 넣지 않는다. */
export function SolarJournalSection() {
  return (
    <section className={styles.wrap} id="journal">
      <div className={styles.sectionHead}>
        <span>03 / SOLAR JOURNAL</span>
        <span>우리의 영감이 시작되는 곳</span>
      </div>
      <div className={styles.journalGrid}>
        <div>
          <div className={styles.observation}>
            <div>
              <span className={styles.obsIcon} aria-hidden="true" />
              <span>
                관측 자료 연결 전
                <br />
                실제 태양 이미지 · 관측 시각 없음
              </span>
            </div>
          </div>
          <p className={styles.caption}>관측 영역 · 브랜드 연출 이미지와 구분됩니다.</p>
        </div>
        <div>
          <span className={styles.eyebrow}>NASA / SDO · AIA 171 Å</span>
          <h2 className={styles.headline}>
            같은 태양,
            <br />
            매번 다른 기록.
          </h2>
          <p className={styles.bodyCopy}>
            SUNNY의 이야기가 시작되는 빛을 바라봅니다. 관측 자료는 브랜드의 영감을 기록하는 창이
            됩니다.
          </p>
          <p className={styles.status}>외부 연결 전 · 관측 시각 미확인</p>
          <p className={styles.bodyCopy} style={{ fontSize: 11 }}>
            파장별 관측을 색으로 표현한 이미지로, 육안으로 보이는 태양의 색과 다릅니다. 관측 시각을
            확인하지 못하면 표시하지 않습니다.
          </p>
          <TextLink href="https://sdo.gsfc.nasa.gov/data/">NASA 공식 자료 보기</TextLink>
          <p className={styles.credits}>
            Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.
            <br />
            NASA와의 제휴 또는 제품 인증을 의미하지 않습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
