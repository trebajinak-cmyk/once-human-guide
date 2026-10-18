export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const API = `${BACKEND_URL}/api`;

/** Wiki CDN blocks foreign referrers – route those images through our backend proxy. */
export function imgUrl(u?: string) {
  if (!u) return u;
  if (u.startsWith("https://static.wikia.nocookie.net/") || u.startsWith("https://once-human.fandom.com/")) {
    return `${API}/img?u=${encodeURIComponent(u)}`;
  }
  return u;
}

export type Category = "weapons" | "armor" | "deviations" | "weapon_mods" | "armor_mods";

export type ItemCard = {
  slug: string;
  category: Category;
  title: string;
  image: string;
  rarity: string;
  style: string;
  subtype: string;
};

export type Stat = { key: string; label: string; value: string };
export type Section = { title: string; text: string };

export type Item = ItemCard & {
  quote: string;
  summary: string;
  stats: Stat[];
  features: string[];
  set_effects: { pieces: string; effect: string }[];
  sections: Section[];
  wiki_url: string;
  wiki_updated: string;
  synced_at: string;
};

export type NewsItem = {
  gid: string;
  title: string;
  url: string;
  author: string;
  date: string;
  feed: string;
  image: string;
  excerpt: string;
  is_patch: boolean;
  blocks?: { type: "p" | "h" | "img"; value: string }[];
};

export type Video = {
  video_id: string;
  title: string;
  channel: string;
  duration: string;
  published: string;
  views: string;
  thumbnail: string;
};

export type Guide = {
  id: string;
  group: string;
  icon: string;
  title: { cs: string; en: string };
  summary: { cs: string; en: string };
  wiki: string[];
  yt: string;
};

export type GuideDetail = Guide & {
  articles: { title: string; image: string; sections: Section[]; wiki_url: string; wiki_updated: string }[];
  videos: Video[];
};

export async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
