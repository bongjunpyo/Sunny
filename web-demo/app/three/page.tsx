import { DemoShell } from "@/components/DemoShell";
import ThreeLoader from "@/components/three/ThreeLoader";

export default function ThreePage() {
  return (
    <DemoShell
      no="04"
      tech="Three.js"
      title="브라우저 안에 3D 장면 짓기"
      lede="Three.js는 GPU로 3D를 그리는 WebGL을 쓰기 쉽게 감싼 라이브러리입니다. 장면·카메라·조명·물체를 만들고, 매 프레임 다시 그리는 반복문을 직접 돌립니다. 마우스로 끌어서 돌려보세요."
      files={["components/three/ThreeScene.tsx", "lib/sunShader.ts", "lib/bracelet.ts"]}
      points={[
        <>
          뼈대는 항상 같습니다: <code>WebGLRenderer</code>(캔버스) → <code>Scene</code>(무대) → <code>PerspectiveCamera</code>(시점) →
          <code>Mesh</code> = 형태(Geometry) + 재질(Material).
        </>,
        <>
          태양은 이미지가 아니라 <code>ShaderMaterial</code> — GPU에서 픽셀마다 계산하는 작은 프로그램(GLSL)으로 끓는 표면과 가장자리 빛
          번짐을 그립니다.
        </>,
        <>
          비즈는 <code>RoundedBoxGeometry</code>로 모서리를 굴린 납작한 사각형, 재질은 레진 광택을 흉내 낸
          <code>MeshPhysicalMaterial(clearcoat)</code>입니다.
        </>,
        <>
          <code>requestAnimationFrame(tick)</code> — 1초에 약 60번 도는 반복문. 자외선값을 <code>dampUv()</code>로 보간하는데, 발색은 빠르고
          흰색으로 돌아가는 건 느리게 해 실제 광변색처럼 보이게 했습니다.
        </>,
        <>
          마지막 <code>return () =&gt; &#123; ... dispose() &#125;</code> — 순수 Three.js에서는 페이지를 떠날 때 GPU 메모리를 직접 비워야
          합니다. 05 R3F에서는 이 부분이 사라집니다.
        </>,
      ]}
    >
      <ThreeLoader />
    </DemoShell>
  );
}
