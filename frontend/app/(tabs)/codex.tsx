import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, TextInput, View, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Category, get, ItemCard } from "@/src/api";
import { useLang } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { ChipRow } from "@/src/components/Chip";
import { Icon } from "@/src/components/Icon";
import { ItemTile } from "@/src/components/ItemTile";
import { Empty, ErrorState, Loading } from "@/src/components/States";

const CATS: Category[] = ["weapons", "armor", "deviations", "weapon_mods", "armor_mods"];

export default function Codex() {
  const params = useLocalSearchParams<{ category?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();
  const s = useStyles();
  const [category, setCategory] = useState<Category>("weapons");
  const [rarity, setRarity] = useState("");
  const [sub, setSub] = useState("");
  const [q, setQ] = useState("");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  useEffect(() => {
    if (params.category && CATS.includes(params.category as Category)) {
      setCategory(params.category as Category);
      setSub("");
    }
  }, [params.category]);

  const query = useQuery({
    queryKey: ["items", category],
    queryFn: () => get<ItemCard[]>(`/items?category=${category}`),
  });

  const subtypes = useMemo(() => {
    const set = new Set((query.data ?? []).map((i) => i.subtype).filter(Boolean));
    return Array.from(set).sort();
  }, [query.data]);

  const data = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (query.data ?? []).filter(
      (i) => (!rarity || i.rarity === rarity) && (!sub || i.subtype === sub) && (!ql || i.title.toLowerCase().includes(ql) || i.subtype?.toLowerCase().includes(ql)),
    );
  }, [query.data, rarity, sub, q]);

  return (
    <View style={s.root} testID="codex-screen">
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={s.titleRow}>
          <Text style={s.title}>Codex</Text>
          <Text style={s.count} testID="codex-count">{data.length} {t("items")}</Text>
        </View>
        <View style={s.search}>
          <Icon name="magnify" size={20} color={colors.muted} />
          <TextInput
            testID="codex-search-input"
            value={q}
            onChangeText={setQ}
            placeholder={t("search")}
            placeholderTextColor={colors.muted}
            style={s.input}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q ? (
            <Pressable testID="codex-search-clear" onPress={() => setQ("")} hitSlop={8}>
              <Icon name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ChipRow
        testPrefix="category-chip"
        value={category}
        onChange={(v) => { setCategory(v as Category); setSub(""); }}
        options={CATS.map((c) => ({ value: c, label: t(c) }))}
      />
      <ChipRow
        testPrefix="filter-chip"
        value={rarity || sub ? `${rarity}|${sub}` : ""}
        onChange={(v) => {
          if (!v) { setRarity(""); setSub(""); return; }
          const [r, st] = v.split("|");
          setRarity(r); setSub(st);
        }}
        options={[
          { value: "", label: t("all") },
          { value: "Legendary|", label: "Legendary", color: colors.rarityLegendary },
          { value: "Epic|", label: "Epic", color: colors.rarityEpic },
          { value: "Rare|", label: "Rare", color: colors.rarityRare },
          ...subtypes.map((st) => ({ value: `|${st}`, label: st })),
        ]}
      />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} testID="codex-error" />
      ) : (
        <FlatList
          testID="codex-list"
          data={data}
          keyExtractor={(i) => i.slug}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: bottomChrome + spacing.xl }}
          renderItem={({ item }) => <ItemTile item={item} />}
          ListEmptyComponent={<Empty text={t("noResults")} testID="codex-empty" />}
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl tintColor={colors.brandPrimary} refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          initialNumToRender={10}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 34 },
  count: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, paddingHorizontal: spacing.md, height: 48 },
  input: { flex: 1, color: c.onSurface, fontFamily: fonts.text, fontSize: 15, height: 48 },
}));
