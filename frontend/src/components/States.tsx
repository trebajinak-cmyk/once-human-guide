import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { fonts, makeStyles, useTheme, spacing, radius } from "@/src/theme";
import { useLang } from "@/src/i18n";
import { Icon, IconName } from "./Icon";

export function Loading({ testID = "loading-state" }: { testID?: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.wrap} testID={testID}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
    </View>
  );
}

export function ErrorState({ onRetry, testID = "error-state" }: { onRetry?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const s = useStyles();
  return (
    <View style={s.wrap} testID={testID}>
      <Icon name="access-point-network-off" size={36} color={colors.brandSecondary} />
      <Text style={s.title}>{t("signalLost")}</Text>
      {onRetry ? (
        <Pressable testID={`${testID}-retry`} onPress={onRetry} style={s.btn}>
          <Text style={s.btnText}>{t("retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ text, icon = "database-off-outline", testID = "empty-state" }: { text: string; icon?: IconName; testID?: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.wrap} testID={testID}>
      <Icon name={icon} size={36} color={colors.muted} />
      <Text style={s.title}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, minHeight: 200 },
  title: { color: c.onSurfaceTertiary, fontFamily: fonts.display, fontSize: 22, textAlign: "center" },
  btn: { backgroundColor: c.brandPrimary, paddingHorizontal: spacing.xl, minHeight: 44, justifyContent: "center", borderRadius: radius.pill },
  btnText: { color: c.onBrandPrimary, fontFamily: fonts.text, fontSize: 14 },
}));
