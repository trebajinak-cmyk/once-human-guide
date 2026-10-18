import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { get, NewsItem } from "@/src/api";
import { useLang } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { CATEGORY_ICON, Icon } from "@/src/components/Icon";
import { ErrorState, Loading } from "@/src/components/States";

const HERO = "https://images.unsplash.com/photo-1630695230041-8909e3204778?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200";
const CATS = ["weapons", "armor", "deviations", "weapon_mods", "armor_mods"] as const;

type Meta = { sync: { last_sync?: string }; counts: Record<string, number> };

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const news = useQuery({ queryKey: ["news"], queryFn: () => get<NewsItem[]>("/news?limit=12") });
  const meta = useQuery({ queryKey: ["meta"], queryFn: () => get<Meta>("/meta") });
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const patch = news.data?.find((n) => n.is_patch) ?? news.data?.[0];
  const fmt = (d: string) => new Date(d).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <View style={s.root} testID="home-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
        refreshControl={
          <RefreshControl tintColor={colors.brandPrimary} refreshing={news.isRefetching} onRefresh={() => { news.refetch(); meta.refetch(); }} />
        }
      >
        <View style={s.hero}>
          <Image source={{ uri: HERO }} style={s.heroImg} contentFit="cover" />
          <LinearGradient colors={[colors.scrimLight, colors.glowSoft, colors.surface]} style={s.heroFill} />
          <View style={[s.heroContent, { paddingTop: insets.top + spacing.md }]}>
            <View style={s.heroTop}>
              <View style={s.brandRow}>
                <View style={s.diamond}><Icon name="shield-sword" size={16} color={colors.brandPrimary} style={{ transform: [{ rotate: "-45deg" }] }} /></View>
                <Text style={s.kicker}>{t("heroKicker")}</Text>
              </View>
              <Pressable testID="open-settings-button" onPress={() => router.push("/settings")} style={s.iconBtn} hitSlop={8}>
                <Icon name="cog-outline" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <Text style={s.heroTitle}>ONCE HUMAN</Text>
            <Text style={s.heroTitle2}>Field Guide</Text>
            <Text style={s.heroSub}>{t("heroSub")}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>{t("latestPatch")}</Text>
          {news.isLoading ? <Loading /> : news.isError ? <ErrorState onRetry={() => news.refetch()} testID="home-news-error" /> : patch ? (
            <Animated.View entering={FadeInDown.duration(400)}>
              <Pressable testID="latest-patch-card" onPress={() => router.push({ pathname: "/news/[gid]", params: { gid: patch.gid } })} style={s.patchCard}>
                {patch.image ? <Image source={{ uri: patch.image }} style={s.patchImg} contentFit="cover" /> : null}
                <View style={s.patchBody}>
                  <View style={s.badgeRow}>
                    <View style={s.badge}><Text style={s.badgeText}>{t("patch")}</Text></View>
                    <Text style={s.date}>{fmt(patch.date)}</Text>
                  </View>
                  <Text style={s.patchTitle}>{patch.title}</Text>
                  <Text numberOfLines={3} style={s.excerpt}>{patch.excerpt}</Text>
                </View>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>{t("database")}</Text>
          <View style={s.grid}>
            {CATS.map((c, i) => (
              <Animated.View key={c} entering={FadeInDown.delay(80 * i).duration(400)} style={i === 0 ? s.gridWide : s.gridHalf}>
                <Pressable
                  testID={`quick-link-${c}`}
                  onPress={() => router.push({ pathname: "/codex", params: { category: c } })}
                  style={({ pressed }) => [s.quick, pressed && { opacity: 0.8 }]}
                >
                  <Icon name={CATEGORY_ICON[c]} size={26} color={colors.brandPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.quickTitle}>{t(c)}</Text>
                    <Text style={s.quickCount}>{meta.data?.counts?.[c] ?? "–"} {t("items")}</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <View style={s.rowBetween}>
            <Text style={s.sectionLabel}>{t("news")}</Text>
            <Pressable testID="all-news-button" onPress={() => router.push("/news")} hitSlop={8}>
              <Text style={s.link}>{t("allNews")}</Text>
            </Pressable>
          </View>
          {(news.data ?? []).filter((n) => n.gid !== patch?.gid).slice(0, 5).map((n) => (
            <Pressable key={n.gid} testID={`news-row-${n.gid}`} onPress={() => router.push({ pathname: "/news/[gid]", params: { gid: n.gid } })} style={s.newsRow}>
              {n.image ? <Image source={{ uri: n.image }} style={s.newsThumb} contentFit="cover" /> : <View style={[s.newsThumb, s.thumbFallback]}><Icon name="newspaper-variant-outline" size={22} color={colors.muted} /></View>}
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text numberOfLines={2} style={s.newsTitle}>{n.title}</Text>
                <Text style={s.date}>{fmt(n.date)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { height: 340, justifyContent: "flex-end" },
  heroImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  diamond: { width: 30, height: 30, borderWidth: 1.5, borderColor: c.brandPrimary, transform: [{ rotate: "45deg" }], alignItems: "center", justifyContent: "center", backgroundColor: c.scrim },
  kicker: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.glass },
  heroTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 48, letterSpacing: 3, marginTop: "auto" },
  heroTitle2: { color: c.goldLight, fontFamily: fonts.displayItalic, fontSize: 30, marginTop: -spacing.sm },
  heroSub: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13, marginTop: spacing.sm, maxWidth: 320 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md },
  sectionLabel: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { color: c.goldLight, fontFamily: fonts.text, fontSize: 13 },
  patchCard: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.borderStrong },
  patchImg: { width: "100%", height: 160 },
  patchBody: { padding: spacing.lg, gap: spacing.sm },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { backgroundColor: c.brandSecondary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { color: c.onBrandSecondary, fontFamily: fonts.text, fontSize: 10, letterSpacing: 1.5 },
  date: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  patchTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  excerpt: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  gridWide: { width: "100%" },
  gridHalf: { flexBasis: "47%", flexGrow: 1 },
  quick: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.borderStrong, minHeight: 72 },
  quickTitle: { color: c.onBrandTertiary, fontFamily: fonts.display, fontSize: 19 },
  quickCount: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
  newsRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  newsThumb: { width: 84, height: 56, borderRadius: radius.sm, backgroundColor: c.surfaceTertiary },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  newsTitle: { color: c.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 14, lineHeight: 19 },
}));
