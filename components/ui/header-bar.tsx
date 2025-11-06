import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { IconButton } from './icon-button';

type HeaderAction = {
  icon: React.ComponentProps<typeof IconButton>['icon'];
  accessibilityLabel: string;
  onPress?: () => void;
};

type HeaderBarProps = {
  title: string;
  onPressBack?: () => void;
  actions?: HeaderAction[];
};

export function HeaderBar({ title, onPressBack, actions }: HeaderBarProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.outlineVariant,
        },
      ]}>
      <View style={styles.leading}>
        {onPressBack ? (
          <IconButton icon="chevron-left" accessibilityLabel="Go back" onPress={onPressBack} />
        ) : null}
        <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
      </View>
      <View style={styles.actions}>
        {actions?.map((action, index) => (
          <IconButton
            key={`${action.icon}-${index}`}
            icon={action.icon}
            accessibilityLabel={action.accessibilityLabel}
            onPress={action.onPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
