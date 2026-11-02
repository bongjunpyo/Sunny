import { Header } from '../../components/common/Header';
import { Footer } from '../../components/common/Footer';
import { Custom } from '../../components/site/Custom';
import { getProduct } from '../../lib/api';
export const metadata = { title: 'SUNNY — 나만의 비즈' };
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        product?: string;
    }>;
}) { const slug = (await searchParams).product, p = slug ? await getProduct(slug) : null; return <><Header /><main id="main"><Custom key={p?.kind || 'bracelet'} initialKind={p?.kind || 'bracelet'}/></main><Footer /></>; }
