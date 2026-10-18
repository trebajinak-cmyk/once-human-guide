import { storage } from "@/src/utils/storage";
import { ItemCard } from "@/src/api";

export const SLOTS = ["Helmet", "Mask", "Top", "Gloves", "Bottoms", "Shoes"] as const;
export type Slot = (typeof SLOTS)[number];
export type Ref = Pick<ItemCard, "slug" | "category" | "title" | "image" | "rarity" | "subtype"> | null;

export type Build = {
  id: string;
  name: string;
  keyword?: string;
  weapon: Ref;
  weapon_mod: Ref;
  armor: Record<Slot, Ref>;
  armor_mods: Record<Slot, Ref>;
  deviation: Ref;
  notes: string;
  ai?: {
    summary?: string;
    playstyle?: string;
    calibration?: string;
    substats?: string[];
    rotation?: string[];
    tips?: string[];
    creator_refs?: { video_id: string; title: string; channel: string; why?: string; thumbnail: string }[];
  };
  updated: string;
};

const KEY = "saved_builds";

const emptySlots = (): Record<Slot, Ref> => ({ Helmet: null, Mask: null, Top: null, Gloves: null, Bottoms: null, Shoes: null });

export function newBuild(): Build {
  return {
    id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    weapon: null,
    weapon_mod: null,
    armor: emptySlots(),
    armor_mods: emptySlots(),
    deviation: null,
    notes: "",
    updated: new Date().toISOString(),
  };
}

export async function loadBuilds(): Promise<Build[]> {
  const raw = await storage.getItem(KEY, "[]");
  try {
    return JSON.parse(String(raw)) as Build[];
  } catch {
    return [];
  }
}

export async function saveBuild(b: Build) {
  const all = await loadBuilds();
  const next = [{ ...b, updated: new Date().toISOString() }, ...all.filter((x) => x.id !== b.id)];
  await storage.setItem(KEY, JSON.stringify(next));
}

export async function deleteBuild(id: string) {
  const all = await loadBuilds();
  await storage.setItem(KEY, JSON.stringify(all.filter((x) => x.id !== id)));
}

/** Count how many armor slots use each Armor Set. */
export function setCounts(b: Build) {
  const m: Record<string, { ref: NonNullable<Ref>; count: number }> = {};
  SLOTS.forEach((s) => {
    const r = b.armor[s];
    if (r && r.subtype === "Armor Set") {
      m[r.slug] = m[r.slug] ? { ...m[r.slug], count: m[r.slug].count + 1 } : { ref: r, count: 1 };
    }
  });
  return Object.values(m);
}

export function toRef(i: ItemCard | null | undefined): Ref {
  return i ? { slug: i.slug, category: i.category, title: i.title, image: i.image, rarity: i.rarity, subtype: i.subtype } : null;
}
