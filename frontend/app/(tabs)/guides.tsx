import { Pressable, SectionList, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { get, Guide } from "@/src/api";
import { useLang } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon, IconName } from "@/src/components/Icon";
import { ErrorState, Loading } from "@/src/components/States";

type Resp = { groups: Record<string, { cs: string; en: string }>; guides: Guide[] };

export default function Guides() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const q = useQuery({ queryKey: ["guides"], queryFn: () => get<Resp>("/guides") });
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const sections = q.data
    ? Object.entries(q.data.groups).map(([k, v]) => ({ key: k, title: v[lang], data: q.data!.guides.filter((g) => g.group === k) }))
    : [];

  return (
    <View style={s.root} testID="guides-screen">
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>{t("tutorialsTitle")}</Text>
        <Text style={s.sub}>{t("tutorialsSub")}</Text>
      </View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} testID="guides-error" /> : (
        <SectionList
          sections={sections}
          keyExtractor={(g) => g.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md }}
          renderSectionHeader={({ section }) => <Text style={s.group}>{section.title}</Text>}
          renderItem={({ item }) => (
            <Pressable
              testID={`guide-card-${item.id}`}
              onPress={() => router.push({ pathname: "/guide/[id]", params: { id: item.id } })}
              style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
            >
              <View style={s.iconBox}>
                <Icon name={item.icon as IconName} size={26} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={s.cardTitle}>{item.title[lang]}</Text>
                <Text style={s.cardSub} numberOfLines={2}>{item.summary[lang]}</Text>
                <View style={s.tags}>
                  <Icon name="youtube" size={14} color={colors.brandSecondary} />
                  <Text style={s.tag}>Video</Text>
                  {item.wiki.length ? (<><Icon name="check-decagram" size={14} color={colors.success} /><Text style={s.tag}>Wiki</Text></>) : null}
                </View>
              </View>
              <Icon name="chevron-right" size={22} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 32 },
  sub: { color: c.muted, fontFamily: fonts.text, fontSize: 13 },
  group: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.xs },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  iconBox: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderStrong },
  cardTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 20 },
  cardSub: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13, lineHeight: 18 },
  tags: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  tag: { color: c.muted, fontFamily: fonts.text, fontSize: 11, marginRight: spacing.sm },
}));
