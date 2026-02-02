import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import { setColorsForScheme } from "@/constants/theme";
import { getAppTheme, type AppColorScheme } from "@/theme/theme";
import type { PaperTheme } from "@/libs/react-native-paper";

type ThemeContextValue = {
  colorScheme: AppColorScheme;
  isDarkMode: boolean;
  theme: PaperTheme;
  toggleColorScheme: () => void;
  setColorScheme: (scheme: AppColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme() === "dark" ? "dark" : "light";
  const [colorScheme, setColorScheme] =
    useState<AppColorScheme>(systemScheme);

  useEffect(() => {
    setColorScheme(systemScheme);
  }, [systemScheme]);

  const theme = useMemo(
    () => getAppTheme(colorScheme),
    [colorScheme],
  );

  setColorsForScheme(colorScheme);

  const toggleColorScheme = () => {
    setColorScheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({
      colorScheme,
      isDarkMode: colorScheme === "dark",
      theme,
      toggleColorScheme,
      setColorScheme,
    }),
    [colorScheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }

  return context;
}
