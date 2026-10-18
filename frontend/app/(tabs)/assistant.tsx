import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Linking, Pressable, Text, TextInput, View, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { API, get } from "@/src/api";
import { useLang } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { RichText } from "@/src/components/RichText";

type Msg = { id: string; role: "user" | "assistant"; text: string; sources?: { title: string; url: string }[]; error?: boolean };

const QUICK = {
  cs: ["Jaký je nejlepší Shrapnel build?", "Co přinesl poslední patch?", "Jak funguje Lonewolf Set?", "Jak chytit Festering Gel?"],
  en: ["What is the best Shrapnel build?", "What did the latest patch add?", "How does the Lonewolf Set work?", "How do I capture Festering Gel?"],
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function Assistant() {
  const params = useLocalSearchParams<{ q?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const s = useStyles();
  const [session, setSession] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  useEffect(() => {
    (async () => {
      let sid = String((await storage.getItem("chat_session", "")) ?? "");
      if (!sid) {
        sid = `s-${newId()}`;
        await storage.setItem("chat_session", sid);
      }
      setSession(sid as string);
      try {
        const hist = await get<{ role: "user" | "assistant"; text: string; sources: Msg["sources"] }[]>(`/chat/${sid}`);
        setMsgs(hist.map((h) => ({ id: newId(), role: h.role, text: h.text, sources: h.sources })));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (params.q) {
      setInput(String(params.q));
      router.setParams({ q: undefined });
    }
  }, [params.q]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || busy || !session) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setInput("");
    setBusy(true);
    const aid = newId();
    setMsgs((m) => [...m, { id: newId(), role: "user", text: msg }, { id: aid, role: "assistant", text: "" }]);
    const patch = (fn: (m: Msg) => Msg) => setMsgs((all) => all.map((m) => (m.id === aid ? fn(m) : m)));
    try {
      const res = await expoFetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ session_id: session, message: msg, lang }),
      });
      if (!res.ok || !res.body) throw new Error("bad");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.trim();
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5));
          if (ev.t) patch((m) => ({ ...m, text: m.text + ev.t }));
          if (ev.sources) patch((m) => ({ ...m, sources: ev.sources }));
          if (ev.error) patch((m) => ({ ...m, error: true }));
        }
      }
    } catch {
      patch((m) => ({ ...m, error: true }));
    } finally {
      setBusy(false);
    }
  }, [busy, session, lang]);

  const clear = async () => {
    if (session) fetch(`${API}/chat/${session}`, { method: "DELETE" }).catch(() => {});
    const sid = `s-${newId()}`;
    await storage.setItem("chat_session", sid);
    setSession(sid);
    setMsgs([]);
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const mine = item.role === "user";
    return (
      <View style={[s.bubble, mine ? s.mine : s.theirs]} testID={mine ? "chat-user-message" : "chat-ai-message"}>
        {mine ? (
          <Text style={s.mineText}>{item.text}</Text>
        ) : item.text ? (
          <RichText text={item.text} color={colors.onSurfaceSecondary} accent={colors.goldLight} size={14} />
        ) : item.error ? null : (
          <ActivityIndicator color={colors.brandPrimary} />
        )}
        {item.error ? <Text style={s.err} testID="chat-error">{t("aiError")}</Text> : null}
        {!mine && item.sources?.length && item.text ? (
          <View style={s.sources}>
            <Text style={s.srcLabel}>{t("sources")}</Text>
            {item.sources.map((src) => (
              <Pressable key={src.url} onPress={() => Linking.openURL(src.url)} style={s.srcRow} testID="chat-source-link">
                <Icon name="link-variant" size={12} color={colors.brandPrimary} />
                <Text style={s.srcText} numberOfLines={1}>{src.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={s.root} testID="assistant-screen">
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={s.orb}><Icon name="creation" size={20} color={colors.onBrandPrimary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("aiTitle")}</Text>
          <Text style={s.sub}>{t("aiSub")}</Text>
        </View>
        <Pressable testID="chat-clear-button" onPress={clear} style={s.iconBtn} hitSlop={8}>
          <Icon name="chat-plus-outline" size={22} color={colors.brandPrimary} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={s.greet} testID="chat-greeting">
              <Text style={s.greetText}>{t("aiGreeting")}</Text>
              {msgs.length === 0 ? (
                <View style={s.quickWrap}>
                  {QUICK[lang].map((qq, i) => (
                    <Pressable key={qq} testID={`quick-question-${i}`} onPress={() => send(qq)} style={s.quick}>
                      <Text style={s.quickText}>{qq}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          }
        />
        <View style={[s.inputBar, { paddingBottom: bottomChrome + spacing.md }]}>
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder={t("askPlaceholder")}
            placeholderTextColor={colors.muted}
            style={s.input}
            multiline
            maxLength={1500}
          />
          <Pressable testID="chat-send-button" onPress={() => send(input)} disabled={busy || !input.trim()} style={[s.send, (busy || !input.trim()) && { opacity: 0.4 }]}>
            {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Icon name="send" size={20} color={colors.onBrandPrimary} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  orb: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", shadowColor: c.brandPrimary, shadowOpacity: 0.7, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 26 },
  sub: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md },
  greet: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.borderStrong, gap: spacing.md, marginBottom: spacing.sm },
  greetText: { color: c.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
  quickWrap: { gap: spacing.sm },
  quick: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 44, justifyContent: "center", backgroundColor: c.surface },
  quickText: { color: c.goldLight, fontFamily: fonts.text, fontSize: 13 },
  bubble: { maxWidth: "88%", borderRadius: radius.md, padding: spacing.md },
  mine: { alignSelf: "flex-end", backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.borderStrong },
  theirs: { alignSelf: "flex-start", backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, maxWidth: "100%" },
  mineText: { color: c.onBrandTertiary, fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
  err: { color: c.error, fontFamily: fonts.text, fontSize: 13 },
  sources: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm, gap: spacing.xs },
  srcLabel: { color: c.muted, fontFamily: fonts.text, fontSize: 11, letterSpacing: 1 },
  srcRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 24 },
  srcText: { color: c.brandPrimary, fontFamily: fonts.text, fontSize: 12, flex: 1 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
  input: { flex: 1, minHeight: 48, maxHeight: 120, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, color: c.onSurface, fontFamily: fonts.text, fontSize: 15, paddingHorizontal: spacing.md, paddingTop: 13, paddingBottom: 13 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
