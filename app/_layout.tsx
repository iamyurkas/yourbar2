import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { PaperProvider } from "@/libs/react-native-paper";
import { InventoryProvider } from "@/providers/inventory-provider";
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

export default Sentry.wrap(function RootLayout() {
  const navigationTheme = ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Colors.background,
      card: Colors.surface,
      text: Colors.text,
      border: Colors.outline,
    },
  } satisfies typeof DefaultTheme);

  const paperTheme = getAppTheme();

  return (
    <UnsavedChangesProvider>
      <InventoryProvider>
        <PaperProvider theme={paperTheme}>
          <ThemeProvider value={navigationTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
            </Stack>
            <StatusBar style="dark" />
          </ThemeProvider>
        </PaperProvider>
      </InventoryProvider>
    </UnsavedChangesProvider>
  );
});
