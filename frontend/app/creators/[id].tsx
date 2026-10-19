import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { get } from "@/src/api";
import { useLang, useTranslated } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ErrorState, Loading } from "@/src/components/States";
import { YouTubePlayer } from "@/src/components/YouTubePlayer";

type Analysis = {
  summary?: string; game_context?: string; topics?: string[];
  builds?: { name?: string; keyword?: string; weapon?: string; weapon_mod?: string; armor?: Record<string, string>; armor_mods?: Record<string, string>; calibration?: string; substats?: string[]; accessories?: string[]; deviation?: string; cradle_or_overrides?: string[]; rotation?: string[]; variants?: string[]; notes?: string }[];
  mechanics?: { name: string; explanation: string }[];
  key_facts?: { t: string; fact: string }[];
  tips?: string[]; opinions?: string[];
};
type Video = { video_id: string; title: string; channel: string; published: string; duration: string; description: string; status: string; analysis?: Analysis | null };

const toSec = (t: string) => t.split(":").reduce((a, x) => a * 60 + (parseInt(x, 10) || 0), 0);

export default function CreatorVideo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const q = useQuery({ queryKey: ["creator-video", id], queryFn: () => get<Video>(`/creators/videos/${id}`) });
  const v = q.data;
  const [wantTr, setWantTr] = useState(false);
  const tr = useTranslated<Analysis>(`creator:${id}:${v?.status}`, v?.analysis ?? undefined, wantTr);
  const a = tr.data;

  const open = (sec?: number) => Linking.openURL(`https://www.youtube.com/watch?v=${id}${sec ? `&t=${sec}s` : ""}`);
  const list = (title: string, items?: string[]) => items?.length ? (
    <View style={s.card}>
      <Text style={s.label}>{title}</Text>
      {items.map((x, i) => <Text key={i} style={s.text}>◆ {x}</Text>)}
    </View>
  ) : null;

  return (
    <View style={s.root} testID="creator-video-screen">
      <ScreenHeader back title={v?.channel ?? ""} subtitle={v ? `${v.published} · ${v.duration}` : ""} />
      {q.isLoading ? <Loading /> : q.isError || !v ? <ErrorState onRetry={() => q.refetch()} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
          <YouTubePlayer videoId={v.video_id} openLabel={t("openYoutube")} />
          <Text style={s.title} testID="creator-video-title">{v.title}</Text>
          <View style={s.row}>
            {a && lang === "cs" ? (
              <Pressable testID="creator-translate-button" onPress={() => setWantTr(!wantTr)} style={s.pill}>
                <Icon name="translate" size={16} color={colors.onBrandTertiary} />
                <Text style={s.pillText}>{tr.translating ? t("translating") : wantTr ? t("original") : t("translate")}</Text>
              </Pressable>
            ) : null}
            <Pressable testID="creator-ask-ai" onPress={() => router.push({ pathname: "/assistant", params: { q: lang === "cs" ? `Shrň mi poznatky z videa „${v.title}“ od ${v.channel} a jak je použít.` : `Summarize the learnings from "${v.title}" by ${v.channel} and how to apply them.` } })} style={[s.pill, s.pillGold]}>
              <Icon name="creation" size={16} color={colors.onBrandPrimary} />
              <Text style={[s.pillText, { color: colors.onBrandPrimary }]}>{t("askAi")}</Text>
            </Pressable>
          </View>

          {!a ? (
            <View style={s.card} testID="creator-not-analyzed">
              <Text style={s.label}>{t("queuedBadge")}</Text>
              <Text style={s.text}>{t("notAnalyzedYet")}</Text>
            </View>
          ) : (
            <>
              {a.summary ? <View style={s.card}><Text style={s.label}>{t("summary")}</Text><Text style={s.text}>{a.summary}</Text>{a.game_context ? <Text style={s.ctx}>{a.game_context}</Text> : null}</View> : null}
              {a.builds?.map((b, i) => (
                <View key={i} style={[s.card, s.buildCard]} testID={`creator-build-${i}`}>
                  <Text style={s.label}>Build</Text>
                  <Text style={s.buildName}>{b.name || b.weapon}</Text>
                  {b.keyword ? <Text style={s.ctx}>{b.keyword}</Text> : null}
                  {[["Weapon", b.weapon], ["Weapon mod", b.weapon_mod], ["Deviation", b.deviation], ["Calibration", b.calibration]].filter(([, x]) => x).map(([k, x]) => (
                    <Text key={k} style={s.text}><Text style={s.k}>{k}: </Text>{x}</Text>
                  ))}
                  {Object.entries(b.armor ?? {}).filter(([, x]) => x).map(([k, x]) => (
                    <Text key={k} style={s.text}><Text style={s.k}>{k}: </Text>{x}{b.armor_mods?.[k] ? `  [${b.armor_mods[k]}]` : ""}</Text>
                  ))}
                  {[["Substats", b.substats], ["Accessories", b.accessories], ["Cradle", b.cradle_or_overrides], ["Rotation", b.rotation], ["Variants", b.variants]].map(([k, xs]) =>
                    (xs as string[] | undefined)?.length ? <Text key={k as string} style={s.text}><Text style={s.k}>{k as string}: </Text>{(xs as string[]).join(" · ")}</Text> : null)}
                  {b.notes ? <Text style={s.text}>{b.notes}</Text> : null}
                </View>
              ))}
              {a.mechanics?.length ? (
                <View style={s.card}>
                  <Text style={s.label}>{t("mechanicsT")}</Text>
                  {a.mechanics.map((m, i) => <View key={i} style={{ gap: 2 }}><Text style={s.k}>{m.name}</Text><Text style={s.text}>{m.explanation}</Text></View>)}
                </View>
              ) : null}
              {a.key_facts?.length ? (
                <View style={s.card}>
                  <Text style={s.label}>{t("keyFacts")}</Text>
                  {a.key_facts.map((f, i) => (
                    <Pressable key={i} onPress={() => open(toSec(f.t))} style={s.fact} testID={`creator-fact-${i}`}>
                      <Text style={s.time}>{f.t}</Text>
                      <Text style={[s.text, { flex: 1 }]}>{f.fact}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {list(t("tips"), a.tips)}
              {list(t("opinionsT"), a.opinions)}
            </>
          )}
          {v.description ? (
            <View style={s.card}>
              <Text style={s.label}>{t("descriptionT")}</Text>
              <Text style={s.desc}>{v.description}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: c.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 40 },
  pillGold: { backgroundColor: c.brandPrimary },
  pillText: { color: c.onBrandTertiary, fontFamily: fonts.text, fontSize: 12 },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: c.border },
  buildCard: { borderColor: c.borderStrong },
  buildName: { color: c.goldLight, fontFamily: fonts.display, fontSize: 22 },
  label: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  text: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  k: { color: c.onSurface, fontFamily: fonts.text, fontSize: 13 },
  ctx: { color: c.goldLight, fontFamily: fonts.text, fontSize: 12 },
  fact: { flexDirection: "row", gap: spacing.md, minHeight: 32 },
  time: { color: c.brandSecondary, fontFamily: "SpaceMono", fontSize: 12, width: 52, marginTop: 2 },
  desc: { color: c.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 17 },
}));
