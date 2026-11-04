import { Header } from "../../components/common/Header";
import { Footer } from "../../components/common/Footer";
import { PasswordResetForm } from "../../components/auth/PasswordResetForm";
import { c } from "../../components/site/ui";

export const metadata = { title: "SUNNY — 비밀번호 재설정", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function Page() {
  return <><Header /><main id="main" className={c("login-page")}>
    <div className={c("login-form")}><p className={c("eyebrow")}>YOUR SUNNY</p><h1>비밀번호를 잊으셨나요?</h1>
      <p>이메일로 가입한 계정의 재설정 링크를 보내드립니다. 카카오로 가입했다면 카카오 로그인을 이용해 주세요.</p>
      <PasswordResetForm mode="request" />
    </div>
  </main><Footer /></>;
}
