import { notFound, redirect } from 'next/navigation';
import { Header } from '../../../components/common/Header';
import { Footer } from '../../../components/common/Footer';
import { Article } from '../../../components/site/Editorial';
import { articles } from '../../../components/site/data';
export function generateStaticParams() { return articles.map(a => ({ slug: a.slug })); }
export async function generateMetadata({ params }: {
    params: Promise<{
        slug: string;
    }>;
}) { const slug = (await params).slug; return { title: 'SUNNY — ' + (articles.find(a => a.slug === slug)?.title || '빛의 기록') }; }
export default async function Page({ params }: {
    params: Promise<{
        slug: string;
    }>;
}) { let slug = (await params).slug; if (slug === 'sea-yunseul')
    redirect('/archive/sea'); if (slug === 'sea-wears-light')
    slug = 'sea'; if (!articles.some(a => a.slug === slug))
    notFound(); return <><Header /><main id="main"><Article slug={slug}/></main><Footer /></>; }
