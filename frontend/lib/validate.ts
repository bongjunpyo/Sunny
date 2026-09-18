/** 입력 검사 — 화면과 서버가 같은 규칙을 쓰도록 순수 함수로 둔다.
 *  서버가 붙으면 서버에서도 같은 값을 검사한다. 화면 검사는 편의일 뿐 방어가 아니다. */

export const PASSWORD_MIN = 8;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

/** 흔한 형태만 통과시킨다. 최종 판단은 서버(인증 제공자)가 한다. */
export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "이메일을 입력하세요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "이메일 형태가 아닙니다.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "비밀번호를 입력하세요.";
  if (value.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`;
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return "영문과 숫자를 함께 넣어주세요.";
  return null;
}

export function validateNickname(value: string): string | null {
  const nickname = value.trim();
  if (!nickname) return "별명을 입력하세요.";
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX)
    return `별명은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 적어주세요.`;
  if (!/^[가-힣a-zA-Z0-9._-]+$/.test(nickname)) return "한글 · 영문 · 숫자와 . _ - 만 쓸 수 있습니다.";
  return null;
}

export function validateRequiredTerms(agreed: boolean): string | null {
  return agreed ? null : "필수 약관에 동의해야 가입할 수 있습니다.";
}
