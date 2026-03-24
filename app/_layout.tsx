import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
import { Appearance, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PaperProvider } from "@/libs/react-native-paper";
import { InventoryProvider, useInventory } from "@/providers/inventory-provider";
import { GoogleDriveSyncProvider } from "@/providers/google-drive-sync-provider";
import { UnsavedChangesProvider } from "@/providers/unsaved-changes-provider";
import { OnboardingProvider } from '@/providers/onboarding-provider';
import { getAppTheme } from "@/theme/theme";
import * as Sentry from '@sentry/react-native';

void SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: 'https://5c0a8918a74cc35cc994024d86afef00@o4510776629723136.ingest.de.sentry.io/4510777159843920',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: false,

  beforeSend(event) {
    const values = event.exception?.values ?? [];
    const isAnrEvent = values.some(
      (value) =>
        value.type === "ApplicationNotResponding" ||
        value.value?.includes("ApplicationNotResponding"),
    );

    const hasLicenseClientFrame = values.some((value) =>
      (value.stacktrace?.frames ?? []).some(
        (frame) => frame.filename?.includes("LicenseClient.java"),
      ),
    );

    if (isAnrEvent && hasLicenseClientFrame && event.tags?.isSideLoaded === "true") {
      return {
        ...event,
        level: "warning",
        tags: {
          ...event.tags,
          issue_source: "android_license_client_sideload",
        },
      };
    }

    return event;
  },

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

  useEffect(() => {
    if (Appearance.setColorScheme) {
      Appearance.setColorScheme(appTheme === "system" ? null : isDark ? "dark" : "light");
    }
  }, [appTheme, isDark]);

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
        <StatusBar style={isDark ? "light" : "dark"} />
        <OnboardingProvider>
          {children}
        </OnboardingProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}

function RootLayoutContent() {
  const { loading } = useInventory();

  const onRootLayout = useCallback(() => {
    if (!loading) {
      void SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onRootLayout}>
      <ThemeAppWrapper>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ThemeAppWrapper>
    </View>
  );
}

export default Sentry.wrap(function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UnsavedChangesProvider>
          <InventoryProvider>
            <GoogleDriveSyncProvider>
              <RootLayoutContent />
            </GoogleDriveSyncProvider>
          </InventoryProvider>
        </UnsavedChangesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
