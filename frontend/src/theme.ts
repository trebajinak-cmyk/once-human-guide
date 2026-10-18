// Design tokens (dark only) – values from /app/design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0B0C10",
  onSurface: "#F0EBE1",
  surfaceSecondary: "#1A1C23",
  onSurfaceSecondary: "#E5E1D8",
  surfaceTertiary: "#262A35",
  onSurfaceTertiary: "#C8C4BD",
  surfaceInverse: "#E8DECB",
  onSurfaceInverse: "#1A1A1A",
  muted: "#8A8D96",

  brand: "#C2A46A",
  onBrand: "#1A150B",
  brandPrimary: "#C2A46A",
  onBrandPrimary: "#1A150B",
  brandSecondary: "#8C182A",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#3E3725",
  onBrandTertiary: "#E8DECB",

  success: "#3E7A4A",
  onSuccess: "#FFFFFF",
  warning: "#D1943A",
  onWarning: "#1A1A1A",
  error: "#B03838",
  onError: "#FFFFFF",
  info: "#4A728A",
  onInfo: "#FFFFFF",

  border: "#262933",
  borderStrong: "#5C523A",
  divider: "#1A1C23",

  rarityCommon: "#9BA0A6",
  rarityRare: "#4D88D9",
  rarityEpic: "#9A58E8",
  rarityLegendary: "#D6B560",

  // extra tokens for the cinematic card
  goldDeep: "#7A6232",
  goldLight: "#F1D48A",
  parchmentDark: "#D6C8AA",
  parchmentLine: "#B9A57A",
  parchmentMuted: "#5A4E3A",
  glow: "rgba(140,24,42,0.55)",
  glowSoft: "rgba(140,24,42,0.18)",
  glass: "rgba(26,28,35,0.78)",
  scrim: "rgba(11,12,16,0.92)",
  scrimLight: "rgba(11,12,16,0.35)",
  transparent: "transparent",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export const fonts = {
  display: "Cormorant",
  displayItalic: "CormorantItalic",
  text: "DMSans",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export function rarityColor(c: ThemeColors, rarity?: string) {
  switch ((rarity || "").toLowerCase()) {
    case "legendary":
      return c.rarityLegendary;
    case "epic":
      return c.rarityEpic;
    case "rare":
      return c.rarityRare;
    case "common":
      return c.rarityCommon;
    default:
      return c.borderStrong;
  }
}

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  useColorScheme();
  return { scheme: "dark", colors: themes.dark };
}

export const colors = dark;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
