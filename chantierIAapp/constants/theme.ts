/**
 * Thème BTP IA — jaune + charbon
 */

import { Platform } from "react-native";
import { BRAND } from "./brand";

export const Colors = {
  light: {
    text: BRAND.colors.ink,
    background: BRAND.colors.surface,
    tint: BRAND.colors.yellow,
    icon: BRAND.colors.muted,
    tabIconDefault: BRAND.colors.muted,
    tabIconSelected: BRAND.colors.ink,
  },
  dark: {
    text: "#ECEDEE",
    background: BRAND.colors.charcoal,
    tint: BRAND.colors.yellow,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: BRAND.colors.yellow,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
