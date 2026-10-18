import { useMemo, useState } from "react";
import { Linking, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { get, imgUrl } from "@/src/api";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { ChipRow } from "@/src/components/Chip";
import { Icon } from "@/src/components/Icon";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ErrorState, Loading } from "@/src/components/States";

type Marker = { id: string; cat: string; x: number; y: number; title: string; desc: string; image: string; wiki_url: string; coords: string };
type MapResp = { title: string; image: string; categories: { id: string; name: string; icon: string; count: number }[]; markers: Marker[]; source: string };

const MARK = 26;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const q = useQuery({ queryKey: ["map"], queryFn: () => get<MapResp>("/map") });
  const [cat, setCat] = useState("");
  const [sel, setSel] = useState<Marker | null>(null);
  const size = width;

  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.min(6, Math.max(1, saved.value * e.scale)); })
    .onEnd(() => { saved.value = scale.value; });
  const pan = Gesture.Pan()
    .onUpdate((e) => { tx.value = sx.value + e.translationX; ty.value = sy.value + e.translationY; })
    .onEnd(() => { sx.value = tx.value; sy.value = ty.value; });
  const gesture = Gesture.Simultaneous(pinch, pan);

  const mapStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  const zoom = (f: number) => {
    const n = Math.min(6, Math.max(1, saved.value * f));
    scale.value = withTiming(n);
    saved.value = n;
    if (n === 1) { tx.value = withTiming(0); ty.value = withTiming(0); sx.value = 0; sy.value = 0; }
  };

  const catIcon = useMemo(() => Object.fromEntries((q.data?.categories ?? []).map((c) => [c.id, c.icon])), [q.data]);
  const catName = useMemo(() => Object.fromEntries((q.data?.categories ?? []).map((c) => [c.id, c.name])), [q.data]);
  const markers = (q.data?.markers ?? []).filter((m) => !cat || m.cat === cat);

  return (
    <View style={s.root} testID="map-screen">
      <ScreenHeader back title={t("map")} subtitle={q.data?.title} />
      {q.isLoading ? <Loading /> : q.isError || !q.data ? <ErrorState onRetry={() => q.refetch()} testID="map-error" /> : (
        <>
          <ChipRow testPrefix="map-cat" value={cat} onChange={(v) => { setCat(v); setSel(null); }}
            options={[{ value: "", label: `${t("all")} (${q.data.markers.length})` }, ...q.data.categories.map((c) => ({ value: c.id, label: `${c.name} (${c.count})` }))]} />
          <View style={s.viewport}>
            <GestureDetector gesture={gesture}>
              <Animated.View style={[{ width: size, height: size }, mapStyle]} testID="map-canvas">
                <Image source={{ uri: imgUrl(q.data.image) }} style={{ width: size, height: size }} contentFit="cover" transition={300} />
                {markers.map((m) => (
                  <MarkerPin key={m.id} m={m} size={size} scale={scale} icon={catIcon[m.cat]} active={sel?.id === m.id} onPress={() => setSel(m)} />
                ))}
              </Animated.View>
            </GestureDetector>
            <View style={s.zoom}>
              <Pressable testID="map-zoom-in" onPress={() => zoom(1.6)} style={s.zoomBtn}><Icon name="plus" size={22} color={colors.onSurface} /></Pressable>
              <Pressable testID="map-zoom-out" onPress={() => zoom(1 / 1.6)} style={s.zoomBtn}><Icon name="minus" size={22} color={colors.onSurface} /></Pressable>
            </View>
          </View>
          {sel ? (
            <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.md }]} testID="map-marker-card">
              <View style={s.sheetHead}>
                {catIcon[sel.cat] ? <Image source={{ uri: imgUrl(catIcon[sel.cat]) }} style={s.catIcon} contentFit="contain" /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetCat}>{catName[sel.cat]}</Text>
                  <Text style={s.sheetTitle} numberOfLines={2}>{sel.title}</Text>
                </View>
                <Pressable testID="map-marker-close" onPress={() => setSel(null)} style={s.closeBtn} hitSlop={8}><Icon name="close" size={22} color={colors.muted} /></Pressable>
              </View>
              {sel.image ? <Image source={{ uri: imgUrl(sel.image) }} style={s.photo} contentFit="cover" /> : null}
              <Text style={s.coords}>X/Y: {sel.coords}</Text>
              <View style={s.btnRow}>
                {sel.wiki_url ? (
                  <Pressable testID="map-marker-wiki" onPress={() => Linking.openURL(sel.wiki_url)} style={s.btn}>
                    <Icon name="open-in-new" size={16} color={colors.onBrandTertiary} />
                    <Text style={s.btnText}>{t("openWiki")}</Text>
                  </Pressable>
                ) : null}
                <Pressable testID="map-marker-ask-ai" onPress={() => router.push({ pathname: "/assistant", params: { q: lang === "cs" ? `Co najdu na místě ${sel.title} (${catName[sel.cat]}) v Once Human a jak se tam připravit?` : `What is at ${sel.title} (${catName[sel.cat]}) in Once Human and how to prepare?` } })} style={[s.btn, s.btnGold]}>
                  <Icon name="creation" size={16} color={colors.onBrandPrimary} />
                  <Text style={[s.btnText, { color: colors.onBrandPrimary }]}>{t("askAboutPlace")}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={[s.note, { paddingBottom: insets.bottom + spacing.md }]}>{t("mapNote")}</Text>
          )}
        </>
      )}
    </View>
  );
}

function MarkerPin({ m, size, scale, icon, active, onPress }: { m: Marker; size: number; scale: SharedValue<number>; icon?: string; active: boolean; onPress: () => void }) {
  const s = useStyles();
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.value }] }));
  return (
    <Animated.View style={[s.pin, { left: m.x * size - MARK / 2, top: m.y * size - MARK / 2 }, st]}>
      <Pressable testID={`map-marker-${m.id}`} onPress={onPress} hitSlop={10} style={[s.pinInner, active && s.pinActive]}>
        {icon ? <Image source={{ uri: imgUrl(icon) }} style={s.pinImg} contentFit="contain" /> : null}
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  viewport: { flex: 1, overflow: "hidden", backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  zoom: { position: "absolute", right: spacing.md, top: spacing.md, gap: spacing.sm },
  zoomBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.glass, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderStrong },
  pin: { position: "absolute", width: MARK, height: MARK },
  pinInner: { width: MARK, height: MARK, borderRadius: MARK / 2, backgroundColor: c.scrim, borderWidth: 1, borderColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  pinActive: { borderColor: c.goldLight, borderWidth: 2, backgroundColor: c.brandSecondary },
  pinImg: { width: MARK - 6, height: MARK - 6 },
  sheet: { backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.borderStrong, padding: spacing.lg, gap: spacing.sm },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  catIcon: { width: 32, height: 32 },
  sheetCat: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  sheetTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 22 },
  closeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  photo: { width: "100%", height: 120, borderRadius: radius.sm },
  coords: { color: c.muted, fontFamily: "SpaceMono", fontSize: 11 },
  btnRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  btn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: c.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 40 },
  btnGold: { backgroundColor: c.brandPrimary },
  btnText: { color: c.onBrandTertiary, fontFamily: fonts.text, fontSize: 12 },
  note: { color: c.muted, fontFamily: fonts.text, fontSize: 12, textAlign: "center", paddingTop: spacing.md, paddingHorizontal: spacing.lg },
}));
