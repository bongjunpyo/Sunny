"use client";
import { useId } from "react";
import type { ProductKind } from "../../lib/types.ts";
import { palette as colors, productInfo as products } from "./data";
type GraphicOptions = {
    light?: string;
    color?: string;
    photos?: ({
        url: string;
    } | null)[];
};
const escapeHtml = (v: string) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function beadSvg(prefix: string, kind: ProductKind, { light = 'sunlight', color = 'mixed', photos = [] }: GraphicOptions = {}) {
    if (kind === 'necklace') {
        const id = prefix + 'moon', tint = light === 'indoor' ? '#f1eee1' : (colors.find(c => c.id === color) || colors[0]).hex;
        return `<svg viewBox="0 0 600 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="달 비즈 하나와 양옆의 원형 비즈 한 개씩으로 구성한 목걸이"><defs><linearGradient id="${id}-moon" x2=".8" y2="1"><stop stop-color="#fffdf4"/><stop offset=".6" stop-color="${tint}"/><stop offset="1" stop-color="${tint}"/></linearGradient><radialGradient id="${id}-round" cx="30%" cy="25%"><stop stop-color="#fffef6"/><stop offset="1" stop-color="#d6d2bf"/></radialGradient><filter id="${id}-shadow"><feGaussianBlur stdDeviation="5"/></filter></defs><ellipse cx="300" cy="411" rx="65" ry="9" fill="#514a32" opacity=".10" filter="url(#${id}-shadow)"/><path d="M255 352 C191 316 163 111 235 67 C270 46 330 46 365 67 C437 111 409 316 345 352" fill="none" stroke="#b4ae98" stroke-width="2.5"/><path d="M255 352 Q300 371 345 352" fill="none" stroke="#b4ae98" stroke-width="2"/><circle data-bead="round" cx="255" cy="352" r="11" fill="url(#${id}-round)"/><circle data-bead="round" cx="345" cy="352" r="11" fill="url(#${id}-round)"/><path data-bead="moon" d="M319 326 C272 310 260 379 304 394 C320 399 334 390 340 378 C306 388 286 348 319 326Z" fill="url(#${id}-moon)" stroke="#fff9" stroke-width="1.2"/></svg>`;
    }
    const id = prefix + 'bead', neck = false, cx = 300, cy = neck ? 230 : 239, rx = neck ? 145 : 183, ry = neck ? 170 : 103;
    const squareAngles = Array.from({ length: 7 }, (_, i) => 90 + i * 360 / 7);
    const r = (deg: number) => deg * Math.PI / 180;
    const point = (deg: number) => [cx + rx * Math.cos(r(deg)), cy + ry * Math.sin(r(deg))];
    const selected = colors.find(c => c.id === color) || colors[0];
    let defs = `<filter id="${id}-shadow" x="-60%" y="-60%" width="220%" height="240%"><feGaussianBlur stdDeviation="3.5"/></filter><radialGradient id="${id}-round" cx="32%" cy="23%" r="78%"><stop stop-color="#fffdf2"/><stop offset=".57" stop-color="#eeebdd"/><stop offset="1" stop-color="#d5d2c2"/></radialGradient>`;
    const rounds = Array.from({ length: 7 }, (_, i) => { const angle = 90 + (i + .5) * 360 / 7; const [x, y] = point(angle); return `<g data-bead="round" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><ellipse cx="2" cy="7" rx="9.5" ry="6" fill="#4d4836" opacity=".12" filter="url(#${id}-shadow)"/><circle r="${neck ? 8 : 9}" fill="url(#${id}-round)"/><ellipse cx="-2.5" cy="-3.5" rx="3.5" ry="2.4" fill="#fff" opacity=".6"/></g>`; }).join('');
    const squares = squareAngles.map((angle, i) => {
        const [x, y] = point(angle), size = neck ? 39 : 43, half = size / 2;
        const tint = light === 'indoor' ? '#f1eee1' : color === 'mixed' ? colors[i % colors.length].hex : selected.hex;
        defs += `<linearGradient id="${id}-bead-${i}" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#fffdf4"/><stop offset=".44" stop-color="${tint}"/><stop offset="1" stop-color="${tint}"/></linearGradient><clipPath id="${id}-clip-${i}"><rect x="${-half + 4}" y="${-half + 3}" width="${size - 8}" height="${size - 8}" rx="2"/></clipPath>`;
        const rotate = angle - 90;
        return `<g data-bead="square" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotate.toFixed(2)})"><rect x="${-half + 1}" y="${-half + 9}" width="${size}" height="${size - 2}" rx="6" fill="#5a5139" opacity=".16" filter="url(#${id}-shadow)"/><rect x="${-half}" y="${-half + 4}" width="${size}" height="${size}" rx="6" fill="${light === 'indoor' ? '#d9d5c6' : tint}"/><rect x="${-half}" y="${-half}" width="${size}" height="${size}" rx="5" fill="url(#${id}-bead-${i})" stroke="#fffc" stroke-width=".8"/><path d="M${-half + 6} ${-half + 3}H${half - 6}" stroke="#fff" stroke-width="1.2" opacity=".8"/>${photos[i] ? `<image href="${escapeHtml(photos[i].url)}" x="${-half + 4}" y="${-half + 3}" width="${size - 8}" height="${size - 8}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-clip-${i})" opacity=".85"/>` : ''}<ellipse cx="${half - 1}" cy="3" rx="1.8" ry="3" fill="#807864" opacity=".24"/></g>`;
    }).join('');
    const path = `M ${point(0).join(' ')} A ${rx} ${ry} 0 1 1 ${point(359.9).join(' ')}`;
    return `<svg viewBox="0 0 600 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="네모 비즈 7개와 둥근 보조 비즈로 구성한 ${products[kind].kind} ${light === 'sunlight' ? '햇빛' : '실내'} 구성 그래픽"><defs>${defs}</defs><ellipse cx="300" cy="${neck ? 430 : 365}" rx="${neck ? 155 : 178}" ry="18" fill="#65624b" opacity=".07" filter="url(#${id}-shadow)"/><path d="${path}" fill="none" stroke="#c7c6b6" stroke-width="1.8" opacity=".7"/>${rounds}${squares}</svg>`;
}
export function ProductGraphic({ kind, ...options }: GraphicOptions & {
    kind: ProductKind;
}) { const prefix = useId().replace(/:/g, ''); return <div dangerouslySetInnerHTML={{ __html: beadSvg(prefix, kind, options) }}/>; }
