import { Header } from "../../../components/common/Header.tsx";
import { Footer } from "../../../components/common/Footer.tsx";
import { OrderHistory } from "../../../components/orders/OrderHistory.tsx";
import styles from "../../../components/orders/orders.module.css";
export const metadata={title:"SUNNY — 주문 요청 상세"};
export const dynamic="force-dynamic";
export default async function Order({params}:{params:Promise<{orderId:string}>}){
  return <><Header dark={false}/><main id="main" className={styles.page}><OrderHistory orderId={(await params).orderId}/></main><Footer/></>;
}
