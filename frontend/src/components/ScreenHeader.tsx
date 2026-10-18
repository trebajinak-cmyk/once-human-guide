import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, useTheme, spacing } from "@/src/theme";
import { Icon } from "./Icon";

export function ScreenHeader({ title, subtitle, back, right, testID }: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + spacing.sm }]} testID={testID}>
      {back ? (
        <Pressable testID="header-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.iconBtn} hitSlop={8}>
          <Icon name="chevron-left" size={28} color={colors.brandPrimary} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -spacing.sm },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 28 },
  sub: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
}));
