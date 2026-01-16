import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { PaperProvider } from "@/libs/react-native-paper";
import { OnboardingGate } from "@/components/OnboardingGate";
import { InventoryProvider } from "@/providers/inventory-provider";
import { OnboardingProvider } from "@/providers/onboarding-provider";
import { UnsavedChangesProvider } from "@/providers/unsaved-changes-provider";
import { getAppTheme } from "@/theme/theme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
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
        <OnboardingProvider>
          <PaperProvider theme={paperTheme}>
            <ThemeProvider value={navigationTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modal"
                  options={{ presentation: "modal", title: "Modal" }}
                />
              </Stack>
              <OnboardingGate />
              <StatusBar style="dark" />
            </ThemeProvider>
          </PaperProvider>
        </OnboardingProvider>
      </InventoryProvider>
    </UnsavedChangesProvider>
  );
}
