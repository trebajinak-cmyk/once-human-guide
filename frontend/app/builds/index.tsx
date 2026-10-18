import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { imgUrl } from "@/src/api";
import { Build, loadBuilds } from "@/src/builds";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Empty } from "@/src/components/States";

export default function BuildsList() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const [builds, setBuilds] = useState<Build[]>([]);

  useFocusEffect(useCallback(() => { loadBuilds().then(setBuilds); }, []));

  return (
    <View style={s.root} testID="builds-screen">
      <ScreenHeader back title={t("builds")} subtitle={t("buildsSub")} />
      <View style={s.actions}>
        <Pressable testID="builds-new-button" onPress={() => router.push("/builds/edit")} style={[s.action, s.actionGhost]}>
          <Icon name="plus" size={18} color={colors.goldLight} />
          <Text style={s.actionGhostText}>{t("newBuild")}</Text>
        </Pressable>
        <Pressable testID="builds-ai-button" onPress={() => router.push("/builds/ai")} style={s.action}>
          <Icon name="creation" size={18} color={colors.onBrandPrimary} />
          <Text style={s.actionText}>{t("aiBuild")}</Text>
        </Pressable>
      </View>
      <FlatList
        data={builds}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={<Text style={s.label}>{t("myBuilds")}</Text>}
        ListEmptyComponent={<Empty text={t("noBuilds")} icon="hammer-wrench" testID="builds-empty" />}
        renderItem={({ item }) => (
          <Pressable testID={`build-card-${item.id}`} onPress={() => router.push({ pathname: "/builds/edit", params: { id: item.id } })} style={s.card}>
            <View style={s.thumb}>
              {item.weapon?.image ? <Image source={{ uri: imgUrl(item.weapon.image) }} style={s.thumbImg} contentFit="contain" /> : <Icon name="pistol" size={28} color={colors.muted} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.title} numberOfLines={1}>{item.name || item.weapon?.title || t("newBuild")}</Text>
              <Text style={s.meta} numberOfLines={1}>{[item.keyword, item.weapon?.title].filter(Boolean).join(" · ")}</Text>
              <Text style={s.date}>{new Date(item.updated).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US")}{item.ai ? " · AI" : ""}</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.muted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  actions: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  action: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: radius.pill, backgroundColor: c.brandPrimary },
  actionText: { color: c.onBrandPrimary, fontFamily: fonts.text, fontSize: 14 },
  actionGhost: { backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.borderStrong },
  actionGhostText: { color: c.goldLight, fontFamily: fonts.text, fontSize: 14 },
  label: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.borderStrong },
  thumb: { width: 80, height: 56, borderRadius: radius.sm, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  thumbImg: { width: 76, height: 52 },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 20 },
  meta: { color: c.goldLight, fontFamily: fonts.text, fontSize: 12 },
  date: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
}));
