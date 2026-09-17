import type { ProductKind } from "../../lib/types.ts";
import styles from "./main.module.css";

/** 형태 연구용 그래픽. 실제 상품 사진이 아니며 소재·잠금장치를 나타내지 않는다. */
export function ProductArt({ kind }: { kind: ProductKind }) {
  return (
    <div className={styles.productArt}>
      <span className={styles.artNote}>FORM STUDY / NOT A FINAL PRODUCT</span>
      {kind === "bracelet" ? <BraceletStudy /> : <NecklaceStudy />}
    </div>
  );
}

function BraceletStudy() {
  return (
    <svg viewBox="0 0 500 570" role="img" aria-label="팔찌 컬렉션을 위한 개방형 곡선의 형태 연구 시안">
      <defs>
        <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#695c48" />
          <stop offset=".24" stopColor="#ded2b7" />
          <stop offset=".38" stopColor="#faf3df" />
          <stop offset=".51" stopColor="#8e7c5a" />
          <stop offset=".68" stopColor="#e0cfaa" />
          <stop offset="1" stopColor="#6a5b42" />
        </linearGradient>
        <filter id="artShadow">
          <feGaussianBlur stdDeviation="11" />
        </filter>
        <linearGradient id="paperBg">
          <stop stopColor="#eee9de" />
          <stop offset="1" stopColor="#cfc5b3" />
        </linearGradient>
      </defs>
      <rect width="500" height="570" fill="url(#paperBg)" />
      <path d="M0 410L500 160V570H0" fill="#b1a18a" opacity=".1" />
      <ellipse cx="250" cy="390" rx="135" ry="22" fill="#504632" opacity=".22" filter="url(#artShadow)" />
      <g transform="rotate(-25 250 280)">
        <path d="M336 348 A124 101 0 1 1 367 256" fill="none" stroke="#74684f" strokeWidth="23" />
        <path d="M336 344 A124 101 0 1 1 367 252" fill="none" stroke="url(#metal)" strokeWidth="18" />
        <path d="M334 340 A121 100 0 1 1 365 250" fill="none" stroke="#f5ecd4" strokeWidth="1.5" opacity=".7" />
      </g>
    </svg>
  );
}

function NecklaceStudy() {
  return (
    <svg viewBox="0 0 500 570" role="img" aria-label="목걸이 컬렉션을 위한 곡선과 원형의 형태 연구 시안">
      <defs>
        <linearGradient id="silver">
          <stop stopColor="#686b68" />
          <stop offset=".22" stopColor="#eae8df" />
          <stop offset=".45" stopColor="#999d98" />
          <stop offset=".65" stopColor="#f6f3e8" />
          <stop offset="1" stopColor="#686d68" />
        </linearGradient>
        <linearGradient id="stone" x2=".7" y2="1">
          <stop stopColor="#cac9bf" />
          <stop offset="1" stopColor="#e6e1d6" />
        </linearGradient>
      </defs>
      <rect width="500" height="570" fill="url(#stone)" />
      <path d="M0 0H190L480 570H0Z" fill="#fff" opacity=".12" />
      <path
        d="M100 -30 Q115 305 249 344 Q392 320 413 -30"
        fill="none"
        stroke="#686458"
        strokeWidth="8"
        opacity=".15"
        transform="translate(7 11)"
      />
      <path d="M100 -30 Q115 305 249 344 Q392 320 413 -30" fill="none" stroke="url(#silver)" strokeWidth="5" />
      <ellipse cx="250" cy="372" rx="30" ry="37" fill="none" stroke="#646960" strokeWidth="11" />
      <ellipse cx="249" cy="370" rx="30" ry="37" fill="none" stroke="url(#silver)" strokeWidth="9" />
      <ellipse cx="247" cy="368" rx="27" ry="34" fill="none" stroke="#f3f0e7" strokeWidth="1" />
    </svg>
  );
}
