"use client";

import type { PhotochromicColor } from "../../lib/types.ts";

/** 발색 비교 — 조수희 작업 자리 (이슈 #56).
 *
 *  햇빛을 비추면 색이 서서히 드러나고, 다시 누르면 그늘 상태로 되돌아온다.
 *  지금은 아무 움직임이 없다. 버튼과 상태 표시만 있다.
 *
 *  약속 (바꾸지 않는다):
 *  - 입력은 `colors` 하나다 — 이 제품의 반응색 목록
 *  - 바깥 요소의 `data-lit` 를 `"on"` / `"off"` 로 둔다 (테스트가 본다)
 *  - 버튼에는 `aria-pressed` 를 둔다
 *  - 색은 `lib/colors.ts` 의 `COLOR_HEX` 를 쓴다. 직접 정하지 않는다
 *  - 화면에 "연출입니다. 실제 발색 속도·색과 다릅니다."를 적는다
 *  - 모션 감소 설정이면 애니메이션 없이 즉시 바뀐다 */
export function SunlightToggle({ colors }: { colors: PhotochromicColor[] }) {
  return (
    <div data-lit="off" data-colors={colors.join(",")}>
      <button type="button" aria-pressed="false" disabled>
        햇빛 비추기 (연출 준비 중)
      </button>
    </div>
  );
}
