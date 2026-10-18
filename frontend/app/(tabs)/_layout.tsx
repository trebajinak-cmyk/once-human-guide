import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import * as Haptics from "expo-haptics";

import { usesNativeTabs } from "@/src/navigation";
import { useLang } from "@/src/i18n";
import { fonts, useTheme } from "@/src/theme";
import { Icon, IconName } from "@/src/components/Icon";

const TABS: { name: string; key: "home" | "codex" | "guides" | "ai"; icon: IconName; sf: string }[] = [
  { name: "index", key: "home", icon: "home-variant-outline", sf: "house.fill" },
  { name: "codex", key: "codex", icon: "book-open-page-variant-outline", sf: "books.vertical.fill" },
  { name: "guides", key: "guides", icon: "play-box-multiple-outline", sf: "play.rectangle.fill" },
  { name: "assistant", key: "ai", icon: "creation", sf: "sparkles" },
];

export default function TabsLayout() {
  const { t } = useLang();
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {TABS.map((tb) => (
          <NativeTabs.Trigger key={tb.name} name={tb.name}>
            <NativeTabs.Trigger.Icon sf={tb.sf as any} />
            <NativeTabs.Trigger.Label>{t(tb.key)}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenListeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}) }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.goldLight,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderStrong,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.text, fontSize: 11 },
      }}
    >
      {TABS.map((tb) => (
        <Tabs.Screen
          key={tb.name}
          name={tb.name}
          options={{
            title: t(tb.key),
            tabBarButtonTestID: `tab-${tb.key}`,
            tabBarIcon: ({ color, size }) => <Icon name={tb.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
