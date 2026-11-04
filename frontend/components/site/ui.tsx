import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ProductKind } from '../../lib/types.ts';
import { ProductGraphic } from './ProductGraphic';
import { productInfo, productHref, imagePath, articles } from './data';
import s from './site.module.css';
export const c = (names: string) => names.split(' ').map(n => s[n] || '').join(' ');
export function Eyebrow({ children }: {
    children: ReactNode;
}) { return <p className={c('eyebrow')}>{children}</p>; }
export function TextLink({ href, children }: {
    href: string;
    children: ReactNode;
}) { return <Link className={c('text-link')} href={href}>{children}<span aria-hidden="true">↗</span></Link>; }
export function Intro({ title, children, eyebrow = 'SUNNY / LITTLE PIECES OF LIGHT' }: {
    title: ReactNode;
    children?: ReactNode;
    eyebrow?: string;
}) { return <section className={c('page-intro')}><Eyebrow>{eyebrow}</Eyebrow><div className={c('page-intro-row')}><h1 className={c('page-heading')}>{title}</h1><div className={c('body-copy')}>{children}</div></div></section>; }
export function Art({ kind, light = 'sunlight', color = 'mixed', photos = [] }: {
    kind: ProductKind;
    light?: string;
    color?: string;
    photos?: ({
        url: string;
    } | null)[];
}) { return <div className={c('product-visual ' + kind)}><ProductGraphic kind={kind} light={light} color={color} photos={photos}/><span className={c('visual-label')}>{productInfo[kind].tag}</span><span className={c('visual-state')}>{kind === 'bracelet' ? '네모 하나, 원 하나. 번갈아 이어지는 하루.' : '달 하나, 양옆의 작은 원 둘.'}</span></div>; }
export function ProductCard({ kind }: {
    kind: ProductKind;
}) { const p = productInfo[kind]; return <article className={c('product-card')}><Link href={productHref(kind)}><Art kind={kind}/><div className={c('product-card-copy')}><div className={c('product-meta')}><h3>{p.name}</h3><span className={c('micro')}>{p.tag}</span></div><p className={c('small-copy')}>{p.kind} · {p.en}</p><p className={c('product-desc')}>{p.desc}</p></div></Link></article>; }
export function JournalCard({ article }: {
    article: typeof articles[number];
}) { return <article className={c('journal-card')}><Link href={'/archive/' + article.slug}><div className={c('photo-frame')}><img src={imagePath(article.image)} alt={article.title + ' · AI 콘셉트'} loading="lazy"/></div><Eyebrow>{article.label}</Eyebrow><h3>{article.title}</h3><p className={c('small-copy')}>{article.desc}</p><div className={c('journal-link')}><span>빛을 관찰하는 기록</span><span>↗</span></div></Link></article>; }
export function Banner() { return <section className={c('custom-banner')}><div><Eyebrow>YOUR MOMENT, YOUR SUNNY</Eyebrow><h2>어떤 하루를 간직하고 싶나요?</h2><p className={c('small-copy')}>좋아하는 색과 소중한 장면으로 작은 자리를 채워보세요.</p></div><Link className={c('button light')} href="/custom">나만의 비즈 구성하기 ↗</Link></section>; }
