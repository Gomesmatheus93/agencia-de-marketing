import { ENV } from "../../_core/env";

// Busca de fotos em bancos gratuitos (Pexels, Unsplash, Pixabay) para os
// agentes usarem nas artes. Devolve URLs https que o renderizador embute.

export type StockPhoto = { url: string; thumb: string; width: number; height: number; author: string; source: string };

type Orientation = "portrait" | "landscape" | "square";

async function pexels(query: string, orientation: Orientation, n: number): Promise<StockPhoto[]> {
  if (!ENV.pexelsApiKey) return [];
  const params = new URLSearchParams({ query, per_page: String(n), orientation, locale: "pt-BR" });
  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, { headers: { Authorization: ENV.pexelsApiKey }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { photos?: Array<{ width: number; height: number; photographer: string; src: { large2x: string; medium: string } }> };
  return (data.photos ?? []).map((p) => ({ url: p.src.large2x, thumb: p.src.medium, width: p.width, height: p.height, author: p.photographer, source: "Pexels" }));
}

async function unsplash(query: string, orientation: Orientation, n: number): Promise<StockPhoto[]> {
  if (!ENV.unsplashAccessKey) return [];
  const params = new URLSearchParams({ query, per_page: String(n), orientation: orientation === "square" ? "squarish" : orientation, lang: "pt" });
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, { headers: { Authorization: `Client-ID ${ENV.unsplashAccessKey}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: Array<{ width: number; height: number; user: { name: string }; urls: { regular: string; small: string } }> };
  return (data.results ?? []).map((p) => ({ url: p.urls.regular, thumb: p.urls.small, width: p.width, height: p.height, author: p.user.name, source: "Unsplash" }));
}

async function pixabay(query: string, orientation: Orientation, n: number): Promise<StockPhoto[]> {
  if (!ENV.pixabayApiKey) return [];
  const params = new URLSearchParams({ key: ENV.pixabayApiKey, q: query, per_page: String(Math.max(3, n)), image_type: "photo", lang: "pt", safesearch: "true", orientation: orientation === "landscape" ? "horizontal" : orientation === "portrait" ? "vertical" : "all" });
  const res = await fetch(`https://pixabay.com/api/?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { hits?: Array<{ imageWidth: number; imageHeight: number; user: string; largeImageURL: string; webformatURL: string }> };
  return (data.hits ?? []).map((p) => ({ url: p.largeImageURL, thumb: p.webformatURL, width: p.imageWidth, height: p.imageHeight, author: p.user, source: "Pixabay" }));
}

export async function searchStockPhotos(query: string, orientation: Orientation = "portrait", perSource = 4): Promise<StockPhoto[]> {
  const results = await Promise.allSettled([pexels(query, orientation, perSource), unsplash(query, orientation, perSource), pixabay(query, orientation, perSource)]);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
