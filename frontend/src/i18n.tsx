import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { storage } from "@/src/utils/storage";
import { post } from "@/src/api";

export type Lang = "cs" | "en";

const STR = {
  home: { cs: "Domů", en: "Home" },
  codex: { cs: "Codex", en: "Codex" },
  guides: { cs: "Návody", en: "Guides" },
  ai: { cs: "AI", en: "AI" },
  appTitle: { cs: "Once Human Guide", en: "Once Human Guide" },
  heroKicker: { cs: "KOMPLETNÍ HERNÍ PŘÍRUČKA", en: "COMPLETE FIELD GUIDE" },
  heroSub: { cs: "Ověřená data z Once Human Wiki a oficiální novinky ze Steamu – živě.", en: "Verified data from the Once Human Wiki and official Steam news – live." },
  latestPatch: { cs: "Nejnovější aktualizace", en: "Latest update" },
  news: { cs: "Novinky", en: "News" },
  allNews: { cs: "Všechny novinky", en: "All news" },
  database: { cs: "Databáze", en: "Database" },
  weapons: { cs: "Zbraně", en: "Weapons" },
  armor: { cs: "Armor", en: "Armor" },
  deviations: { cs: "Deviace", en: "Deviations" },
  weapon_mods: { cs: "Weapon mody", en: "Weapon mods" },
  armor_mods: { cs: "Armor mody", en: "Armor mods" },
  all: { cs: "Vše", en: "All" },
  search: { cs: "Hledat zbraně, armor, mody…", en: "Search weapons, armor, mods…" },
  noResults: { cs: "Nic nenalezeno", en: "Nothing found" },
  signalLost: { cs: "Signál ztracen", en: "Signal lost" },
  retry: { cs: "Zkusit znovu", en: "Retry" },
  awaiting: { cs: "Čekám na přenos…", en: "Awaiting transmission…" },
  items: { cs: "záznamů", en: "entries" },
  stats: { cs: "Statistiky", en: "Stats" },
  features: { cs: "Vlastnosti", en: "Features" },
  setEffects: { cs: "Set bonusy", en: "Set effects" },
  pieces: { cs: "ks", en: "pc" },
  verified: { cs: "Ověřeno · Once Human Wiki", en: "Verified · Once Human Wiki" },
  updated: { cs: "Aktualizováno", en: "Updated" },
  openWiki: { cs: "Otevřít na wiki", en: "Open on wiki" },
  askAi: { cs: "Zeptat se AI", en: "Ask the AI" },
  translating: { cs: "Překládám do češtiny…", en: "Translating…" },
  translate: { cs: "Přeložit do češtiny", en: "Translate" },
  original: { cs: "Zobrazit originál", en: "Show original" },
  videos: { cs: "Video návody", en: "Video tutorials" },
  wikiArticle: { cs: "Ověřený článek z wiki", en: "Verified wiki article" },
  openYoutube: { cs: "Otevřít v YouTube", en: "Open in YouTube" },
  tutorialsTitle: { cs: "Návody a mechaniky", en: "Tutorials & mechanics" },
  tutorialsSub: { cs: "Každá mechanika s videi a ověřeným článkem.", en: "Every mechanic with videos and a verified article." },
  aiTitle: { cs: "AI průvodce", en: "AI guide" },
  aiSub: { cs: "Hledá živě na wiki a v oficiálních novinkách", en: "Searches the wiki and official news live" },
  aiGreeting: {
    cs: "Ahoj, Meto! Zeptej se na cokoliv o Once Human – buildy, zbraně, armor sety, deviace, mechaniky nebo poslední patch. Odpovídám z ověřených dat, která právě vyhledám online.",
    en: "Hi, Meta! Ask anything about Once Human – builds, weapons, armor sets, deviations, mechanics or the latest patch. I answer from verified data I look up online right now.",
  },
  askPlaceholder: { cs: "Napiš otázku…", en: "Type a question…" },
  sources: { cs: "Zdroje", en: "Sources" },
  clearChat: { cs: "Nový chat", en: "New chat" },
  aiError: { cs: "AI teď neodpovídá. Zkus to znovu.", en: "The AI is not responding. Try again." },
  settings: { cs: "Nastavení", en: "Settings" },
  language: { cs: "Jazyk", en: "Language" },
  dataSync: { cs: "Synchronizace dat", en: "Data sync" },
  lastSync: { cs: "Poslední synchronizace", en: "Last sync" },
  syncNow: { cs: "Synchronizovat teď", en: "Sync now" },
  syncing: { cs: "Synchronizuji…", en: "Syncing…" },
  bridge: { cs: "AI Bridge – propojení s jinými AI", en: "AI Bridge – connect other AIs" },
  bridgeSub: {
    cs: "Napoj ChatGPT, Claude, Gemini nebo vlastní aplikaci na ověřená data této příručky.",
    en: "Connect ChatGPT, Claude, Gemini or your own app to this guide's verified data.",
  },
  copy: { cs: "Kopírovat", en: "Copy" },
  copied: { cs: "Zkopírováno", en: "Copied" },
  copyPrompt: { cs: "Kopírovat prompt pro AI", en: "Copy prompt for AI" },
  sourcesTitle: { cs: "Zdroje dat", en: "Data sources" },
  read: { cs: "Číst", en: "Read" },
  patch: { cs: "PATCH", en: "PATCH" },
  quickAsk: { cs: "Rychlé otázky", en: "Quick questions" },
  tools: { cs: "Nástroje", en: "Tools" },
  builds: { cs: "Plánovač buildů", en: "Build planner" },
  buildsSub: { cs: "Vlastní buildy a AI dle Anestic & Doomeris", en: "Custom builds & AI like Anestic & Doomeris" },
  compare: { cs: "Porovnání zbraní", en: "Weapon compare" },
  compareSub: { cs: "Dvě zbraně vedle sebe", en: "Two weapons side by side" },
  map: { cs: "Interaktivní mapa", en: "Interactive map" },
  mapSub: { cs: "Deviace, Crates, Silo, bossové", en: "Deviations, crates, silos, bosses" },
  myBuilds: { cs: "Moje buildy", en: "My builds" },
  newBuild: { cs: "Nový build", en: "New build" },
  aiBuild: { cs: "AI build", en: "AI build" },
  noBuilds: { cs: "Zatím žádné uložené buildy", en: "No saved builds yet" },
  buildName: { cs: "Název buildu", en: "Build name" },
  weapon: { cs: "Zbraň", en: "Weapon" },
  weaponMod: { cs: "Weapon mod", en: "Weapon mod" },
  armorSlots: { cs: "Armor (6 slotů)", en: "Armor (6 slots)" },
  armorModsT: { cs: "Armor mody", en: "Armor mods" },
  deviation: { cs: "Deviace", en: "Deviation" },
  notes: { cs: "Poznámky", en: "Notes" },
  save: { cs: "Uložit do oblíbených", en: "Save to favourites" },
  saved: { cs: "Uloženo", en: "Saved" },
  delete: { cs: "Smazat", en: "Delete" },
  choose: { cs: "Vybrat", en: "Choose" },
  activeSets: { cs: "Aktivní set bonusy", en: "Active set bonuses" },
  aiReview: { cs: "AI hodnocení buildu", en: "AI build review" },
  reviewing: { cs: "AI analyzuje build…", en: "AI is analysing…" },
  generate: { cs: "Vygenerovat build", en: "Generate build" },
  generating: { cs: "AI skládá build podle Anestic & Doomeris… (až 60 s)", en: "AI is crafting a build like Anestic & Doomeris… (up to 60 s)" },
  goal: { cs: "Cíl (např. silo boss, solo, začátečník)", en: "Goal (e.g. silo boss, solo, beginner)" },
  keyword: { cs: "Klíčový efekt", en: "Main keyword" },
  creatorVideos: { cs: "Zdrojová videa tvůrců", en: "Creator source videos" },
  rotation: { cs: "Rotace", en: "Rotation" },
  tips: { cs: "Tipy", en: "Tips" },
  substats: { cs: "Priorita substatů", en: "Substat priority" },
  calibration: { cs: "Kalibrace", en: "Calibration" },
  openInEditor: { cs: "Uložit a upravit", en: "Save & edit" },
  share: { cs: "Sdílet kartu", en: "Share card" },
  shareBuild: { cs: "Sdílet build", en: "Share build" },
  pickWeapon: { cs: "Vyber zbraň", en: "Pick a weapon" },
  higherBetter: { cs: "Zvýrazněna lepší hodnota", en: "Better value highlighted" },
  creatorsNote: { cs: "AI se učí z popisů a časových os nejnovějších videí Anestic a Doomeris a používá jen ověřené položky z wiki.", en: "The AI learns from the descriptions & timestamps of the latest Anestic and Doomeris videos and uses only verified wiki items." },
  mapNote: { cs: "Mapa Nalcott Island z Once Human Wiki. Přibliž dvěma prsty, klepni na značku.", en: "Nalcott Island map from the Once Human Wiki. Pinch to zoom, tap a marker." },
  askAboutPlace: { cs: "Zeptat se AI na místo", en: "Ask the AI about it" },
  creatorsKb: { cs: "Znalosti tvůrců", en: "Creator knowledge" },
  creatorsKbSub: { cs: "Všechna videa Anestic & Doomeris rozebraná AI", en: "Every Anestic & Doomeris video analysed by AI" },
  analyzedVideos: { cs: "videí rozebráno", en: "videos analysed" },
  noGeminiKey: { cs: "Chybí Gemini API klíč – zatím jen názvy a popisy videí", en: "Gemini API key missing – titles & descriptions only" },
  kbPaused: { cs: "Denní limit Gemini vyčerpán – pokračuje automaticky", en: "Gemini daily limit reached – resumes automatically" },
  kbRunning: { cs: "AI průběžně sleduje a rozebírá videa, nová se přidávají automaticky", en: "AI keeps watching videos; new ones are added automatically" },
  kbSearch: { cs: "Hledat v obsahu videí…", en: "Search video knowledge…" },
  onlyAnalyzed: { cs: "Jen rozebraná", en: "Analysed only" },
  analyzedBadge: { cs: "Rozebráno AI", en: "AI analysed" },
  queuedBadge: { cs: "Ve frontě na rozbor", en: "Queued for analysis" },
  notAnalyzedYet: { cs: "AI toto video ještě nezhlédla. Zatím se používá jen popis a časová osa.", en: "The AI hasn't watched this video yet. Only description & timestamps are used so far." },
  summary: { cs: "Shrnutí", en: "Summary" },
  mechanicsT: { cs: "Mechaniky", en: "Mechanics" },
  keyFacts: { cs: "Klíčová fakta (klepni = přehraj od času)", en: "Key facts (tap = play from time)" },
  opinionsT: { cs: "Názory tvůrce", en: "Creator opinions" },
  descriptionT: { cs: "Popis videa", en: "Video description" },
  creatorsSay: { cs: "Co říkají Anestic & Doomeris", en: "What Anestic & Doomeris say" },
} as const;

export type StrKey = keyof typeof STR;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StrKey) => string };
const LangCtx = createContext<Ctx>({ lang: "cs", setLang: () => {}, t: (k) => STR[k].cs });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("cs");
  useEffect(() => {
    storage.getItem("lang", "cs" as string).then((v) => setLangState(v === "en" ? "en" : "cs"));
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem("lang", l);
  }, []);
  const t = useCallback((k: StrKey) => STR[k][lang], [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

/** Translate a JSON payload via backend AI (cached server-side). Returns original while loading. */
export function useTranslated<T>(key: string, data: T | undefined, enabled: boolean) {
  const { lang } = useLang();
  const on = enabled && lang !== "en" && !!data;
  const q = useQuery({
    queryKey: ["tr", lang, key],
    queryFn: () => post<{ data: T }>("/translate", { key, lang, data }).then((r) => r.data),
    enabled: on,
    staleTime: Infinity,
    retry: 1,
  });
  return { data: (on && q.data) || data, translating: on && q.isLoading };
}
