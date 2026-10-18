import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { get, imgUrl, Item } from "@/src/api";
import { useLang, useTranslated } from "@/src/i18n";
import { fonts, makeStyles, rarityColor, useTheme, spacing, radius } from "@/src/theme";
import { CATEGORY_ICON, Icon, statIcon } from "@/src/components/Icon";
import { ErrorState, Loading } from "@/src/components/States";

const BG = "https://images.unsplash.com/photo-1630695230041-8909e3204778?crop=entropy&cs=srgb&fm=jpg&q=70&w=900";

export default function ItemDetail() {
  const { category, slug } = useLocalSearchParams<{ category: string; slug: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const q = useQuery({ queryKey: ["item", category, slug], queryFn: () => get<Item>(`/items/${category}/${slug}`) });
  const it = q.data;
  const payload = it ? { summary: it.summary, features: it.features, set_effects: it.set_effects, sections: it.sections } : undefined;
  const tr = useTranslated(`item:${category}:${slug}:${it?.wiki_updated ?? ""}`, payload, !!it);
  const [open, setOpen] = useState<number | null>(0);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  const shareCard = async () => {
    if (!it) return;
    setSharing(true);
    try {
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(cardRef, { format: "png", quality: 0.95 });
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: it.title });
      } else {
        await Share.share({ message: `${it.title} (${it.rarity}) – ${it.wiki_url}` });
      }
    } catch {
      await Share.share({ message: `${it.title} – ${it.wiki_url}` }).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  if (q.isLoading) return <View style={s.root}><Loading /></View>;
  if (q.isError || !it) return <View style={[s.root, { paddingTop: insets.top }]}><ErrorState onRetry={() => q.refetch()} testID="item-error" /></View>;

  const rc = rarityColor(colors, it.rarity);
  const d = tr.data ?? payload!;
  const subtitle = [it.subtype, it.style].filter(Boolean).join(" – ").toUpperCase() || t(it.category as any).toUpperCase();
  const statsMain = it.stats.filter((st) => st.key !== "weapon_type" && st.key !== "type");

  return (
    <View style={s.root} testID="item-detail-screen">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.md }}>
        <View style={s.topBar}>
          <Pressable testID="item-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/codex"))} style={s.roundBtn} hitSlop={8}>
            <Icon name="chevron-left" size={26} color={colors.brandPrimary} />
          </Pressable>
          <View style={s.topRight}>
          <Pressable testID="item-share-button" onPress={shareCard} style={s.roundBtn} hitSlop={8}>
            {sharing ? <ActivityIndicator color={colors.brandPrimary} /> : <Icon name="share-variant" size={20} color={colors.brandPrimary} />}
          </Pressable>
          {it.category === "weapons" ? (
            <Pressable testID="item-compare-button" onPress={() => router.push({ pathname: "/compare", params: { a: it.slug } })} style={s.roundBtn} hitSlop={8}>
              <Icon name="scale-balance" size={20} color={colors.brandPrimary} />
            </Pressable>
          ) : null}
          <Pressable testID="item-ask-ai-button" onPress={() => router.push({ pathname: "/assistant", params: { q: lang === "cs" ? `Vysvětli ${it.title} – jak funguje, jaký build a kde ho získat?` : `Explain ${it.title} – how it works, best build and where to get it?` } })} style={s.aiBtn}>
            <Icon name="creation" size={16} color={colors.onBrandPrimary} />
            <Text style={s.aiBtnText}>{t("askAi")}</Text>
          </Pressable>
          </View>
        </View>

        {/* Ornate card frame */}
        <View ref={cardRef} collapsable={false} style={s.shot}>
        <Animated.View entering={FadeInUp.duration(450)} style={s.frameOuter}>
          <View style={s.frameInner}>
            <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
            {/* Title plate */}
            <View style={s.titlePlate}>
              <View style={s.emblem}>
                <Icon name={CATEGORY_ICON[it.category]} size={20} color={colors.goldLight} style={{ transform: [{ rotate: "-45deg" }] }} />
              </View>
              <Text style={s.title} testID="item-title" numberOfLines={3}>{it.title.toUpperCase()}</Text>
            </View>

            {/* Cinematic hero */}
            <View style={s.hero}>
              <Image source={{ uri: BG }} style={s.abs} contentFit="cover" />
              <LinearGradient colors={[colors.scrim, colors.glow, colors.scrim]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={s.abs} />
              <View style={[s.halo, { borderColor: rc }]} />
              {it.image ? (
                <Animated.View entering={FadeIn.delay(150).duration(600)} style={s.heroImgWrap}>
                  <Image testID="item-image" source={{ uri: imgUrl(it.image) }} style={s.heroImg} contentFit="contain" transition={300} />
                </Animated.View>
              ) : (
                <Icon name={CATEGORY_ICON[it.category]} size={96} color={rc} />
              )}
            </View>

            {/* Rarity ribbon */}
            <LinearGradient colors={[colors.goldDeep, rc, colors.goldDeep]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.ribbon}>
              <Text style={s.ribbonText} testID="item-rarity">{(it.rarity || t(it.category as any)).toUpperCase()}</Text>
              <View style={s.ribbonDiamond} />
            </LinearGradient>

            {/* Parchment panel */}
            <View style={s.parchment}>
              <Text style={s.subtitle} testID="item-subtitle">{subtitle}</Text>
              <View style={s.rule} />
              {tr.translating ? <Text style={s.translating} testID="item-translating">{t("translating")}</Text> : null}
              {d.summary ? <Text style={s.lore}>{d.summary}</Text> : null}
              {it.quote ? <Text style={s.quote}>„{it.quote}“</Text> : null}

              {statsMain.length ? (
                <View style={s.block}>
                  <Text style={s.blockTitle}>{t("stats")}</Text>
                  <View style={s.ruleThin} />
                  {statsMain.map((st) => (
                    <View key={st.key} style={s.statRow} testID={`stat-${st.key}`}>
                      <Icon name={statIcon(st.label)} size={16} color={colors.onSurfaceInverse} />
                      <Text style={s.statLabel}>{st.label}</Text>
                      <Text style={s.statValue}>{st.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {d.features?.length ? (
                <View style={s.block}>
                  <Text style={s.blockTitle}>{t("features")}</Text>
                  <View style={s.ruleThin} />
                  {d.features.map((f, i) => (
                    <View key={i} style={s.featRow}>
                      <Text style={s.featDot}>◆</Text>
                      <Text style={s.featText}>{f}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {d.set_effects?.length ? (
                <View style={s.block}>
                  <Text style={s.blockTitle}>{t("setEffects")}</Text>
                  <View style={s.ruleThin} />
                  {d.set_effects.map((se, i) => (
                    <View key={i} style={s.setRow}>
                      <View style={s.pcs}><Text style={s.pcsText}>{se.pieces}</Text></View>
                      <Text style={s.featText}>{se.effect}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {d.sections?.map((sec, i) => (
                <View key={i} style={s.acc}>
                  <Pressable testID={`item-section-${i}`} onPress={() => setOpen(open === i ? null : i)} style={s.accHead}>
                    <Text style={s.accTitle}>{sec.title}</Text>
                    <Icon name={open === i ? "chevron-up" : "chevron-down"} size={20} color={colors.parchmentMuted} />
                  </Pressable>
                  {open === i ? <Text style={s.accText}>{sec.text}</Text> : null}
                </View>
              ))}

              <View style={s.footer}>
                <Icon name="check-decagram" size={14} color={colors.success} />
                <Text style={s.footerText} testID="item-verified">
                  {t("verified")} · {t("updated")} {it.wiki_updated ? new Date(it.wiki_updated).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US") : "—"}
                </Text>
              </View>
              <Pressable testID="item-open-wiki" onPress={() => Linking.openURL(it.wiki_url)} style={s.wikiBtn}>
                <Icon name="open-in-new" size={14} color={colors.surfaceInverse} />
                <Text style={s.wikiText}>{t("openWiki")}</Text>
              </Pressable>
            </View>
            <View style={s.bottomOrn}><View style={s.ornDiamond} /></View>
          </View>
        </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const s = useStyles();
  const p = { tl: { top: -1, left: -1 }, tr: { top: -1, right: -1 }, bl: { bottom: -1, left: -1 }, br: { bottom: -1, right: -1 } }[pos];
  return <View style={[s.corner, p]}><View style={s.cornerDot} /></View>;
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  abs: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topRight: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  shot: { backgroundColor: c.surface },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.borderStrong },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: c.brandPrimary, paddingHorizontal: spacing.lg, minHeight: 44, borderRadius: radius.pill },
  aiBtnText: { color: c.onBrandPrimary, fontFamily: fonts.text, fontSize: 13 },
  frameOuter: { borderWidth: 2, borderColor: c.goldDeep, borderRadius: radius.sm, padding: 3, backgroundColor: c.surface },
  frameInner: { borderWidth: 1, borderColor: c.brandPrimary, borderRadius: radius.sm - 2, backgroundColor: c.surfaceSecondary, padding: spacing.sm },
  corner: { position: "absolute", width: 22, height: 22, alignItems: "center", justifyContent: "center", zIndex: 2 },
  cornerDot: { width: 10, height: 10, backgroundColor: c.brandPrimary, transform: [{ rotate: "45deg" }], borderWidth: 1, borderColor: c.goldLight },
  titlePlate: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  emblem: { width: 40, height: 40, transform: [{ rotate: "45deg" }], borderWidth: 2, borderColor: c.brandPrimary, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", marginLeft: spacing.xs },
  title: { flex: 1, color: c.surfaceInverse, fontFamily: fonts.display, fontSize: 28, lineHeight: 30, letterSpacing: 1 },
  hero: { height: 280, borderWidth: 1, borderColor: c.goldDeep, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
  halo: { position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 1, opacity: 0.35, backgroundColor: c.glowSoft },
  heroImgWrap: { width: "92%", height: "86%" },
  heroImg: { width: "100%", height: "100%" },
  ribbon: { height: 40, justifyContent: "center", paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginHorizontal: -spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.goldLight },
  ribbonText: { color: c.onBrand, fontFamily: fonts.display, fontSize: 22, letterSpacing: 3 },
  ribbonDiamond: { position: "absolute", right: spacing.xl, width: 14, height: 14, transform: [{ rotate: "45deg" }], backgroundColor: c.onBrand, borderWidth: 1, borderColor: c.goldLight },
  parchment: { backgroundColor: c.surfaceInverse, marginTop: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: c.parchmentLine, gap: spacing.md },
  subtitle: { color: c.onSurfaceInverse, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1 },
  rule: { height: 2, backgroundColor: c.parchmentMuted, opacity: 0.6 },
  ruleThin: { height: 1, backgroundColor: c.parchmentLine },
  translating: { color: c.parchmentMuted, fontFamily: fonts.displayItalic, fontSize: 14 },
  lore: { color: c.onSurfaceInverse, fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  quote: { color: c.parchmentMuted, fontFamily: fonts.displayItalic, fontSize: 17, lineHeight: 23 },
  block: { gap: spacing.sm, marginTop: spacing.xs },
  blockTitle: { color: c.parchmentMuted, fontFamily: fonts.text, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  statRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 26 },
  statLabel: { flex: 1, color: c.onSurfaceInverse, fontFamily: fonts.text, fontSize: 14 },
  statValue: { color: c.onSurfaceInverse, fontFamily: fonts.text, fontSize: 14, textAlign: "right" },
  featRow: { flexDirection: "row", gap: spacing.sm },
  featDot: { color: c.goldDeep, fontSize: 10, marginTop: 5 },
  featText: { flex: 1, color: c.onSurfaceInverse, fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
  setRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  pcs: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.onSurfaceInverse, alignItems: "center", justifyContent: "center" },
  pcsText: { color: c.goldLight, fontFamily: fonts.text, fontSize: 13 },
  acc: { borderTopWidth: 1, borderTopColor: c.parchmentLine },
  accHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  accTitle: { color: c.onSurfaceInverse, fontFamily: fonts.display, fontSize: 18, flex: 1 },
  accText: { color: c.onSurfaceInverse, fontFamily: fonts.text, fontSize: 13, lineHeight: 19, paddingBottom: spacing.md },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderTopWidth: 1, borderTopColor: c.parchmentLine, paddingTop: spacing.md },
  footerText: { color: c.parchmentMuted, fontFamily: fonts.text, fontSize: 11, flex: 1 },
  wikiBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", backgroundColor: c.onSurfaceInverse, paddingHorizontal: spacing.md, minHeight: 36, borderRadius: radius.pill },
  wikiText: { color: c.surfaceInverse, fontFamily: fonts.text, fontSize: 12 },
  bottomOrn: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.xs },
  ornDiamond: { width: 12, height: 12, transform: [{ rotate: "45deg" }], borderWidth: 1.5, borderColor: c.brandPrimary },
}));
