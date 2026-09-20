"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LEGAL_DOCS, type LegalDocId } from "../../lib/legal.ts";
import styles from "./TermsDialog.module.css";

/** 약관 보기 — 페이지를 떠나지 않고 그 자리에서 읽는 창.
 *  데스크톱은 가운데 모달, 모바일(≤700px)은 아래에서 올라오는 바텀시트.
 *
 *  브라우저의 <dialog> 를 쓰므로 Esc 닫기 · 포커스 가두기 · 배경 잠금이 기본으로 동작한다.
 *  닫으면 눌렀던 버튼으로 포커스가 돌아간다. */
export function useTermsDialog() {
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null);
  return {
    openDoc,
    open: (id: LegalDocId) => setOpenDoc(id),
    close: () => setOpenDoc(null),
  };
}

export function TermsDialog({
  docId,
  onClose,
  onSwitch,
}: {
  docId: LegalDocId | null;
  onClose: () => void;
  onSwitch: (id: LegalDocId) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (docId && !dialog.open) {
      dialog.showModal();
      bodyRef.current?.scrollTo(0, 0);
    }
    if (!docId && dialog.open) dialog.close();
  }, [docId]);

  // 배경(창 바깥)을 누르면 닫는다
  const onClickBackdrop = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === ref.current) onClose();
    },
    [onClose]
  );

  const doc = docId ? LEGAL_DOCS[docId] : null;
  const other: LegalDocId = docId === "terms" ? "privacy" : "terms";

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="legal-title"
      onClose={onClose}
      onClick={onClickBackdrop}
    >
      {doc ? (
        <div className={styles.inner}>
          <div className={styles.grip} aria-hidden="true" />
          <div className={styles.head}>
            <div>
              <h2 className={styles.title} id="legal-title">
                {doc.title}
              </h2>
              <p className={styles.meta}>
                버전 {doc.version} · 작성 {doc.writtenAt} ·{" "}
                {doc.effectiveAt ? `시행 ${doc.effectiveAt}` : "시행일 미정"}
              </p>
            </div>
            <button className={styles.close} onClick={onClose} aria-label="닫기">
              ✕
            </button>
          </div>

          <div className={styles.body} ref={bodyRef}>
            <p className={styles.notice}>{doc.notice}</p>
            {doc.sections.map((section) => (
              <section className={styles.section} key={section.heading}>
                <h3>{section.heading}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 16)}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>

          <div className={styles.foot}>
            <button className={styles.switch} onClick={() => onSwitch(other)}>
              {LEGAL_DOCS[other].title} 보기 →
            </button>
            <button className={styles.done} onClick={onClose}>
              확인
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
