import { Pressable, ScrollView, Text } from "react-native";
import * as Haptics from "expo-haptics";

import { fonts, makeStyles, spacing, radius } from "@/src/theme";

export type ChipOpt = { value: string; label: string; color?: string };

export function ChipRow({ options, value, onChange, testPrefix }: { options: ChipOpt[]; value: string; onChange: (v: string) => void; testPrefix: string }) {
  const s = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row} contentContainerStyle={s.content}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testPrefix}-${o.value || "all"}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[s.chip, active && s.chipActive, o.color && active ? { borderColor: o.color } : null]}
          >
            <Text style={[s.text, active && s.textActive, o.color && !active ? { color: o.color } : null]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexGrow: 0, height: 56 },
  content: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    height: 36, flexShrink: 0, paddingHorizontal: spacing.lg, borderRadius: radius.pill, justifyContent: "center",
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary,
  },
  chipActive: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  text: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 13 },
  textActive: { color: c.goldLight },
}));
