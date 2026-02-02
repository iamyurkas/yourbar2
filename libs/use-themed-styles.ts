import { useMemo } from "react";

import { useThemeSettings } from "@/providers/theme-provider";

export const useThemedStyles = <TStyles>(factory: () => TStyles) => {
  const { effectiveScheme } = useThemeSettings();

  return useMemo(factory, [effectiveScheme]);
};
