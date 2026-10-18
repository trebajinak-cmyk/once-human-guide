import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View, Share, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueries } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { get, Item, post } from "@/src/api";
import { Build, deleteBuild, loadBuilds, newBuild, saveBuild, setCounts, Slot, SLOTS, toRef } from "@/src/builds";
import { useLang } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { ItemPicker, PickerSpec } from "@/src/components/ItemPicker";
import { RichText } from "@/src/components/RichText";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SlotButton } from "@/src/components/SlotButton";
import { BuildAiDetails } from "@/src/components/BuildAiDetails";

type Target = { kind: "weapon" | "weapon_mod" | "deviation" } | { kind: "armor" | "armor_mods"; slot: Slot };

export default function BuildEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const [b, setB] = useState<Build>(newBuild());
  const [spec, setSpec] = useState<PickerSpec>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [review, setReview] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shotRef = useRef<View>(null);

  useEffect(() => {
    if (id) loadBuilds().then((all) => { const f = all.find((x) => x.id === id); if (f) setB(f); });
  }, [id]);

  const sets = setCounts(b);
  const setDetails = useQueries({
    queries: sets.map((x) => ({ queryKey: ["item", "armor", x.ref.slug], queryFn: () => get<Item>(`/items/armor/${x.ref.slug}`) })),
  });

  const open = (tg: Target) => {
    setTarget(tg);
    if (tg.kind === "weapon") setSpec({ title: t("weapon"), category: "weapons" });
    if (tg.kind === "weapon_mod") setSpec({ title: t("weaponMod"), category: "weapon_mods" });
    if (tg.kind === "deviation") setSpec({ title: t("deviation"), category: "deviations", filter: (i) => i.subtype === "Combat" });
    if (tg.kind === "armor") setSpec({ title: tg.slot, category: "armor", filter: (i) => i.subtype === tg.slot || i.subtype === "Armor Set" });
    if (tg.kind === "armor_mods") setSpec({ title: `${tg.slot} mod`, category: "armor_mods", filter: (i) => i.subtype === tg.slot || i.subtype === "Universal" });
  };

  const onPick = (i: Parameters<typeof toRef>[0]) => {
    const r = toRef(i);
    if (!target) return;
    Haptics.selectionAsync().catch(() => {});
    setB((cur) => {
      if (target.kind === "armor" || target.kind === "armor_mods") return { ...cur, [target.kind]: { ...cur[target.kind], [target.slot]: r } };
      return { ...cur, [target.kind]: r };
    });
    setSpec(null);
  };

  const save = async () => {
    await saveBuild(b);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1800);
  };

  const remove = async () => {
    await deleteBuild(b.id);
    router.back();
  };

  const doReview = async () => {
    setReviewing(true);
    setReview("");
    try {
      const r = await post<{ review: string }>("/builds/review", { build: b, lang });
      setReview(r.review);
    } catch {
      setReview(t("aiError"));
    } finally {
      setReviewing(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(shotRef, { format: "png", quality: 0.95 });
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("shareBuild") });
      } else {
        await Share.share({ message: buildText(b) });
      }
    } catch {
      await Share.share({ message: buildText(b) }).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={s.root} testID="build-editor-screen">
      <ScreenHeader
        back
        title={b.name || t("newBuild")}
        subtitle={b.keyword}
        right={
          <Pressable testID="build-share-button" onPress={share} style={s.headBtn} hitSlop={8}>
            {sharing ? <ActivityIndicator color={colors.brandPrimary} /> : <Icon name="share-variant" size={22} color={colors.brandPrimary} />}
          </Pressable>
        }
      />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View ref={shotRef} collapsable={false} style={s.shot}>
          <TextInput testID="build-name-input" value={b.name} onChangeText={(v) => setB({ ...b, name: v })} placeholder={t("buildName")} placeholderTextColor={colors.muted} style={s.nameInput} />
          <Text style={s.label}>{t("weapon")}</Text>
          <SlotButton testID="slot-weapon" label={t("weapon")} icon="pistol" value={b.weapon} onPress={() => open({ kind: "weapon" })} />
          <SlotButton testID="slot-weapon-mod" label={t("weaponMod")} icon="puzzle-outline" value={b.weapon_mod} onPress={() => open({ kind: "weapon_mod" })} />

          <Text style={s.label}>{t("armorSlots")}</Text>
          {SLOTS.map((sl) => (
            <View key={sl} style={s.pair}>
              <View style={{ flex: 1.2 }}>
                <SlotButton testID={`slot-armor-${sl}`} label={sl} icon="tshirt-crew-outline" value={b.armor[sl]} onPress={() => open({ kind: "armor", slot: sl })} />
              </View>
              <View style={{ flex: 1 }}>
                <SlotButton testID={`slot-armor-mod-${sl}`} label="Mod" icon="shield-star-outline" value={b.armor_mods[sl]} onPress={() => open({ kind: "armor_mods", slot: sl })} />
              </View>
            </View>
          ))}

          {sets.length ? (
            <View style={s.setsBox} testID="active-set-bonuses">
              <Text style={s.label}>{t("activeSets")}</Text>
              {sets.map((x, i) => {
                const det = setDetails[i]?.data;
                return (
                  <View key={x.ref.slug} style={{ gap: spacing.xs }}>
                    <Text style={s.setTitle}>{x.ref.title} · {x.count}/6</Text>
                    {(det?.set_effects ?? []).map((se, j) => {
                      const active = parseInt(se.pieces, 10) <= x.count;
                      return (
                        <View key={j} style={s.setRow}>
                          <Icon name={active ? "check-circle" : "circle-outline"} size={16} color={active ? colors.success : colors.muted} />
                          <Text style={[s.setText, !active && { color: colors.muted }]}>{se.pieces}: {se.effect}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={s.label}>{t("deviation")}</Text>
          <SlotButton testID="slot-deviation" label={t("deviation")} icon="ghost-outline" value={b.deviation} onPress={() => open({ kind: "deviation" })} />
          <View style={s.brand}><Icon name="shield-sword" size={14} color={colors.brandPrimary} /><Text style={s.brandText}>Once Human Guide</Text></View>
        </View>

        {b.ai ? <BuildAiDetails ai={b.ai} /> : null}

        <Text style={s.label}>{t("notes")}</Text>
        <TextInput testID="build-notes-input" value={b.notes} onChangeText={(v) => setB({ ...b, notes: v })} multiline placeholder="…" placeholderTextColor={colors.muted} style={s.notes} />

        <Pressable testID="build-save-button" onPress={save} style={s.primary}>
          <Icon name={savedMsg ? "check" : "heart"} size={18} color={colors.onBrandPrimary} />
          <Text style={s.primaryText}>{savedMsg ? t("saved") : t("save")}</Text>
        </Pressable>
        <Pressable testID="build-review-button" onPress={doReview} disabled={reviewing} style={s.secondary}>
          {reviewing ? <ActivityIndicator color={colors.goldLight} /> : <Icon name="creation" size={18} color={colors.goldLight} />}
          <Text style={s.secondaryText}>{reviewing ? t("reviewing") : t("aiReview")}</Text>
        </Pressable>
        {review ? (
          <View style={s.reviewBox} testID="build-review-result">
            <RichText text={review} color={colors.onSurfaceSecondary} accent={colors.goldLight} size={14} />
          </View>
        ) : null}
        {id ? (
          <Pressable testID="build-delete-button" onPress={remove} style={s.danger}>
            <Icon name="delete-outline" size={18} color={colors.error} />
            <Text style={s.dangerText}>{t("delete")}</Text>
          </Pressable>
        ) : null}
      </KeyboardAwareScrollView>
      <ItemPicker spec={spec} onClose={() => setSpec(null)} onPick={onPick} />
    </View>
  );
}

function buildText(b: Build) {
  const lines = [`⚔️ ${b.name || "Once Human build"}${b.keyword ? ` (${b.keyword})` : ""}`];
  if (b.weapon) lines.push(`Weapon: ${b.weapon.title}${b.weapon_mod ? ` + ${b.weapon_mod.title}` : ""}`);
  SLOTS.forEach((s) => { if (b.armor[s]) lines.push(`${s}: ${b.armor[s]!.title}${b.armor_mods[s] ? ` [${b.armor_mods[s]!.title}]` : ""}`); });
  if (b.deviation) lines.push(`Deviation: ${b.deviation.title}`);
  lines.push("— Once Human Guide");
  return lines.join("\n");
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  headBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  shot: { gap: spacing.md, backgroundColor: c.surface, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.goldDeep },
  nameInput: { color: c.onSurface, fontFamily: fonts.display, fontSize: 26, borderBottomWidth: 1, borderBottomColor: c.borderStrong, paddingVertical: spacing.sm },
  label: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginTop: spacing.sm },
  pair: { flexDirection: "row", gap: spacing.sm },
  setsBox: { backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: c.borderStrong },
  setTitle: { color: c.goldLight, fontFamily: fonts.display, fontSize: 18 },
  setRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  setText: { flex: 1, color: c.onBrandTertiary, fontFamily: fonts.text, fontSize: 12, lineHeight: 17 },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-end" },
  brandText: { color: c.muted, fontFamily: fonts.display, fontSize: 13 },
  notes: { minHeight: 90, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, color: c.onSurface, fontFamily: fonts.text, fontSize: 14, padding: spacing.md, textAlignVertical: "top" },
  primary: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: radius.pill, backgroundColor: c.brandPrimary },
  primaryText: { color: c.onBrandPrimary, fontFamily: fonts.text, fontSize: 15 },
  secondary: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: radius.pill, backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.borderStrong },
  secondaryText: { color: c.goldLight, fontFamily: fonts.text, fontSize: 15 },
  reviewBox: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  danger: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 48 },
  dangerText: { color: c.error, fontFamily: fonts.text, fontSize: 14 },
}));
