/** 스크롤에 따라 문구가 나타나는 부품 — 조수희 작업 자리.
 *
 *  지금은 연출 없이 글자만 보여준다. 이슈에서 GSAP SplitText 와 ScrollTrigger 로 채운다.
 *
 *  약속 (이 부분은 바꾸지 않는다):
 *  - 입력은 `text` 와 `as` 두 개다
 *  - 연출을 넣어도 화면에 글자는 그대로 읽혀야 한다 (검색·스크린리더·모션 감소 설정)
 */
export function RevealText({
  text,
  as: Tag = "p",
}: {
  text: string;
  as?: "h2" | "p";
}) {
  return <Tag data-reveal="pending">{text}</Tag>;
}
