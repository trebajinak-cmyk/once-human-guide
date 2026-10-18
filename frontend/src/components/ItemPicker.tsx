import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Category, get, imgUrl, ItemCard } from "@/src/api";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, rarityColor, useTheme, spacing, radius } from "@/src/theme";
import { CATEGORY_ICON, Icon } from "./Icon";
import { Loading } from "./States";

export type PickerSpec = { title: string; category: Category; filter?: (i: ItemCard) => boolean } | null;

export function ItemPicker({ spec, onClose, onPick }: { spec: PickerSpec; onClose: () => void; onPick: (i: ItemCard | null) => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();
  const s = useStyles();
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["items", spec?.category],
    queryFn: () => get<ItemCard[]>(`/items?category=${spec!.category}`),
    enabled: !!spec,
  });
  const data = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (query.data ?? []).filter((i) => (!spec?.filter || spec.filter(i)) && (!ql || i.title.toLowerCase().includes(ql)));
  }, [query.data, spec, q]);

  return (
    <Modal visible={!!spec} animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.md }]} testID="item-picker">
          <View style={s.head}>
            <Text style={s.title}>{spec?.title}</Text>
            <Pressable testID="item-picker-close" onPress={onClose} style={s.close} hitSlop={8}>
              <Icon name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={s.search}>
            <Icon name="magnify" size={18} color={colors.muted} />
            <TextInput testID="item-picker-search" value={q} onChangeText={setQ} placeholder={t("search")} placeholderTextColor={colors.muted} style={s.input} autoCorrect={false} />
          </View>
          {query.isLoading ? <Loading /> : (
            <FlatList
              data={data}
              keyExtractor={(i) => i.slug}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg }}
              ListHeaderComponent={
                <Pressable testID="item-picker-clear" onPress={() => onPick(null)} style={s.row}>
                  <Icon name="cancel" size={22} color={colors.muted} />
                  <Text style={s.rowTitle}>—</Text>
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable testID={`pick-${item.slug}`} onPress={() => onPick(item)} style={[s.row, { borderColor: rarityColor(colors, item.rarity) }]}>
                  {item.image ? <Image source={{ uri: imgUrl(item.image) }} style={s.img} contentFit="contain" /> : <Icon name={CATEGORY_ICON[item.category]} size={26} color={colors.brandPrimary} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={[s.rowMeta, { color: rarityColor(colors, item.rarity) }]}>{[item.rarity, item.subtype].filter(Boolean).join(" · ")}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: "flex-end" },
  sheet: { height: "85%", backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: 1, borderColor: c.borderStrong },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { flex: 1, color: c.onSurface, fontFamily: fonts.display, fontSize: 26 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, height: 44 },
  input: { flex: 1, color: c.onSurface, fontFamily: fonts.text, fontSize: 15, height: 44 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, minHeight: 56 },
  img: { width: 56, height: 40 },
  rowTitle: { color: c.onSurface, fontFamily: fonts.text, fontSize: 14 },
  rowMeta: { fontFamily: fonts.text, fontSize: 11 },
}));
