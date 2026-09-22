"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COLOR_LABEL,
  LENGTH_OPTIONS,
  PHOTOCHROMIC_COLORS,
  type PhotochromicColor,
  type Product,
} from "../../lib/types.ts";
import {
  PHOTO_RULES,
  checkPhotoFile,
  checkPhotoSize,
  describeRules,
} from "../../lib/photo.ts";
import { COLOR_HEX } from "../../lib/colors.ts";
import { ProductArt } from "../main/ProductArt.tsx";
import styles from "./custom.module.css";

const KIND_LABEL = { bracelet: "팔찌", necklace: "목걸이" } as const;

/** 커스텀 구성 — 제품을 고르면 왼쪽에 그림, 오른쪽에 드롭다운이 붙는다.
 *  사진은 브라우저 안에서만 확인하고 서버로 보내지 않는다. */
export function CustomBuilder({
  products,
  initialSlug,
}: {
  products: Product[];
  /** 메인 카드에서 넘어오면 그 제품이 골라진 채로 시작한다 */
  initialSlug?: string;
}) {
  const [productSlug, setProductSlug] = useState(
    initialSlug ?? products[0]?.slug ?? "",
  );
  const [color, setColor] = useState<PhotochromicColor>("violet");
  const [length, setLength] = useState(() => {
    const first = products.find(
      (item) => item.slug === (initialSlug ?? products[0]?.slug),
    );
    const options = first ? LENGTH_OPTIONS[first.kind] : [];
    return options[1] ?? options[0] ?? "";
  });
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const product = useMemo(
    () => products.find((item) => item.slug === productSlug) ?? products[0],
    [products, productSlug],
  );
  const lengths = product ? LENGTH_OPTIONS[product.kind] : [];

  // 제품을 바꾸면 길이 선택지가 달라진다 — 가운데 값으로 맞춘다
  useEffect(() => {
    setLength(lengths[1] ?? lengths[0] ?? "");
  }, [productSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

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
      const size = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const image = new Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error("이미지로 열 수 없습니다."));
          image.src = url;
        },
      );
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
    <>
      <div className={styles.tabs} role="group" aria-label="제품 고르기">
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

      <div className={styles.layout}>
        <div className={styles.art}>
          {product ? <ProductArt kind={product.kind} /> : null}
          <p className={styles.artNote}>
            형태 연구용 그래픽입니다. 고른 옵션이 그림에 반영되지는 않습니다.
          </p>
          <div className={styles.productName}>
            <h2>{product?.name ?? "제품"}</h2>
            <p>{product?.summary}</p>
          </div>
        </div>

        <div>
          <section className={styles.group}>
            <label className={styles.label} htmlFor="custom-color">
              광변색 반응색
            </label>
            <select
              id="custom-color"
              className={styles.select}
              value={color}
              onChange={(event) =>
                setColor(event.target.value as PhotochromicColor)
              }
            >
              {PHOTOCHROMIC_COLORS.map((value) => (
                <option key={value} value={value}>
                  {COLOR_LABEL[value]}
                </option>
              ))}
            </select>
            <p className={styles.colorRow}>
              <span
                className={styles.swatch}
                style={{ background: COLOR_HEX[color] }}
                aria-hidden="true"
              />
              햇빛(자외선)을 만나면 이 색이 드러납니다. 정도는 농도 · 노출 시간
              · 날씨에 따라 다릅니다.
            </p>
          </section>

          <section className={styles.group}>
            <label className={styles.label} htmlFor="custom-length">
              길이
            </label>
            <select
              id="custom-length"
              className={styles.select}
              value={length}
              onChange={(event) => setLength(event.target.value)}
            >
              {lengths.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <p>
              {product ? `${KIND_LABEL[product.kind]} 기준 길이입니다.` : null}
            </p>
          </section>

          <section className={styles.group}>
            <h2>비즈 배열</h2>
            <p className={styles.fixed}>
              <b>균일 배열 고정</b> — 고르지 않습니다.
            </p>
          </section>

          <section className={styles.group}>
            <h2>커스텀 사진 · 선택 사항</h2>
            <p>
              넣지 않아도 주문할 수 있습니다. 고른 사진은 이 브라우저에서만
              확인하고 보내지 않습니다.
            </p>

            <label className={styles.file}>
              사진 고르기
              <input
                type="file"
                accept={PHOTO_RULES.accept.join(",")}
                onChange={onPickPhoto}
              />
            </label>

            {photoUrl ? (
              <div className={styles.photoRow}>
                {/* 브라우저 안의 미리보기라 next/image 를 쓰지 않는다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.preview}
                  src={photoUrl}
                  alt="고른 사진 미리보기"
                />
                <span className={styles.fixed}>{photoName}</span>
                <button
                  type="button"
                  className={styles.choice}
                  onClick={clearPhoto}
                >
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
                  <br />이 규격은 <b>회의 전 임시값</b>입니다. 확정되면 서버가
                  알려주는 값으로 바뀝니다.
                </>
              ) : null}
            </p>
          </section>

          <aside className={styles.summary} aria-label="구성 요약">
            <h2>구성 요약</h2>
            <div className={styles.row}>
              <span>제품</span>
              <span>
                {product
                  ? `${product.name} · ${KIND_LABEL[product.kind]}`
                  : "-"}
              </span>
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
              금액과 제작 일정은 서버가 계산합니다. 지금은 화면 구성만 확인하는
              단계라 금액을 표시하지 않습니다.
            </p>
            <button
              type="button"
              className={styles.cta}
              onClick={() => setChecked(true)}
            >
              구성 확인
            </button>
            {checked ? (
              <p className={styles.note} role="status">
                구성을 확인했습니다. 주문 요청은 서버가 연결된 뒤에 보낼 수
                있습니다.
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
