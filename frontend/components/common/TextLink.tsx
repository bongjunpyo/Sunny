import Link from "next/link";
import styles from "./TextLink.module.css";

/** 시안의 밑줄 링크. 오른쪽 기호는 장식이라 읽어주지 않는다. */
export function TextLink({
  href,
  mark = "↗",
  children,
}: {
  href: string;
  mark?: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={styles.link} href={href}>
      {children}
      <span aria-hidden="true">{mark}</span>
    </Link>
  );
}
