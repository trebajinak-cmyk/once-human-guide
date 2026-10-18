import { Text, View, StyleProp, TextStyle } from "react-native";

import { fonts, spacing } from "@/src/theme";

/** Minimal markdown-ish renderer: headings (#), bullets (-, *, •), **bold** stripped into bold spans. */
export function RichText({ text, color, size = 15, accent }: { text: string; color: string; size?: number; accent: string }) {
  const lines = text.split("\n");
  return (
    <View style={{ gap: spacing.xs }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: spacing.xs }} />;
        const h = line.match(/^#{1,4}\s+(.*)$/);
        if (h) {
          return (
            <Text key={i} style={{ color: accent, fontFamily: fonts.display, fontSize: size + 5, marginTop: spacing.xs }}>
              {h[1].replace(/\*\*/g, "")}
            </Text>
          );
        }
        const b = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
        const body = b ? b[1] : line;
        const num = line.match(/^\s*(\d+)\./);
        return (
          <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
            {b ? <Text style={{ color: accent, fontFamily: fonts.text, fontSize: size, lineHeight: size * 1.5 }}>{num ? `${num[1]}.` : "◆"}</Text> : null}
            <Text style={{ flex: 1, color, fontFamily: fonts.text, fontSize: size, lineHeight: size * 1.5 }}>
              {renderBold(body, { color: accent } as StyleProp<TextStyle>)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function renderBold(s: string, boldStyle: StyleProp<TextStyle>) {
  const parts = s.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <Text key={i} style={boldStyle}>{p}</Text> : p.replace(/`/g, "")));
}
