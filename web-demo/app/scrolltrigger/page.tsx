import { DemoShell } from "@/components/DemoShell";
import ScrollSun from "@/components/scrolltrigger/ScrollSun";

export default function ScrollTriggerPage() {
  return (
    <DemoShell
      no="02"
      tech="GSAP ScrollTrigger"
      title="스크롤이 곧 시간이 되는 화면"
      lede="보통 애니메이션은 시간이 흐르면 재생됩니다. ScrollTrigger를 쓰면 '스크롤을 얼마나 내렸는지'가 재생 위치가 됩니다. 잡지를 넘기는 속도대로 장면이 움직입니다."
      bleed
      files={["components/scrolltrigger/ScrollSun.tsx", "components/scrolltrigger/ScrollSun.module.css"]}
      points={[
        <>
          <code>gsap.timeline(&#123; scrollTrigger: &#123;...&#125; &#125;)</code> — 여러 움직임을 하나의 타임라인에 순서대로 쌓고, 그 진행도를
          스크롤에 묶습니다.
        </>,
        <>
          <code>pin: true</code> — 장면이 진행되는 동안 무대를 화면에 고정합니다. <code>end: &quot;+=300%&quot;</code>는 화면 높이의 3배를
          스크롤하는 동안이라는 뜻입니다.
        </>,
        <>
          <code>scrub: 1</code> — 스크롤을 1초 늦게 부드럽게 따라가는 보간. <code>true</code>로 바꾸면 스크롤에 딱 붙어 움직입니다.
        </>,
        <>
          비즈 색은 <code>lib/bead.ts</code>의 <code>activatedColor()</code>로 계산 — 01 TypeScript 예제와 같은 함수를 씁니다.
        </>,
        <>
          <code>gsap.matchMedia()</code> — 기기에서 &apos;움직임 줄이기&apos;를 켠 사람에게는 애니메이션 없이 최종 장면만 보여줍니다.
        </>,
      ]}
    >
      <ScrollSun />
    </DemoShell>
  );
}
