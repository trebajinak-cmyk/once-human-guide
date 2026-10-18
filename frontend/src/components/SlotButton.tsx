import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

import { imgUrl } from "@/src/api";
import { Ref } from "@/src/builds";
import { fonts, makeStyles, rarityColor, useTheme, spacing, radius } from "@/src/theme";
import { Icon, IconName } from "./Icon";

export function SlotButton({ label, value, icon, onPress, testID }: { label: string; value: Ref; icon: IconName; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  const rc = rarityColor(colors, value?.rarity);
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.slot, value && { borderColor: rc }, pressed && { opacity: 0.8 }]}>
      <View style={s.imgBox}>
        {value?.image ? <Image source={{ uri: imgUrl(value.image) }} style={s.img} contentFit="contain" /> : <Icon name={icon} size={22} color={value ? rc : colors.muted} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={[s.value, !value && { color: colors.muted }]} numberOfLines={1}>{value?.title ?? "+"}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  slot: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, minHeight: 56 },
  imgBox: { width: 48, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderRadius: radius.sm },
  img: { width: 46, height: 38 },
  label: { color: c.muted, fontFamily: fonts.text, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  value: { color: c.onSurface, fontFamily: fonts.text, fontSize: 14 },
}));
