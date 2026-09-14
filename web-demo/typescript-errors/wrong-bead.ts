// 일부러 틀리게 쓴 코드. `npx tsc -p typescript-errors` 로 검사하면 아래 네 곳에서 오류가 난다.
import { activatedColor, type Bead } from "@/lib/bead";

// ① 색 이름 오타: "lavendar"는 PhotochromicColor에 없다
export const typo: Bead = { id: "a", color: "lavendar", concentration: 6 };

// ② 정해진 농도(3·6·9)가 아닌 값
export const wrongConcentration: Bead = { id: "b", color: "coral", concentration: 5 };

// ③ 꼭 필요한 id가 빠짐
export const missingId: Bead = { color: "sky", concentration: 9 };

// ④ 자외선지수 자리에 숫자 대신 문자열
export const wrongUv = activatedColor({ id: "c", color: "violet", concentration: 3 }, "8");
