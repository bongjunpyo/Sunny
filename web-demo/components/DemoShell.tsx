import Link from "next/link";
import type { ReactNode } from "react";
import { SourceViewer } from "./SourceViewer";

interface DemoShellProps {
  no: string;
  tech: string;
  title: string;
  lede: string;
  points: ReactNode[];
  files: string[];
  bleed?: boolean; // 데모를 화면 끝까지 꽉 채울지
  children: ReactNode;
}

export function DemoShell({ no, tech, title, lede, points, files, bleed, children }: DemoShellProps) {
  return (
    <main>
      <header className="demo-head">
        <Link href="/" className="back">
          ← 목차
        </Link>
        <p className="kicker">
          Example {no} · {tech}
        </p>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
      </header>

      <div className={bleed ? "demo-body demo-body--bleed" : "demo-body"}>{children}</div>

      <section className="points">
        <h2>코드에서 볼 곳</h2>
        <ol>
          {points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </section>

      <SourceViewer files={files} />
    </main>
  );
}
