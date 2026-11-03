import { Header } from "../components/common/Header";
import { Footer } from "../components/common/Footer";
import { Home } from "../components/site/Home";
export const metadata = { title: "SUNNY — 함께한 하루를, 빛의 색으로" };
export default function Page() { return <><Header /><main id="main"><Home /></main><Footer /></>; }
