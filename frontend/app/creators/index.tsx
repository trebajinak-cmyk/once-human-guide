import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { get } from "@/src/api";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { ChipRow } from "@/src/components/Chip";
import { Icon } from "@/src/components/Icon";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Empty, ErrorState, Loading } from "@/src/components/States";

export type CreatorVideo = {
  video_id: string; title: string; channel: string; published: string; duration: string; thumbnail: string;
  status: string; summary?: string; topics?: string[];
};
type Status = { has_gemini_key: boolean; paused_until?: string; last_error?: string; last_scan?: string; channels: Record<string, { once_human_videos: number; analyzed: number; pending: number; failed: number }> };

export default function Creators() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();
  const s = useStyles();
  const [channel, setChannel] = useState("");
  const [q, setQ] = useState("");
  const [onlyAnalyzed, setOnlyAnalyzed] = useState(false);
  const status = useQuery({ queryKey: ["creators-status"], queryFn: () => get<Status>("/creators/status"), refetchInterval: 30000 });
  const list = useInfiniteQuery({
    queryKey: ["creators-videos", channel, q, onlyAnalyzed],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => get<{ total: number; items: CreatorVideo[] }>(`/creators/videos?limit=30&skip=${pageParam}${channel ? `&channel=${channel}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}${onlyAnalyzed ? "&analyzed=true" : ""}`),
    getNextPageParam: (last, all) => { const n = all.reduce((a, p) => a + p.items.length, 0); return n < last.total ? n : undefined; },
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const st = status.data;
  const totals = st ? Object.values(st.channels).reduce((a, c) => ({ all: a.all + c.once_human_videos, done: a.done + c.analyzed }), { all: 0, done: 0 }) : null;

  return (
    <View style={s.root} testID="creators-screen">
      <ScreenHeader back title={t("creatorsKb")} subtitle="Anestic × Doomeris" />
      <View style={s.statusBox} testID="creators-status">
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.statusTitle}>{totals ? `${totals.done} / ${totals.all}` : "…"} {t("analyzedVideos")}</Text>
          <View style={s.bar}><View style={[s.barFill, { width: totals && totals.all ? `${(100 * totals.done) / totals.all}%` : "0%" }]} /></View>
          <Text style={s.statusSub}>
            {!st ? "" : !st.has_gemini_key ? t("noGeminiKey") : st.paused_until && new Date(st.paused_until) > new Date() ? t("kbPaused") : t("kbRunning")}
          </Text>
        </View>
        <Icon name={st?.has_gemini_key ? "brain" : "key-alert-outline"} size={28} color={st?.has_gemini_key ? colors.success : colors.warning} />
      </View>
      <View style={s.search}>
        <Icon name="magnify" size={18} color={colors.muted} />
        <TextInput testID="creators-search-input" value={q} onChangeText={setQ} placeholder={t("kbSearch")} placeholderTextColor={colors.muted} style={s.input} autoCorrect={false} />
      </View>
      <ChipRow testPrefix="creators-filter" value={`${channel}|${onlyAnalyzed ? "a" : ""}`}
        onChange={(v) => { const [c, a] = v.split("|"); setChannel(c); setOnlyAnalyzed(a === "a"); }}
        options={[
          { value: "|", label: t("all") },
          { value: "Anestic|", label: "Anestic" },
          { value: "Doomeris|", label: "Doomeris" },
          { value: "|a", label: t("onlyAnalyzed") },
        ]} />
      {list.isLoading ? <Loading /> : list.isError ? <ErrorState onRetry={() => list.refetch()} testID="creators-error" /> : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.video_id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl tintColor={colors.brandPrimary} refreshing={list.isRefetching} onRefresh={() => { list.refetch(); status.refetch(); }} />}
          ListEmptyComponent={<Empty text={t("noResults")} />}
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <Pressable testID={`creator-video-row-${item.video_id}`} onPress={() => router.push({ pathname: "/creators/[id]", params: { id: item.video_id } })} style={s.row}>
              <View>
                <Image source={{ uri: item.thumbnail }} style={s.thumb} contentFit="cover" />
                {item.duration ? <Text style={s.dur}>{item.duration}</Text> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.ch}>{item.channel} · {item.published}</Text>
                <Text style={s.title} numberOfLines={2}>{item.title}</Text>
                <View style={s.badgeRow}>
                  <Icon name={item.status === "analyzed" ? "check-decagram" : item.status === "failed" ? "alert-circle-outline" : "timer-sand"} size={13}
                    color={item.status === "analyzed" ? colors.success : item.status === "failed" ? colors.error : colors.muted} />
                  <Text style={s.badge}>{item.status === "analyzed" ? t("analyzedBadge") : item.status === "failed" ? "—" : t("queuedBadge")}</Text>
                </View>
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
  statusBox: { flexDirection: "row", alignItems: "center", gap: spacing.md, margin: spacing.lg, marginBottom: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.borderStrong },
  statusTitle: { color: c.goldLight, fontFamily: fonts.display, fontSize: 20 },
  statusSub: { color: c.onBrandTertiary, fontFamily: fonts.text, fontSize: 11 },
  bar: { height: 6, borderRadius: 3, backgroundColor: c.surface, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: c.brandPrimary },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, height: 44 },
  input: { flex: 1, color: c.onSurface, fontFamily: fonts.text, fontSize: 14, height: 44 },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: { width: 128, height: 72, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary },
  dur: { position: "absolute", right: 4, bottom: 4, color: c.onSurface, backgroundColor: c.scrim, fontFamily: fonts.text, fontSize: 10, paddingHorizontal: 4, borderRadius: 3 },
  ch: { color: c.goldLight, fontFamily: fonts.text, fontSize: 10 },
  title: { color: c.onSurface, fontFamily: fonts.text, fontSize: 13, lineHeight: 17 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  badge: { color: c.muted, fontFamily: fonts.text, fontSize: 10 },
}));
