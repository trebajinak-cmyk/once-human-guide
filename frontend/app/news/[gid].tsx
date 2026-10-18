import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { get, NewsItem } from "@/src/api";
import { useLang, useTranslated } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ErrorState, Loading } from "@/src/components/States";

type Block = NonNullable<NewsItem["blocks"]>[number];

export default function NewsDetail() {
  const { gid } = useLocalSearchParams<{ gid: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const q = useQuery({ queryKey: ["news", gid], queryFn: () => get<NewsItem>(`/news/${gid}`) });
  const [wantTr, setWantTr] = useState(false);
  const textBlocks = q.data?.blocks?.filter((b) => b.type !== "img").slice(0, 120).map((b) => b.value);
  const tr = useTranslated<string[]>(`news:${gid}`, textBlocks, wantTr);

  const n = q.data;
  let ti = 0;
  return (
    <View style={s.root} testID="news-detail-screen">
      <ScreenHeader back title={t("news")} subtitle={n ? new Date(n.date).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US") : ""} />
      {q.isLoading ? <Loading /> : q.isError || !n ? <ErrorState onRetry={() => q.refetch()} testID="news-detail-error" /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
          <Text style={s.title} testID="news-detail-title">{n.title}</Text>
          <View style={s.row}>
            {lang === "cs" ? (
              <Pressable testID="news-translate-button" onPress={() => setWantTr(!wantTr)} style={s.trBtn}>
                <Icon name="translate" size={16} color={colors.onBrandTertiary} />
                <Text style={s.trText}>{tr.translating ? t("translating") : wantTr ? t("original") : t("translate")}</Text>
              </Pressable>
            ) : null}
            <Pressable testID="news-open-steam" onPress={() => Linking.openURL(n.url)} style={s.trBtn}>
              <Icon name="steam" size={16} color={colors.onBrandTertiary} />
              <Text style={s.trText}>Steam</Text>
            </Pressable>
          </View>
          {(n.blocks ?? []).map((b: Block, i) => {
            if (b.type === "img") return <Image key={i} source={{ uri: b.value }} style={s.img} contentFit="contain" />;
            const val = tr.data?.[ti] ?? b.value;
            ti += 1;
            if (b.type === "h") return <Text key={i} style={s.h}>{val}</Text>;
            return <Text key={i} style={s.p}>{val}</Text>;
          })}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  trBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 40 },
  trText: { color: c.onBrandTertiary, fontFamily: fonts.text, fontSize: 12 },
  img: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary },
  h: { color: c.goldLight, fontFamily: fonts.display, fontSize: 22, marginTop: spacing.sm },
  p: { color: c.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
}));
