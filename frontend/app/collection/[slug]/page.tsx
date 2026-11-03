import { notFound } from 'next/navigation';
import { getProduct, getProducts } from '../../../lib/api';
import { Header } from '../../../components/common/Header';
import { Footer } from '../../../components/common/Footer';
import { ProductDetail } from '../../../components/site/ProductViews';
export async function generateStaticParams() { return (await getProducts()).map(p => ({ slug: p.slug })); }
export async function generateMetadata({ params }: {
    params: Promise<{
        slug: string;
    }>;
}) { const p = await getProduct((await params).slug); return { title: 'SUNNY — ' + (p?.name || '제품을 찾을 수 없어요') }; }
export default async function Page({ params }: {
    params: Promise<{
        slug: string;
    }>;
}) { const p = await getProduct((await params).slug); if (!p)
    notFound(); return <><Header /><main id="main"><ProductDetail kind={p.kind}/></main><Footer /></>; }
