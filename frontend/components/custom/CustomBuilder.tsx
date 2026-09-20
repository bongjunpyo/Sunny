"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLOR_LABEL,
  LENGTH_OPTIONS,
  PHOTOCHROMIC_COLORS,
  type PhotochromicColor,
  type Product,
} from "../../lib/types.ts";
import { PHOTO_RULES, checkPhotoFile, checkPhotoSize, describeRules } from "../../lib/photo.ts";
import styles from "./custom.module.css";

const SWATCH: Record<PhotochromicColor, string> = {
  red: "#c24b40",
  orange: "#d9853b",
  blue: "#3f67a8",
  yellow: "#d8b43a",
  violet: "#7c5aa6",
};

const KIND_LABEL = { bracelet: "팔찌", necklace: "목걸이" } as const;

/** 커스텀 구성 — 고른 값을 오른쪽 요약에 모은다.
 *  사진은 브라우저 안에서만 확인하고 서버로 보내지 않는다. */
export function CustomBuilder({ products }: { products: Product[] }) {
  const [productSlug, setProductSlug] = useState(products[0]?.slug ?? "");
  const [color, setColor] = useState<PhotochromicColor>("violet");
  const [length, setLength] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const product = useMemo(
    () => products.find((item) => item.slug === productSlug) ?? products[0],
    [products, productSlug]
  );
  const lengths = product ? LENGTH_OPTIONS[product.kind] : [];

  // 제품을 바꾸면 길이 선택지가 달라진다
  useEffect(() => {
    setLength(lengths[1] ?? lengths[0] ?? "");
  }, [productSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // 미리보기 주소는 다 쓰면 풀어준다
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  async function onPickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPhotoError(null);
    const fileError = checkPhotoFile(file);
    if (fileError) {
      setPhotoError(fileError);
      return;
    }

    // 실제로 이미지로 열어 본다 — 확장자만 바꾼 파일은 여기서 걸린다
    const url = URL.createObjectURL(file);
    try {
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error("이미지로 열 수 없습니다."));
        image.src = url;
      });
      const sizeError = checkPhotoSize(size.width, size.height);
      if (sizeError) {
        URL.revokeObjectURL(url);
        setPhotoError(sizeError);
        return;
      }
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(url);
      setPhotoName(file.name);
    } catch {
      URL.revokeObjectURL(url);
      setPhotoError("이미지로 열 수 없는 파일입니다.");
    }
  }

  function clearPhoto() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoName(null);
    setPhotoError(null);
  }

  return (
    <div className={styles.layout}>
      <div>
        <section className={styles.group}>
          <h2>제품</h2>
          <p>팔찌와 목걸이 중에서 고릅니다. 모두 형태 연구 단계입니다.</p>
          <div className={styles.choices}>
            {products.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={styles.choice}
                aria-pressed={item.slug === productSlug}
                onClick={() => setProductSlug(item.slug)}
              >
                {item.name} · {KIND_LABEL[item.kind]}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <h2>광변색 반응색</h2>
          <p>
            실내에서는 흰색에 가깝고, 햇빛(자외선)을 만나면 고른 색이 드러납니다. 색이 드러나는
            정도는 농도 · 노출 시간 · 날씨에 따라 다릅니다.
          </p>
          <div className={styles.choices}>
            {PHOTOCHROMIC_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.choice}
                aria-pressed={value === color}
                onClick={() => setColor(value)}
              >
                <span
                  className={styles.swatch}
                  style={{ background: SWATCH[value] }}
                  aria-hidden="true"
                />
                {COLOR_LABEL[value]}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <h2>길이</h2>
          <p>손목 둘레나 목선에 맞춰 고릅니다.</p>
          <div className={styles.choices}>
            {lengths.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.choice}
                aria-pressed={value === length}
                onClick={() => setLength(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <h2>비즈 배열</h2>
          <p className={styles.fixed}>
            <b>균일 배열 고정</b> — 고객이 고르지 않습니다.
          </p>
        </section>

        <section className={styles.group}>
          <h2>커스텀 사진 · 선택 사항</h2>
          <p>넣지 않아도 주문할 수 있습니다. 고른 사진은 이 브라우저에서만 확인하고 보내지 않습니다.</p>

          <label className={styles.file}>
            사진 고르기
            <input
              ref={inputRef}
              type="file"
              accept={PHOTO_RULES.accept.join(",")}
              onChange={onPickPhoto}
            />
          </label>

          {photoUrl ? (
            <div className={styles.photoRow}>
              {/* 브라우저 안의 미리보기라 next/image 를 쓰지 않는다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.preview} src={photoUrl} alt="고른 사진 미리보기" />
              <span className={styles.fixed}>{photoName}</span>
              <button type="button" className={styles.choice} onClick={clearPhoto}>
                지우기
              </button>
            </div>
          ) : null}

          {photoError ? (
            <p className={styles.error} role="alert">
              {photoError}
            </p>
          ) : null}

          <p className={styles.rules}>
            {describeRules()}
            {PHOTO_RULES.provisional ? (
              <>
                <br />이 규격은 <b>회의 전 임시값</b>입니다. 확정되면 서버가 알려주는 값으로 바뀝니다.
              </>
            ) : null}
          </p>
        </section>
      </div>

      <aside className={styles.summary} aria-label="구성 요약">
        <h2>구성 요약</h2>
        <div className={styles.row}>
          <span>제품</span>
          <span>{product ? `${product.name} · ${KIND_LABEL[product.kind]}` : "-"}</span>
        </div>
        <div className={styles.row}>
          <span>반응색</span>
          <span>{COLOR_LABEL[color]}</span>
        </div>
        <div className={styles.row}>
          <span>길이</span>
          <span>{length || "-"}</span>
        </div>
        <div className={styles.row}>
          <span>비즈 배열</span>
          <span>균일 배열 (고정)</span>
        </div>
        <div className={styles.row}>
          <span>사진</span>
          <span>{photoName ?? "넣지 않음"}</span>
        </div>
        <div className={styles.price}>
          <span>금액</span>
          <span>서버 연결 전</span>
        </div>
        <p className={styles.note}>
          금액과 제작 일정은 서버가 계산합니다. 지금은 화면 구성만 확인하는 단계라 금액을 표시하지
          않습니다.
        </p>
        <button type="button" className={styles.cta} onClick={() => setSummaryOpen(true)}>
          구성 확인
        </button>
        {summaryOpen ? (
          <p className={styles.note} role="status">
            구성을 확인했습니다. 주문 요청은 서버가 연결된 뒤에 보낼 수 있습니다.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
