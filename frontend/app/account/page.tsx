import { Header } from "../../components/common/Header";
import { Footer } from "../../components/common/Footer";
import { Account } from "../../components/site/Account";
export const metadata = { title: "SUNNY — 내 기록" };
export default function Page() { return <><Header /><main id="main"><Account /></main><Footer /></>; }
