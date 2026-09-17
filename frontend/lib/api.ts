import type { Product, ProductKind } from "./types.ts";
import mockProducts from "./mock/products.json" with { type: "json" };

/** 화면 코드는 fetch 를 직접 부르지 않고 이 파일의 함수만 부른다. */

export type ApiMode = "mock" | "api";

export function apiMode(): ApiMode {
  return process.env.NEXT_PUBLIC_API_MODE === "api" ? "api" : "mock";
}

async function get<T>(path: string, mock: T): Promise<T> {
  if (apiMode() === "mock") return mock;
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} 응답이 ${res.status} 입니다`);
  return (await res.json()) as T;
}

export async function getProducts(kind?: ProductKind): Promise<Product[]> {
  const all = await get<Product[]>("/api/products", mockProducts as Product[]);
  return kind ? all.filter((p) => p.kind === kind) : all;
}

export async function getProduct(slug: string): Promise<Product | null> {
  const all = await getProducts();
  return all.find((p) => p.slug === slug) ?? null;
}
