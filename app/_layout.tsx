import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from '@/libs/react-native-paper';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { InventoryProvider } from '@/providers/inventory-provider';
import { UnsavedChangesProvider } from '@/providers/unsaved-changes-provider';
import { getAppTheme, palette } from '@/theme/theme';
import { useColorScheme } from 'react-native';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
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
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar
              style={isDarkMode ? 'light' : 'dark'}
              backgroundColor={isDarkMode ? palette.inverseSurface : undefined}
            />
          </ThemeProvider>
        </PaperProvider>
      </InventoryProvider>
    </UnsavedChangesProvider>
  );
}
