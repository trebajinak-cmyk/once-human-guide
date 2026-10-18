import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { get, post, Video } from "@/src/api";
import { Build, newBuild, Ref, saveBuild, Slot, SLOTS } from "@/src/builds";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { ChipRow } from "@/src/components/Chip";
import { Icon } from "@/src/components/Icon";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SlotButton } from "@/src/components/SlotButton";
import { BuildAiDetails } from "@/src/components/BuildAiDetails";

const KEYWORDS = ["", "Shrapnel", "Burn", "Frost Vortex", "Power Surge", "Bounce", "Unstable Bomber", "Fast Gunner", "Fortress Warfare", "Bull's Eye", "Weakspot", "Melee"];

type Gen = Omit<Build, "id" | "notes" | "updated" | "ai"> & NonNullable<Build["ai"]>;

export default function AiBuild() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const [goal, setGoal] = useState("");
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [res, setRes] = useState<Gen | null>(null);
  const creators = useQuery({ queryKey: ["creators"], queryFn: () => get<Video[]>("/builds/creators") });

  const generate = async () => {
    setBusy(true); setErr(false); setRes(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      setRes(await post<Gen>("/builds/generate", { goal, keyword: kw, lang }));
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  const saveAndEdit = async () => {
    if (!res) return;
    const b: Build = {
      ...newBuild(), name: res.name, keyword: res.keyword, weapon: res.weapon, weapon_mod: res.weapon_mod,
      armor: res.armor as Record<Slot, Ref>, armor_mods: res.armor_mods as Record<Slot, Ref>, deviation: res.deviation,
      ai: { summary: res.summary, playstyle: res.playstyle, calibration: res.calibration, substats: res.substats, rotation: res.rotation, tips: res.tips, creator_refs: res.creator_refs },
    };
    await saveBuild(b);
    router.replace({ pathname: "/builds/edit", params: { id: b.id } });
  };

  return (
    <View style={s.root} testID="ai-build-screen">
      <ScreenHeader back title={t("aiBuild")} subtitle="Anestic × Doomeris" />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={s.pad}>
          <Text style={s.note}>{t("creatorsNote")}</Text>
        </View>
        {creators.data?.length ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[s.label, s.pad]}>{t("creatorVideos")} ({creators.data.length})</Text>
            <ChipLikeVideos videos={creators.data} />
          </View>
        ) : creators.isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : null}
        <View style={{ gap: spacing.sm }}>
          <Text style={[s.label, s.pad]}>{t("keyword")}</Text>
          <ChipRow testPrefix="ai-keyword" value={kw} onChange={setKw} options={KEYWORDS.map((k) => ({ value: k, label: k || "Auto" }))} />
        </View>
        <View style={[s.pad, { gap: spacing.md }]}>
          <TextInput testID="ai-goal-input" value={goal} onChangeText={setGoal} placeholder={t("goal")} placeholderTextColor={colors.muted} style={s.input} />
          <Pressable testID="ai-generate-button" onPress={generate} disabled={busy} style={[s.primary, busy && { opacity: 0.7 }]}>
            {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Icon name="creation" size={18} color={colors.onBrandPrimary} />}
            <Text style={s.primaryText}>{t("generate")}</Text>
          </Pressable>
          {busy ? <Text style={s.note} testID="ai-generating">{t("generating")}</Text> : null}
          {err ? <Text style={s.err} testID="ai-generate-error">{t("aiError")}</Text> : null}
        </View>
        {res ? (
          <View style={[s.pad, { gap: spacing.md }]} testID="ai-build-result">
            <Text style={s.resTitle}>{res.name}</Text>
            {res.keyword ? <Text style={s.kw}>{res.keyword}</Text> : null}
            <SlotButton testID="ai-res-weapon" label={t("weapon")} icon="pistol" value={res.weapon} onPress={() => res.weapon && router.push({ pathname: "/item/[category]/[slug]", params: { category: res.weapon.category, slug: res.weapon.slug } })} />
            <SlotButton testID="ai-res-weapon-mod" label={t("weaponMod")} icon="puzzle-outline" value={res.weapon_mod} onPress={() => {}} />
            {SLOTS.map((sl) => (
              <View key={sl} style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1.2 }}><SlotButton testID={`ai-res-armor-${sl}`} label={sl} icon="tshirt-crew-outline" value={res.armor[sl]} onPress={() => {}} /></View>
                <View style={{ flex: 1 }}><SlotButton testID={`ai-res-mod-${sl}`} label="Mod" icon="shield-star-outline" value={res.armor_mods[sl]} onPress={() => {}} /></View>
              </View>
            ))}
            <SlotButton testID="ai-res-deviation" label={t("deviation")} icon="ghost-outline" value={res.deviation} onPress={() => {}} />
            <BuildAiDetails ai={res} />
            <Pressable testID="ai-save-build-button" onPress={saveAndEdit} style={s.primary}>
              <Icon name="heart" size={18} color={colors.onBrandPrimary} />
              <Text style={s.primaryText}>{t("openInEditor")}</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function ChipLikeVideos({ videos }: { videos: Video[] }) {
  const s = useStyles();
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
        {videos.slice(0, 12).map((v) => (
          <View key={v.video_id} style={s.mini}>
            <Image source={{ uri: v.thumbnail }} style={s.miniImg} contentFit="cover" />
            <Text style={s.miniCh} numberOfLines={1}>{v.channel} · {v.published}</Text>
            <Text style={s.miniT} numberOfLines={2}>{v.title}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  pad: { paddingHorizontal: spacing.lg },
  note: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  label: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  input: { minHeight: 48, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, color: c.onSurface, fontFamily: fonts.text, fontSize: 15, paddingHorizontal: spacing.md },
  primary: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: radius.pill, backgroundColor: c.brandPrimary },
  primaryText: { color: c.onBrandPrimary, fontFamily: fonts.text, fontSize: 15 },
  err: { color: c.error, fontFamily: fonts.text, fontSize: 13 },
  resTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  kw: { color: c.goldLight, fontFamily: fonts.text, fontSize: 13, letterSpacing: 1 },
  mini: { width: 160, gap: 2 },
  miniImg: { width: 160, height: 90, borderRadius: radius.sm },
  miniCh: { color: c.goldLight, fontFamily: fonts.text, fontSize: 10 },
  miniT: { color: c.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11, lineHeight: 15 },
}));
