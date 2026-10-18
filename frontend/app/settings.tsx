import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API, get, post } from "@/src/api";
import { Lang, useLang } from "@/src/i18n";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { ScreenHeader } from "@/src/components/ScreenHeader";

type Meta = { sync: { last_sync?: string; source?: string }; counts: Record<string, number> };

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang, setLang } = useLang();
  const s = useStyles();
  const meta = useQuery({ queryKey: ["meta"], queryFn: () => get<Meta>("/meta") });
  const cfg = useQuery({ queryKey: ["bridge-config"], queryFn: () => get<{ token: string }>("/bridge/config") });
  const sync = useMutation({ mutationFn: () => post("/sync"), onSuccess: () => meta.refetch() });
  const [copied, setCopied] = useState("");

  const copy = async (key: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  const token = cfg.data?.token ?? "…";
  const aiPrompt =
    `You have access to the "Once Human Guide" API with verified, live Once Human data.\n` +
    `Base URL: ${API}\n` +
    `- Search items: GET ${API}/bridge/search?q=<name>&category=weapons|armor|deviations|weapon_mods|armor_mods\n` +
    `- Item detail: GET ${API}/items/{category}/{slug}\n` +
    `- Latest official news/patches: GET ${API}/news?patch_only=true\n` +
    `- Tutorials: GET ${API}/guides and GET ${API}/guides/{id}\n` +
    `- Ask the guide AI: POST ${API}/bridge/ask with JSON {"question": "...", "lang": "cs"} and header X-Bridge-Token: ${token}\n` +
    `- Full export: GET ${API}/bridge/export\n` +
    `- OpenAPI schema: ${API}/openapi.json\n` +
    `Always query this API before answering questions about Once Human and cite the wiki_url.`;

  const rows = [
    { k: "base", label: "Base URL", v: API },
    { k: "openapi", label: "OpenAPI (ChatGPT Actions / MCP)", v: `${API}/openapi.json` },
    { k: "token", label: "X-Bridge-Token", v: token },
    { k: "export", label: "Export JSON", v: `${API}/bridge/export` },
  ];

  return (
    <View style={s.root} testID="settings-screen">
      <ScreenHeader back title={t("settings")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={s.card}>
          <Text style={s.label}>{t("language")}</Text>
          <View style={s.seg}>
            {(["cs", "en"] as Lang[]).map((l) => (
              <Pressable key={l} testID={`lang-${l}`} onPress={() => setLang(l)} style={[s.segBtn, lang === l && s.segActive]}>
                <Text style={[s.segText, lang === l && s.segTextActive]}>{l === "cs" ? "Čeština" : "English"}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.label}>{t("dataSync")}</Text>
          <Text style={s.body} testID="sync-last">
            {t("lastSync")}: {meta.data?.sync?.last_sync ? new Date(meta.data.sync.last_sync).toLocaleString(lang === "cs" ? "cs-CZ" : "en-US") : "—"}
          </Text>
          <View style={s.counts}>
            {Object.entries(meta.data?.counts ?? {}).map(([k, v]) => (
              <View key={k} style={s.countPill}><Text style={s.countText}>{t(k as any)}: {v}</Text></View>
            ))}
          </View>
          <Pressable testID="sync-now-button" onPress={() => sync.mutate()} disabled={sync.isPending} style={s.btn}>
            {sync.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Icon name="sync" size={18} color={colors.onBrandPrimary} />}
            <Text style={s.btnText}>{sync.isPending ? t("syncing") : t("syncNow")}</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.label}>{t("bridge")}</Text>
          <Text style={s.body}>{t("bridgeSub")}</Text>
          {rows.map((r) => (
            <Pressable key={r.k} testID={`bridge-copy-${r.k}`} onPress={() => copy(r.k, r.v)} style={s.copyRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.copyLabel}>{r.label}</Text>
                <Text style={s.mono} numberOfLines={1}>{r.v}</Text>
              </View>
              <Icon name={copied === r.k ? "check" : "content-copy"} size={18} color={copied === r.k ? colors.success : colors.brandPrimary} />
            </Pressable>
          ))}
          <Pressable testID="bridge-copy-prompt" onPress={() => copy("prompt", aiPrompt)} style={s.btn}>
            <Icon name={copied === "prompt" ? "check" : "robot-outline"} size={18} color={colors.onBrandPrimary} />
            <Text style={s.btnText}>{copied === "prompt" ? t("copied") : t("copyPrompt")}</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.label}>{t("sourcesTitle")}</Text>
          <Text style={s.body}>• Once Human Wiki (once-human.fandom.com) – {lang === "cs" ? "automatická synchronizace každých 6 h" : "auto-sync every 6 h"}</Text>
          <Text style={s.body}>• Steam – {lang === "cs" ? "oficiální oznámení a patch notes" : "official announcements and patch notes"}</Text>
          <Text style={s.body}>• YouTube – {lang === "cs" ? "komunitní video návody" : "community video tutorials"}</Text>
          <Text style={s.body}>• AI: Claude Sonnet</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.md },
  label: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  body: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  seg: { flexDirection: "row", backgroundColor: c.surface, borderRadius: radius.pill, padding: spacing.xs, borderWidth: 1, borderColor: c.border },
  segBtn: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segActive: { backgroundColor: c.brandPrimary },
  segText: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 14 },
  segTextActive: { color: c.onBrandPrimary },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  countPill: { backgroundColor: c.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  countText: { color: c.onBrandTertiary, fontFamily: fonts.text, fontSize: 12 },
  btn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: c.brandPrimary, borderRadius: radius.pill, minHeight: 48 },
  btnText: { color: c.onBrandPrimary, fontFamily: fonts.text, fontSize: 14 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.sm, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  copyLabel: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
  mono: { color: c.onSurface, fontFamily: "SpaceMono", fontSize: 12 },
}));
