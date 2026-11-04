import { authNotice } from "../../lib/auth-flow.ts";
import { kakaoOptions } from "../../lib/server/auth-kakao.ts";
import { Header } from '../../components/common/Header';
import { Footer } from '../../components/common/Footer';
import { LoginForm } from '../../components/auth/LoginForm';
import { c } from '../../components/site/ui';
import { imagePath } from '../../components/site/data';
export const metadata = { title: 'SUNNY — 로그인' };
export default async function Page({searchParams}:{searchParams:Promise<{auth?:string|string[]}>}) { const query=await searchParams;const status=typeof query.auth==="string"?query.auth:undefined; return <><Header /><main id="main" className={c('login-page')}><div className={c('login-photo')}><img src={imagePath('shadows.jpg')} alt="나란히 걷는 그림자 · AI 콘셉트"/><div className={c('login-photo-copy')}><p className={c('eyebrow')}>WELCOME TO YOUR SUNNY</p><h2>당신의 하루도,<br />이곳에 남겨주세요.</h2></div></div><div className={c('login-form')}><p className={c('eyebrow')}>A MOMENT TO KEEP</p><h1>다시 만나 반가워요.</h1><p className={c('small-copy')}>가입한 이메일과 비밀번호로 로그인해 주세요.</p><LoginForm initialNotice={authNotice(status)} authStatus={status} kakaoReady={Boolean(kakaoOptions())} /></div></main><Footer /></>; }
