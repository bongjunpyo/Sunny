import { Header } from "../../components/common/Header";
import { Footer } from "../../components/common/Footer";
import { PasswordResetForm } from "../../components/auth/PasswordResetForm";
import { c } from "../../components/site/ui";

export const metadata = { title: "SUNNY — 새 비밀번호", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function Page() {
  return <><Header /><main id="main" className={c("login-page")}>
    <div className={c("login-form")}><p className={c("eyebrow")}>YOUR SUNNY</p><h1>새 비밀번호를 정해 주세요.</h1>
      <p>링크는 1시간 동안 한 번만 사용할 수 있습니다.</p><PasswordResetForm mode="reset" />
    </div>
  </main><Footer /></>;
}
