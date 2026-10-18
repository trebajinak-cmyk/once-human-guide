import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";

import { Build } from "@/src/builds";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "./Icon";

export function BuildAiDetails({ ai }: { ai: NonNullable<Build["ai"]> }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const s = useStyles();
  const list = (title: string, items?: string[]) =>
    items?.length ? (
      <View style={{ gap: spacing.xs }}>
        <Text style={s.label}>{title}</Text>
        {items.map((x, i) => (
          <View key={i} style={s.row}><Text style={s.dot}>◆</Text><Text style={s.text}>{x}</Text></View>
        ))}
      </View>
    ) : null;
  return (
    <View style={s.box} testID="build-ai-details">
      {ai.summary ? <Text style={s.summary}>{ai.summary}</Text> : null}
      {ai.playstyle ? <Text style={s.text}>{ai.playstyle}</Text> : null}
      {ai.calibration ? (<View style={{ gap: spacing.xs }}><Text style={s.label}>{t("calibration")}</Text><Text style={s.text}>{ai.calibration}</Text></View>) : null}
      {list(t("substats"), ai.substats)}
      {list(t("rotation"), ai.rotation)}
      {list(t("tips"), ai.tips)}
      {ai.creator_refs?.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={s.label}>{t("creatorVideos")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {ai.creator_refs.map((v) => (
              <Pressable key={v.video_id} testID={`creator-video-${v.video_id}`} onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${v.video_id}`)} style={s.vcard}>
                <Image source={{ uri: v.thumbnail }} style={s.vthumb} contentFit="cover" />
                <View style={{ padding: spacing.sm, gap: 2 }}>
                  <Text style={s.vch}><Icon name="youtube" size={12} color={colors.brandSecondary} /> {v.channel}</Text>
                  <Text style={s.vtitle} numberOfLines={2}>{v.title}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: c.borderStrong },
  summary: { color: c.onSurface, fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  label: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: spacing.sm },
  dot: { color: c.goldDeep, fontSize: 10, marginTop: 5 },
  text: { flex: 1, color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  vcard: { width: 200, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  vthumb: { width: 200, height: 112 },
  vch: { color: c.goldLight, fontFamily: fonts.text, fontSize: 11 },
  vtitle: { color: c.onSurface, fontFamily: fonts.text, fontSize: 12, lineHeight: 16 },
}));
