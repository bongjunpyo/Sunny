"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 로고 — 어느 페이지에서든 메인으로 간다.
 *  이미 메인에 있으면 페이지 이동이 없으므로 직접 맨 위로 올린다. */
export function LogoLink({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <Link
      className={className}
      href="/"
      aria-label="SUNNY 메인으로"
      onClick={(event) => {
        if (pathname !== "/") return;
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      SUNNY
    </Link>
  );
}
