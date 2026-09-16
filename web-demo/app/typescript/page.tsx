import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DemoShell } from "@/components/DemoShell";
import BeadBuilder from "@/components/typescript/BeadBuilder";

const read = (file: string) => {
  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), file);
  return existsSync(full) ? readFileSync(full, "utf8") : `(${file} 없음 — npx tsc -p typescript-errors 실행 필요)`;
};

export default function TypeScriptPage() {
  const wrongCode = read("typescript-errors/wrong-bead.ts");
  const tscOutput = read("typescript-errors/tsc-output.txt");

  return (
    <DemoShell
      no="01"
      tech="TypeScript"
      title="데이터에 모양을 정해 두기"
      lede="JavaScript에 '이 값은 이런 모양이어야 한다'는 규칙(타입)을 붙인 언어입니다. 브라우저에서는 똑같이 JavaScript로 바뀌어 돌아가지만, 실수는 실행하기 전에 편집기와 터미널이 먼저 알려줍니다."
      files={["lib/bead.ts", "components/typescript/BeadBuilder.tsx", "typescript-errors/wrong-bead.ts"]}
      points={[
        <>
          <code>lib/bead.ts</code>의 <code>type PhotochromicColor = &quot;violet&quot; | &quot;coral&quot; | &quot;sky&quot;</code> — 이 세 단어
          말고는 색 자리에 넣을 수 없습니다.
        </>,
        <>
          <code>interface Bead</code> — 비즈 하나가 가져야 할 항목 목록. <code>photo?</code>처럼 <code>?</code>가 붙으면 없어도 됩니다.
        </>,
        <>
          <code>Record&lt;PhotochromicColor, string&gt;</code> — 색을 새로 추가하면, 색상표에 빠진 곳을 TypeScript가 전부 찾아서
          알려줍니다.
        </>,
        <>
          아래 오류 메시지는 제가 설명용으로 쓴 글이 아니라, <code>npx tsc -p typescript-errors</code>를 실제로 실행한 출력입니다.
        </>,
      ]}
    >
      <BeadBuilder />

      <h2 className="serif" style={{ fontSize: 30, margin: "8vh 0 14px" }}>
        잘못 쓰면 이렇게 됩니다
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        <div>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 8 }}>일부러 틀린 코드 · wrong-bead.ts</p>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            <code>{wrongCode}</code>
          </pre>
        </div>
        <div>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 8 }}>TypeScript 검사기(tsc) 실제 출력</p>
          <pre style={{ background: "#2a0f0a", color: "#ffd9c7", whiteSpace: "pre-wrap" }}>
            <code>{tscOutput}</code>
          </pre>
        </div>
      </div>
      <p style={{ marginTop: 16, color: "var(--muted)", maxWidth: 760 }}>
        같은 코드를 JavaScript로 썼다면 오류 없이 실행되고, 화면에서 비즈 색이 이상하게 나오거나 검은색이 된 뒤에야 알게 됩니다.
      </p>
    </DemoShell>
  );
}
