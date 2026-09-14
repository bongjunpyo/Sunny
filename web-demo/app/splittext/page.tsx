import { DemoShell } from "@/components/DemoShell";
import MagazineTitle from "@/components/splittext/MagazineTitle";

export default function SplitTextPage() {
  return (
    <DemoShell
      no="03"
      tech="GSAP SplitText"
      title="글자를 쪼개서 움직이기"
      lede="문장은 원래 한 덩어리라서 통째로만 움직일 수 있습니다. SplitText는 문장을 글자·단어·줄 단위의 작은 조각으로 나눠 주고, 조각마다 시간차를 두어 잡지 표지 같은 타이포 연출을 만듭니다."
      bleed
      files={["components/splittext/MagazineTitle.tsx", "components/splittext/MagazineTitle.module.css"]}
      points={[
        <>
          <code>SplitText.create(요소, &#123; type: &quot;chars&quot; &#125;)</code> — 쪼갤 단위를 고릅니다. 화면의 주황 태그가 각 요소에 쓴
          type입니다.
        </>,
        <>
          <code>mask: &quot;chars&quot;</code> / <code>&quot;lines&quot;</code> — 조각마다 잘라내는 틀을 씌워, 글자가 틀 아래에서 솟아오르는
          효과를 냅니다.
        </>,
        <>
          <code>stagger: 0.07</code> — 조각마다 0.07초씩 늦게 출발시키는 값. 이 숫자 하나로 리듬이 바뀝니다.
        </>,
        <>
          <code>autoSplit: true</code> + <code>onSplit</code> — 한글 폰트가 늦게 로드되거나 화면 폭이 바뀌면 줄바꿈이 달라지므로 다시 쪼개고
          애니메이션도 다시 만듭니다.
        </>,
        <>
          인용구는 02에서 본 ScrollTrigger의 <code>scrub</code>을 함께 써서, 스크롤할수록 글자가 흰색에서 주황으로 &apos;발색&apos;합니다.
        </>,
      ]}
    >
      <MagazineTitle />
    </DemoShell>
  );
}
