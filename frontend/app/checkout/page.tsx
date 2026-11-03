import { Header } from "../../components/common/Header";
import { Footer } from "../../components/common/Footer";
import { Checkout } from "../../components/site/Commerce";
export const metadata = { title: "SUNNY — 주문서" };
export default function Page() { return <><Header /><main id="main"><Checkout /></main><Footer /></>; }
