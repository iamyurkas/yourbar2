import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useColorScheme } from "react-native";

import { setThemeScheme } from "@/constants/theme";
import { type ThemeScheme } from "@/theme/theme";

export type ThemePreference = ThemeScheme;

type ThemeContextValue = {
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => void;
  effectiveScheme: ThemeScheme;
  isDarkMode: boolean;
  isSystemDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("light");
  const isSystemDark = systemScheme === "dark";
  const effectiveScheme: ThemeScheme = isSystemDark ? "dark" : themePreference;
  const isDarkMode = effectiveScheme === "dark";

  setThemeScheme(effectiveScheme);

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference,
      effectiveScheme,
      isDarkMode,
      isSystemDark,
    }),
    [effectiveScheme, isDarkMode, isSystemDark, themePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useThemeSettings must be used within ThemeProvider.");
  }

  return context;
}
