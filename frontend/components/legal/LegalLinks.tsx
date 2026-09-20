"use client";

import { TermsDialog, useTermsDialog } from "./TermsDialog.tsx";
import styles from "./LegalLinks.module.css";

/** 푸터에서 약관을 여는 링크 묶음. 페이지 이동 없이 창으로 연다. */
export function LegalLinks() {
  const legal = useTermsDialog();
  return (
    <span className={styles.links}>
      <button type="button" onClick={() => legal.open("terms")}>
        이용약관
      </button>
      <button type="button" onClick={() => legal.open("privacy")}>
        개인정보 처리방침
      </button>
      <TermsDialog docId={legal.openDoc} onClose={legal.close} onSwitch={legal.open} />
    </span>
  );
}
