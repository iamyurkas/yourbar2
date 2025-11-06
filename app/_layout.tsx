import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from '@/libs/react-native-paper';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { InventoryProvider } from '@/providers/inventory-provider';
import { getAppTheme } from '@/theme/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const navigationTheme = ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Colors.light.background,
      card: Colors.light.surface,
      text: Colors.light.text,
      border: Colors.light.outline,
    },
  } satisfies typeof DefaultTheme);

  const paperTheme = getAppTheme();

  return (
    <InventoryProvider>
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={navigationTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </PaperProvider>
    </InventoryProvider>
  );
}
