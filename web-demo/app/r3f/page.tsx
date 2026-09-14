import { readFileSync } from "node:fs";
import path from "node:path";
import { DemoShell } from "@/components/DemoShell";
import R3FLoader from "@/components/r3f/R3FLoader";

// 정적 페이지라 빌드할 때만 읽음 → 배포 추적에서 제외
const lineCount = (file: string) =>
  readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), file), "utf8").split("\n").length;

export default function R3FPage() {
  const threeLines = lineCount("components/three/ThreeScene.tsx");
  const r3fLines = lineCount("components/r3f/R3FScene.tsx");

  return (
    <DemoShell
      no="05"
      tech="React Three Fiber"
      title="같은 장면을 React 방식으로"
      lede="04와 똑같은 태양과 팔찌입니다. 다른 점은 만드는 방법뿐입니다. Three.js 객체를 명령문으로 하나씩 만드는 대신, HTML 태그를 쓰듯 <mesh>, <sphereGeometry> 같은 컴포넌트로 조립합니다."
      files={["components/r3f/R3FScene.tsx", "components/three/ThreeScene.tsx"]}
      points={[
        <>
          <code>&lt;Canvas&gt;</code> 하나가 렌더러·장면·카메라·반복문·창 크기 대응·메모리 정리를 모두 대신합니다. 04의 1)·2)·5)·6)번이 사라진
          이유입니다. 아래 표처럼 줄 수는 비슷하지만, 사라진 준비 코드 자리를 태그 줄바꿈과 컴포넌트 나누기가 채운 것입니다.
        </>,
        <>
          <code>new THREE.SphereGeometry(1.5)</code> → <code>&lt;sphereGeometry args=&#123;[1.5]&#125; /&gt;</code>. Three.js 클래스 이름의 첫
          글자를 소문자로 쓰면 태그가 됩니다.
        </>,
        <>
          <code>useFrame(() =&gt; ...)</code> — 매 프레임 실행되는 훅. 04의 <code>tick()</code> 역할을 컴포넌트마다 나눠 가집니다.
        </>,
        <>
          <code>@react-three/drei</code>의 <code>&lt;RoundedBox&gt;</code>, <code>&lt;OrbitControls&gt;</code> — 자주 쓰는 것들을 미리 만들어 둔
          부품 모음입니다.
        </>,
        <>
          태양 셰이더(<code>lib/sunShader.ts</code>)와 비즈 색 계산(<code>lib/bead.ts</code>)은 04와 같은 파일을 그대로 가져다 씁니다.
        </>,
      ]}
    >
      <R3FLoader />

      <table className="compare">
        <thead>
          <tr>
            <th></th>
            <th>04 순수 Three.js</th>
            <th>05 React Three Fiber</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>파일 길이</td>
            <td>{threeLines}줄</td>
            <td>{r3fLines}줄</td>
          </tr>
          <tr>
            <td>물체 만들기</td>
            <td>
              <code>new THREE.Mesh(geo, mat)</code> 후 <code>scene.add()</code>
            </td>
            <td>
              <code>&lt;mesh&gt;</code> 태그 안에 형태·재질 태그
            </td>
          </tr>
          <tr>
            <td>매 프레임 갱신</td>
            <td>
              직접 만든 <code>tick()</code> 반복문 하나
            </td>
            <td>
              컴포넌트마다 <code>useFrame</code>
            </td>
          </tr>
          <tr>
            <td>정리(메모리)</td>
            <td>
              <code>dispose()</code> 직접 호출
            </td>
            <td>자동</td>
          </tr>
          <tr>
            <td>어울리는 경우</td>
            <td>React 없는 사이트, 세밀한 제어</td>
            <td>Next.js 사이트 안에 3D를 부품처럼 넣을 때 (우리 프로젝트)</td>
          </tr>
        </tbody>
      </table>
    </DemoShell>
  );
}
