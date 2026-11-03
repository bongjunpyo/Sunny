'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ProductKind } from '../../lib/types.ts';
import s from './site.module.css';
export type CartItem = {
    kind: ProductKind;
    color: string;
    length: string;
    quantity: number;
};
type Store = {
    favorites: ProductKind[];
    toggleFavorite: (k: ProductKind) => void;
    cart: CartItem[];
    add: (item: Omit<CartItem, 'quantity'>) => void;
    quantity: (index: number, n: number) => void;
    remove: (index: number) => void;
    ready: boolean;
};
const Context = createContext<Store | null>(null);
export function SiteProvider({ children }: {
    children: ReactNode;
}) {
    const [favorites, setFavorites] = useState<ProductKind[]>([]), [cart, setCart] = useState<CartItem[]>([]), [ready, setReady] = useState(false);
    useEffect(() => { try {
        const raw = JSON.parse(sessionStorage.getItem('sunny.design.cart') || '[]');
        if (Array.isArray(raw))
            setCart(raw.filter((v: CartItem) => ['bracelet', 'necklace'].includes(v?.kind) && typeof v.color === 'string' && typeof v.length === 'string' && Number.isInteger(v.quantity) && v.quantity > 0 && v.quantity <= 10));
    }
    catch { } setReady(true); }, []);
    useEffect(() => { if (ready)
        try {
            sessionStorage.setItem('sunny.design.cart', JSON.stringify(cart));
        }
        catch { } }, [cart, ready]);
    const add = (item: Omit<CartItem, 'quantity'>) => setCart(old => { const i = old.findIndex(x => x.kind === item.kind && x.color === item.color && x.length === item.length); return i < 0 ? [...old, { ...item, quantity: 1 }] : old.map((x, j) => j === i ? { ...x, quantity: Math.min(10, x.quantity + 1) } : x); });
    return <Context.Provider value={{ favorites, toggleFavorite: k => setFavorites(old => old.includes(k) ? old.filter(x => x !== k) : [...old, k]), cart, add, quantity: (i, n) => setCart(old => old.map((x, j) => j === i ? { ...x, quantity: Math.max(1, Math.min(10, n)) } : x)), remove: i => setCart(old => old.filter((_, j) => j !== i)), ready }}><div className={s.site}>{children}</div></Context.Provider>;
}
export function useSite() { const value = useContext(Context); if (!value)
    throw Error('SiteProvider required'); return value; }
