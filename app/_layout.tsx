import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import "react-native-reanimated";

import { PaperProvider } from "@/libs/react-native-paper";
import { InventoryProvider, useInventory } from "@/providers/inventory-provider";
import { UnsavedChangesProvider } from "@/providers/unsaved-changes-provider";
import { getAppTheme } from "@/theme/theme";
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://5c0a8918a74cc35cc994024d86afef00@o4510776629723136.ingest.de.sentry.io/4510777159843920',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: false,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutContent() {
  const { appTheme } = useInventory();
  const systemColorScheme = useColorScheme();
  const colorScheme = appTheme === 'system' ? systemColorScheme : appTheme;
  const paperTheme = getAppTheme(colorScheme);
  const isDark = colorScheme === 'dark';

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: paperTheme.colors.primary,
      background: paperTheme.colors.background,
      card: paperTheme.colors.surface,
      text: paperTheme.colors.onSurface,
      border: paperTheme.colors.outline,
      notification: paperTheme.colors.error,
    },
  };

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navigationTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PaperProvider>
  );
}

export default Sentry.wrap(function RootLayout() {
  return (
    <UnsavedChangesProvider>
      <InventoryProvider>
        <RootLayoutContent />
      </InventoryProvider>
    </UnsavedChangesProvider>
  );
});
