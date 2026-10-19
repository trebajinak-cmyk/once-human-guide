import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { get, GuideDetail, Section } from "@/src/api";
import { useLang, useTranslated } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ErrorState, Loading } from "@/src/components/States";
import { YouTubePlayer } from "@/src/components/YouTubePlayer";

export default function GuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const q = useQuery({ queryKey: ["guide", id], queryFn: () => get<GuideDetail>(`/guides/${id}`) });
  const [vid, setVid] = useState<string | null>(null);
  useEffect(() => {
    if (q.data?.videos?.length && !vid) setVid(q.data.videos[0].video_id);
  }, [q.data, vid]);

  const g = q.data;
  return (
    <View style={s.root} testID="guide-detail-screen">
      <ScreenHeader back title={g ? g.title[lang] : ""} subtitle={g?.summary[lang]} />
      {q.isLoading ? <Loading /> : q.isError || !g ? <ErrorState onRetry={() => q.refetch()} testID="guide-error" /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
          <Text style={s.label}>{t("videos")}</Text>
          {vid ? <YouTubePlayer videoId={vid} openLabel={t("openYoutube")} /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {g.videos.map((v) => (
              <Pressable
                key={v.video_id}
                testID={`video-option-${v.video_id}`}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); setVid(v.video_id); }}
                style={[s.vcard, vid === v.video_id && { borderColor: colors.brandPrimary }]}
              >
                <Image source={{ uri: v.thumbnail }} style={s.vthumb} contentFit="cover" />
                {v.duration ? <Text style={s.dur}>{v.duration}</Text> : null}
                <View style={{ padding: spacing.sm, gap: 2 }}>
                  <Text numberOfLines={2} style={s.vtitle}>{v.title}</Text>
                  <Text numberOfLines={1} style={s.vmeta}>{[v.channel, v.views, v.published].filter(Boolean).join(" · ")}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          {vid ? (
            <Pressable testID="guide-open-youtube" onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${vid}`)} style={s.ytLink}>
              <Icon name="youtube" size={18} color={colors.brandSecondary} />
              <Text style={s.ytText}>{t("openYoutube")}</Text>
            </Pressable>
          ) : null}

          {g.articles.map((a) => <Article key={a.title} gid={g.id} article={a} />)}
          <CreatorsSay q={g.yt.replace(/^Once Human\s*/i, "").replace(/\b(guide|build|tips|explained|best)\b/gi, "").trim() || g.title.en} />
        </ScrollView>
      )}
    </View>
  );
}

function Article({ gid, article }: { gid: string; article: GuideDetail["articles"][number] }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const [wantTr, setWantTr] = useState(false);
  const tr = useTranslated<Section[]>(`guide:${gid}:${article.title}:${article.wiki_updated}`, article.sections.slice(0, 12), wantTr);
  const secs = tr.data ?? [];
  return (
    <View style={s.article} testID={`guide-article-${article.title}`}>
      <View style={s.artHead}>
        <Icon name="check-decagram" size={16} color={colors.success} />
        <Text style={s.label}>{t("wikiArticle")}</Text>
      </View>
      <Text style={s.artTitle}>{article.title}</Text>
      {lang === "cs" ? (
        <Pressable testID="guide-translate-button" onPress={() => setWantTr(!wantTr)} style={s.trBtn}>
          <Icon name="translate" size={16} color={colors.onBrandTertiary} />
          <Text style={s.trText}>{tr.translating ? t("translating") : wantTr ? t("original") : t("translate")}</Text>
        </Pressable>
      ) : null}
      {secs.map((sec, i) => (
        <View key={i} style={{ gap: spacing.xs }}>
          <Text style={s.secTitle}>{sec.title}</Text>
          <Text style={s.secText}>{sec.text}</Text>
        </View>
      ))}
      <Pressable testID="guide-open-wiki" onPress={() => Linking.openURL(article.wiki_url)} style={s.ytLink}>
        <Icon name="open-in-new" size={16} color={colors.brandPrimary} />
        <Text style={s.wikiText}>{t("openWiki")}</Text>
      </Pressable>
    </View>
  );
}

function CreatorsSay({ q }: { q: string }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const s = useStyles();
  const r = useQuery({
    queryKey: ["creators-search", q],
    queryFn: () => get<{ video: string; channel: string; title: string; published: string; analysis: { summary?: string } | null; description: string }[]>(`/creators/search?q=${encodeURIComponent(q)}&limit=4`),
  });
  if (!r.data?.length) return null;
  return (
    <View style={s.article} testID="guide-creators-say">
      <View style={s.artHead}>
        <Icon name="youtube" size={16} color={colors.brandSecondary} />
        <Text style={s.label}>{t("creatorsSay")}</Text>
      </View>
      {r.data.map((v) => {
        const id = v.video.split("v=")[1];
        return (
          <Pressable key={v.video} testID={`guide-creator-${id}`} onPress={() => router.push({ pathname: "/creators/[id]", params: { id } })} style={{ gap: 2 }}>
            <Text style={s.secTitle}>{v.title}</Text>
            <Text style={s.vmeta}>{v.channel} · {v.published}{v.analysis ? " · AI ✓" : ""}</Text>
            <Text style={s.secText} numberOfLines={4}>{v.analysis?.summary || v.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  label: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  vcard: { width: 200, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  vthumb: { width: 200, height: 112 },
  dur: { position: "absolute", top: 88, right: spacing.sm, color: c.onSurface, backgroundColor: c.scrim, fontFamily: fonts.text, fontSize: 11, paddingHorizontal: spacing.xs, borderRadius: 4 },
  vtitle: { color: c.onSurface, fontFamily: fonts.text, fontSize: 12, lineHeight: 16 },
  vmeta: { color: c.muted, fontFamily: fonts.text, fontSize: 10 },
  ytLink: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  ytText: { color: c.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13 },
  wikiText: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 13 },
  article: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, padding: spacing.lg, gap: spacing.md },
  artHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  artTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 26 },
  trBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", backgroundColor: c.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 36 },
  trText: { color: c.onBrandTertiary, fontFamily: fonts.text, fontSize: 12 },
  secTitle: { color: c.goldLight, fontFamily: fonts.display, fontSize: 19 },
  secText: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
}));
