import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ItemCard, imgUrl } from "@/src/api";
import { fonts, makeStyles, rarityColor, useTheme, spacing, radius } from "@/src/theme";
import { CATEGORY_ICON, Icon } from "./Icon";

export function ItemTile({ item }: { item: ItemCard }) {
  const { colors } = useTheme();
  const s = useStyles();
  const rc = rarityColor(colors, item.rarity);
  return (
    <Pressable
      testID={`item-tile-${item.slug}`}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        router.push({ pathname: "/item/[category]/[slug]", params: { category: item.category, slug: item.slug } });
      }}
      style={({ pressed }) => [s.card, { borderColor: rc }, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <LinearGradient colors={[colors.surfaceTertiary, colors.surface]} style={s.imgWrap}>
        <View style={[s.glow, { backgroundColor: colors.glowSoft }]} />
        {item.image ? (
          <Image source={{ uri: imgUrl(item.image) }} style={s.img} contentFit="contain" transition={200} />
        ) : (
          <Icon name={CATEGORY_ICON[item.category]} size={42} color={rc} />
        )}
      </LinearGradient>
      <View style={[s.rarityBar, { backgroundColor: rc }]} />
      <View style={s.body}>
        <Text numberOfLines={2} style={s.title}>{item.title}</Text>
        <Text numberOfLines={1} style={[s.meta, { color: rc }]}>
          {[item.rarity, item.subtype].filter(Boolean).join(" · ") || "—"}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  imgWrap: { height: 110, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 90, height: 90, borderRadius: 45 },
  img: { width: "88%", height: "84%" },
  rarityBar: { height: 2, opacity: 0.9 },
  body: { padding: spacing.md, gap: spacing.xs, minHeight: 72 },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 17, lineHeight: 20 },
  meta: { fontFamily: fonts.text, fontSize: 11, letterSpacing: 0.5 },
}));
