import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { get, imgUrl, Item, ItemCard } from "@/src/api";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, rarityColor, useTheme, spacing, radius } from "@/src/theme";
import { Icon, statIcon } from "@/src/components/Icon";
import { ItemPicker, PickerSpec } from "@/src/components/ItemPicker";
import { ScreenHeader } from "@/src/components/ScreenHeader";

const LOWER_BETTER = ["weight"];
const num = (v?: string) => {
  if (!v) return NaN;
  const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};

export default function Compare() {
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();
  const s = useStyles();
  const [a, setA] = useState(params.a ?? "");
  const [b, setB] = useState(params.b ?? "");
  const [pick, setPick] = useState<"a" | "b" | null>(null);
  const qa = useQuery({ queryKey: ["item", "weapons", a], queryFn: () => get<Item>(`/items/weapons/${a}`), enabled: !!a });
  const qb = useQuery({ queryKey: ["item", "weapons", b], queryFn: () => get<Item>(`/items/weapons/${b}`), enabled: !!b });
  const A = qa.data, B = qb.data;

  const labels: string[] = [];
  [A, B].forEach((it) => it?.stats.forEach((st) => { if (!labels.includes(st.label) && st.key !== "weapon_type") labels.push(st.label); }));
  const val = (it: Item | undefined, l: string) => it?.stats.find((st) => st.label === l)?.value;

  const spec: PickerSpec = pick ? { title: t("pickWeapon"), category: "weapons" } : null;

  return (
    <View style={s.root} testID="compare-screen">
      <ScreenHeader back title={t("compare")} subtitle={t("higherBetter")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={s.heads}>
          {[{ k: "a" as const, it: A }, { k: "b" as const, it: B }].map(({ k, it }) => (
            <Pressable key={k} testID={`compare-pick-${k}`} onPress={() => setPick(k)} style={[s.head, it && { borderColor: rarityColor(colors, it.rarity) }]}>
              {it?.image ? <Image source={{ uri: imgUrl(it.image) }} style={s.img} contentFit="contain" /> : <Icon name="plus-circle-outline" size={36} color={colors.muted} />}
              <Text style={s.name} numberOfLines={2}>{it?.title ?? t("pickWeapon")}</Text>
              {it ? <Text style={[s.meta, { color: rarityColor(colors, it.rarity) }]} numberOfLines={1}>{[it.rarity, it.subtype].filter(Boolean).join(" · ")}</Text> : null}
            </Pressable>
          ))}
        </View>
        {A && B ? (
          <Pressable testID="compare-swap" onPress={() => { setA(b); setB(a); }} style={s.swap}>
            <Icon name="swap-horizontal" size={18} color={colors.goldLight} />
          </Pressable>
        ) : null}
        {labels.length ? (
          <View style={s.table} testID="compare-table">
            {labels.map((l) => {
              const va = val(A, l), vb = val(B, l);
              const na = num(va), nb = num(vb);
              const comparable = !isNaN(na) && !isNaN(nb) && na !== nb;
              const lower = LOWER_BETTER.some((x) => l.toLowerCase().includes(x));
              const aWins = comparable && (lower ? na < nb : na > nb);
              const bWins = comparable && !aWins;
              const diff = comparable ? Math.abs(na - nb) : 0;
              return (
                <View key={l} style={s.row} testID={`compare-row-${l}`}>
                  <View style={s.cellBox}><Text style={[s.cell, aWins && s.win]}>{va ?? "—"}</Text>{aWins ? <Text style={s.diff}>▲ {+diff.toFixed(2)}</Text> : null}</View>
                  <View style={s.mid}>
                    <Icon name={statIcon(l)} size={14} color={colors.muted} />
                    <Text style={s.label} numberOfLines={2}>{l}</Text>
                  </View>
                  <View style={[s.cellBox, { alignItems: "flex-end" }]}><Text style={[s.cell, s.right, bWins && s.win]}>{vb ?? "—"}</Text>{bWins ? <Text style={s.diff}>▲ {+diff.toFixed(2)}</Text> : null}</View>
                </View>
              );
            })}
          </View>
        ) : null}
        {A && B ? (
          <View style={s.feats}>
            {[A, B].map((it) => (
              <Pressable key={it.slug} onPress={() => router.push({ pathname: "/item/[category]/[slug]", params: { category: "weapons", slug: it.slug } })} style={s.featCol} testID={`compare-features-${it.slug}`}>
                <Text style={s.featTitle} numberOfLines={1}>{it.title}</Text>
                {it.features.slice(0, 5).map((f, i) => <Text key={i} style={s.featText}>◆ {f}</Text>)}
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <ItemPicker spec={spec} onClose={() => setPick(null)} onPick={(i: ItemCard | null) => { if (pick === "a") setA(i?.slug ?? ""); else setB(i?.slug ?? ""); setPick(null); }} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  heads: { flexDirection: "row", gap: spacing.md },
  head: { flex: 1, alignItems: "center", gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, minHeight: 170, justifyContent: "center" },
  img: { width: "100%", height: 80 },
  name: { color: c.onSurface, fontFamily: fonts.display, fontSize: 18, textAlign: "center" },
  meta: { fontFamily: fonts.text, fontSize: 11 },
  swap: { alignSelf: "center", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.borderStrong, marginTop: -spacing.md },
  table: { backgroundColor: c.surfaceInverse, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 40, borderBottomWidth: 1, borderBottomColor: c.parchmentLine },
  cell: { flex: 1, color: c.onSurfaceInverse, fontFamily: fonts.text, fontSize: 13 },
  right: { textAlign: "right" },
  cellBox: { flex: 1 },
  diff: { color: c.success, fontFamily: fonts.text, fontSize: 10 },
  win: { color: c.success, fontFamily: fonts.text },
  mid: { flex: 1.1, alignItems: "center", gap: 2 },
  label: { color: c.parchmentMuted, fontFamily: fonts.text, fontSize: 11, textAlign: "center" },
  feats: { flexDirection: "row", gap: spacing.md },
  featCol: { flex: 1, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  featTitle: { color: c.goldLight, fontFamily: fonts.display, fontSize: 16 },
  featText: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 11, lineHeight: 16 },
}));
