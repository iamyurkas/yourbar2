import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { PaperProvider } from "@/libs/react-native-paper";
import { InventoryProvider } from "@/providers/inventory-provider";
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UnsavedChangesProvider>
        <InventoryProvider>
          <PaperProvider theme={paperTheme}>
            <ThemeProvider value={navigationTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="crop" options={{ headerShown: false, presentation: "modal" }} />
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
    </GestureHandlerRootView>
  );
}
