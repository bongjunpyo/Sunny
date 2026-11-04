import { Header } from '../../components/common/Header';
import { Footer } from '../../components/common/Footer';
import { SignupForm } from '../../components/auth/SignupForm';
import { c } from '../../components/site/ui';
import { imagePath } from '../../components/site/data';
export const metadata = { title: 'SUNNY — 회원가입' };
export default function Page() { return <><Header /><main id="main" className={c('login-page')}><div className={c('login-photo')}><img src={imagePath('shadows.jpg')} alt="나란히 걷는 그림자 · AI 콘셉트"/><div className={c('login-photo-copy')}><p className={c('eyebrow')}>WELCOME TO YOUR SUNNY</p><h2>당신의 하루도,<br />이곳에 남겨주세요.</h2></div></div><div className={c('login-form')}><p className={c('eyebrow')}>A MOMENT TO KEEP</p><h1>당신의 하루를 들려주세요.</h1><p className={c('small-copy')}>가입 후 이메일 인증을 완료해야 로그인할 수 있습니다.</p><SignupForm /></div></main><Footer /></>; }
