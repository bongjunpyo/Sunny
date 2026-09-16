import Link from "next/link";

const ITEMS = [
  {
    no: "01",
    href: "/typescript",
    tech: "TypeScript",
    what: "데이터에 '모양'을 정해 두고, 잘못된 값을 실행 전에 잡아냅니다.",
    demo: "비즈 색·농도 타입 + 실제 오류 메시지",
  },
  {
    no: "02",
    href: "/scrolltrigger",
    tech: "GSAP ScrollTrigger",
    what: "스크롤 위치를 애니메이션 진행도로 바꿉니다.",
    demo: "실내 → 정오, 태양이 뜨고 흰 비즈가 발색",
  },
  {
    no: "03",
    href: "/splittext",
    tech: "GSAP SplitText",
    what: "문장을 글자·단어·줄로 쪼개 하나씩 움직입니다.",
    demo: "잡지 표지 제목과 본문 연출",
  },
  {
    no: "04",
    href: "/three",
    tech: "Three.js",
    what: "브라우저에서 3D 장면을 직접 그립니다.",
    demo: "셰이더 태양 + 광변색 팔찌 (순수 Three.js)",
  },
  {
    no: "05",
    href: "/r3f",
    tech: "React Three Fiber",
    what: "Three.js 장면을 React 컴포넌트로 조립합니다.",
    demo: "04와 같은 장면을 React 방식으로",
  },
];

export default function Home() {
  return (
    <main className="cover">
      <div className="cover-meta">
        <span>Issue 00 · 기술 견본</span>
        <span>창업캡스톤디자인2</span>
      </div>
      <h1 className="cover-title">
        빛이 남기는 <em>색</em>
      </h1>
      <p className="cover-dek">
        웹사이트에 쓸 기술 다섯 가지를 처음 쓰는 사람을 위한 견본. 각 페이지는 결과 화면 → 코드에서 볼 곳 → 전체 코드 순서로
        읽습니다.
      </p>

      <ol className="toc">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <span className="toc-no">{item.no}</span>
              <span className="toc-tech">{item.tech}</span>
              <span className="toc-what">
                <strong>{item.what}</strong>
                {item.demo}
              </span>
              <span className="toc-arrow">→</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
