import { readFileSync } from "node:fs";
import path from "node:path";

// 서버 컴포넌트: 실제 소스 파일을 읽어 그대로 보여준다 (설명과 코드가 어긋나지 않게)
export function SourceViewer({ files }: { files: string[] }) {
  return (
    <section className="source">
      <h2>전체 코드</h2>
      {files.map((file) => {
        const code = readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), file), "utf8");
        return (
          <details key={file}>
            <summary>
              {file}
              <span>{code.split("\n").length}줄</span>
            </summary>
            <pre>
              <code>{code}</code>
            </pre>
          </details>
        );
      })}
    </section>
  );
}
