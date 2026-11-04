import { Header } from "../../components/common/Header";
import { Footer } from "../../components/common/Footer";
import { About } from "../../components/site/Editorial";
export const metadata = { title: "SUNNY — 우리의 이야기" };
export default function Page() { return <><Header /><main id="main"><About /></main><Footer /></>; }
