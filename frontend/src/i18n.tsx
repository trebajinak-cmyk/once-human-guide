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
} as const;

export type StrKey = keyof typeof STR;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StrKey) => string };
const LangCtx = createContext<Ctx>({ lang: "cs", setLang: () => {}, t: (k) => STR[k].cs });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("cs");
  useEffect(() => {
    storage.getItem("lang", "cs").then((v) => setLangState(v === "en" ? "en" : "cs"));
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
