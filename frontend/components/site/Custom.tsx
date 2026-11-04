'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductKind } from '../../lib/types';
import { productInfo, colorName, kinds } from './data';
import { useSite } from './Provider';
import { Art, Intro, c } from './ui';
import { ColorPicker, LightPicker } from './ProductViews';
export function Custom({ initialKind = 'bracelet' }: {
    initialKind?: ProductKind;
}) { const [kind, setKind] = useState(initialKind), [color, setColor] = useState('violet'), [length, setLength] = useState(productInfo[initialKind].lengths[1]), [light, setLight] = useState('sunlight'), [photos, setPhotos] = useState<({
    url: string;
} | null)[]>(Array(7).fill(null)), [slot, setSlot] = useState(0), [error, setError] = useState(''); const urls = useRef(new Set<string>()), { add } = useSite(), router = useRouter(); useEffect(() => { const active = urls.current; return () => active.forEach(u => URL.revokeObjectURL(u)); }, []); function changeKind(k: ProductKind) { if(k === 'necklace' && color === 'mixed') setColor('violet'); setKind(k); setLength(productInfo[k].lengths[1]); setSlot(0); } async function pick(e: ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; e.target.value = ''; if (!f)
    return; setError(''); if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 8 * 1024 * 1024) {
    setError('JPG·PNG·WebP 이미지, 8MB 이하로 선택해주세요.');
    return;
} const url = URL.createObjectURL(f); try {
    const img = new Image();
    img.src = url;
    await img.decode();
    urls.current.add(url);
    setPhotos(old => old.map((p, i) => { if (i !== slot)
        return p; if (p) {
        URL.revokeObjectURL(p.url);
        urls.current.delete(p.url);
    } return { url }; }));
}
catch {
    URL.revokeObjectURL(url);
    setError('이미지를 열 수 없어요. 다른 파일을 선택해주세요.');
} } function toCart() { if (kind === 'bracelet' && photos.some(Boolean)) {
    setError('사진은 현재 화면의 미리보기로만 사용됩니다. 사진을 지운 뒤 색·길이 구성만 장바구니에 담을 수 있습니다.');
    return;
} add({ kind, color, length }); router.push('/cart'); } return <><Intro title="나만의 비즈." eyebrow="YOUR MOMENT, YOUR SUNNY">좋아하는 색과 나에게 맞는 길이.<br />{kind === 'bracelet' ? '작은 네모에 당신의 하루를 담아보세요.' : '달 하나와 원 둘에 어울리는 색을 골라보세요.'}</Intro><section className={c('custom-page')}><div className={c('custom-layout')}><div className={c('custom-preview')}><Art kind={kind} color={color} light={light} photos={kind === 'bracelet' ? photos : []}/><div className={c('preview-bar')}><span className={c('micro')}>YOUR PIECE / LIVE PREVIEW</span><LightPicker value={light} onChange={setLight}/></div><p className={c('custom-help')}>선택한 색{kind === 'bracelet' ? '과 사진' : ''}이 구성 그림에 반영됩니다.<br />실물 치수와 발색 시험을 재현한 화면은 아닙니다.</p></div><div className={c('custom-options')}><section className={c('option-section')}><h2><small>01 / FORM</small>빛을 지닐 자리</h2><div className={c('choice-row')}>{kinds.map(k => <button key={k} className={c('choice')} aria-pressed={kind === k} onClick={() => changeKind(k)}>{productInfo[k].kind}</button>)}</div></section><section className={c('option-section')}><h2><small>02 / COLOR</small>나를 닮은 색</h2><p className={c('option-label')}>햇빛 아래 반응색 · {colorName(color)}</p><ColorPicker value={color} onChange={setColor} allowMixed={kind === 'bracelet'}/></section><section className={c('option-section')}><h2><small>03 / LENGTH</small>편안한 길이</h2><div className={c('choice-row')}>{productInfo[kind].lengths.map(l => <button key={l} className={c('choice')} aria-pressed={l === length} onClick={() => setLength(l)}>{l}</button>)}</div><p className={c('small-copy')}>길이는 디자인 검토용 예시입니다.</p></section>{kind === 'bracelet' && <section className={c('option-section')}><h2><small>04 / MEMORY</small>간직하고 싶은 장면</h2><div className={c('photo-slots')}>{photos.map((p, i) => <button key={i} className={c('photo-slot')} aria-label={`${i + 1}번 비즈`} aria-pressed={slot === i} onClick={() => setSlot(i)}>{p ? <img src={p.url} alt="선택한 사진"/> : <span>+</span>}<span className={c('slot-index')}>{i + 1}</span></button>)}</div><div className={c('photo-controls')}><label className={c('upload-label')} htmlFor="memory-photo">선택한 칸에 사진 담기</label><input className={c('sr-only')} id="memory-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick}/><button className={c('text-button')} onClick={() => setPhotos(old => old.map((p, i) => { if (i !== slot)
    return p; if (p) {
    URL.revokeObjectURL(p.url);
    urls.current.delete(p.url);
} return null; }))}>선택한 사진 지우기</button></div><p className={c('small-copy')}>{slot + 1}번 비즈를 선택했어요. 사진은 전송·저장되지 않습니다.</p></section>}<aside className={c('custom-summary')}><div className={c('summary-head')}>당신의 작은 기록 <span>YOUR SUNNY</span></div>{[['형태', productInfo[kind].kind], ['반응색', colorName(color)], ['길이', length], ['구성', kind === 'bracelet' ? '네모 · 원형 교대' : '달 1개 · 원형 2개']].map(([k, v]) => <div className={c('summary-row')} key={k}><span>{k}</span><span>{v}</span></div>)}<p role="alert" className={c('small-copy')}>{error}</p><button className={c('button full')} onClick={toCart}>이 구성 장바구니에 담기 ↗</button><p className={c('small-copy')}>제품은 제작 검토 중이며 실제 주문은 연결 전입니다.</p></aside></div></div></section></>; }
