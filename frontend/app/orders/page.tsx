import { Header } from "../../components/common/Header.tsx";
import { Footer } from "../../components/common/Footer.tsx";
import { OrderHistory } from "../../components/orders/OrderHistory.tsx";
import styles from "../../components/orders/orders.module.css";
export const metadata={title:"SUNNY — 내 주문 요청"};
export const dynamic="force-dynamic";
export default async function Orders({searchParams}:{searchParams:Promise<{submitted?:string|string[]}>}){
  const params=await searchParams;
  return <><Header dark={false}/><main id="main" className={styles.page}><OrderHistory submitted={typeof params.submitted==="string"?params.submitted:undefined}/></main><Footer/></>;
}
