import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ScreenProps = ViewProps & {
  children: React.ReactNode;
  withPadding?: boolean;
};

export function Screen({ children, style, withPadding = true, ...rest }: ScreenProps) {
  const scheme = useColorScheme() ?? 'light';
  const background = Colors[scheme].surface;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View
        style={[styles.content, withPadding && styles.padded, style]}
        {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 16,
  },
});
