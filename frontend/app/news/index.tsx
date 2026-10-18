import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { get, NewsItem } from "@/src/api";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { ChipRow } from "@/src/components/Chip";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Empty, ErrorState, Loading } from "@/src/components/States";

export default function NewsList() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const [filter, setFilter] = useState("all");
  const q = useQuery({ queryKey: ["news-all"], queryFn: () => get<NewsItem[]>("/news?limit=40") });
  const data = (q.data ?? []).filter((n) => filter === "all" || n.is_patch);

  return (
    <View style={s.root} testID="news-screen">
      <ScreenHeader back title={t("news")} subtitle="Steam · Once Human" />
      <ChipRow testPrefix="news-filter" value={filter} onChange={setFilter} options={[{ value: "all", label: t("all") }, { value: "patch", label: "Patch / Update" }]} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} testID="news-error" /> : (
        <FlatList
          data={data}
          keyExtractor={(n) => n.gid}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl tintColor={colors.brandPrimary} refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
          ListEmptyComponent={<Empty text={t("awaiting")} />}
          renderItem={({ item }) => (
            <Pressable testID={`news-item-${item.gid}`} onPress={() => router.push({ pathname: "/news/[gid]", params: { gid: item.gid } })} style={s.card}>
              {item.image ? <Image source={{ uri: item.image }} style={s.img} contentFit="cover" /> : null}
              <View style={s.body}>
                <Text style={s.date}>
                  {item.is_patch ? "PATCH · " : ""}{new Date(item.date).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US", { day: "numeric", month: "long", year: "numeric" })}
                </Text>
                <Text style={s.title}>{item.title}</Text>
                <Text style={s.excerpt} numberOfLines={3}>{item.excerpt}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: c.border },
  img: { width: "100%", height: 150 },
  body: { padding: spacing.lg, gap: spacing.xs },
  date: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 1 },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 21, lineHeight: 25 },
  excerpt: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
}));
