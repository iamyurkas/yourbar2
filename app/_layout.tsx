import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, View } from "react-native";
import "react-native-reanimated";

import { PaperProvider } from "@/libs/react-native-paper";
import { OnboardingProvider } from "@/components/onboarding/OnboardingContext";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { InventoryProvider, useInventory } from "@/providers/inventory-provider";
import { BackNavigationProvider } from "@/providers/back-navigation-provider";
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

function ThemeAppWrapper({ children }: { children: React.ReactNode }) {
  const { appTheme } = useInventory();
  const systemColorScheme = useColorScheme();

  const isDark = appTheme === 'system'
    ? systemColorScheme === 'dark'
    : appTheme === 'dark';

  const paperTheme = getAppTheme(isDark);
  const { colors } = paperTheme;

  const navigationTheme = ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.onSurface,
      border: colors.outline,
    },
  } satisfies typeof DefaultTheme);

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navigationTheme}>
        {children}
        <StatusBar style={isDark ? "light" : "dark"} />
      </ThemeProvider>
    </PaperProvider>
  );
}

export default Sentry.wrap(function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <UnsavedChangesProvider>
        <InventoryProvider>
          <BackNavigationProvider>
            <OnboardingProvider>
              <ThemeAppWrapper>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
                <OnboardingOverlay />
              </ThemeAppWrapper>
            </OnboardingProvider>
          </BackNavigationProvider>
        </InventoryProvider>
      </UnsavedChangesProvider>
    </View>
  );
});
