import React, { useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '@theme/colors';
import { spacing } from '@theme/spacing';

interface SettingItem {
  id: string;
  label: string;
  description?: string;
  type: 'toggle' | 'link';
}

const toggleSettings: SettingItem[] = [
  { id: 'ignoreGarnishes', label: 'Ignore garnishes', description: 'All garnishes are optional', type: 'toggle' },
  {
    id: 'allowSubstitutes',
    label: 'Always allow substitutes',
    description: 'Use base or branded alternatives regardless of recipe',
    type: 'toggle',
  },
  { id: 'metric', label: 'Use metric system', description: 'Choose to use U.S. units', type: 'toggle' },
  {
    id: 'keepAwake',
    label: 'Keep screen awake',
    description: 'Prevent the phone from sleeping while viewing cocktail detail',
    type: 'toggle',
  },
  { id: 'tabsOnTop', label: 'Tabs on top', description: 'Toggle to show tabs at bottom', type: 'toggle' },
];

const linkSettings: SettingItem[] = [
  { id: 'favorites', label: 'Favorites rating', description: 'Show all favorite cocktails', type: 'link' },
  { id: 'startScreen', label: 'Start screen', description: 'Cocktails · My', type: 'link' },
  { id: 'ingredientTags', label: 'Ingredient tags', description: 'Create, edit or remove ingredient tags', type: 'link' },
  { id: 'cocktailTags', label: 'Cocktail tags', description: 'Create, edit or remove cocktail tags', type: 'link' },
];

export const SettingsScreen: React.FC = () => {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    toggleSettings.reduce((acc, setting) => ({ ...acc, [setting.id]: true }), {} as Record<string, boolean>),
  );

  const handleToggle = (id: string) => setToggles((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <FlatList
      style={styles.list}
      data={[...toggleSettings, ...linkSettings]}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.textContainer}>
            <Text style={styles.label}>{item.label}</Text>
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          </View>
          {item.type === 'toggle' ? (
            <Switch value={toggles[item.id]} onValueChange={() => handleToggle(item.id)} trackColor={{ true: palette.primary }} />
          ) : (
            <TouchableOpacity>
              <Text style={styles.link}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.content}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  description: {
    fontSize: 14,
    color: palette.muted,
    marginTop: spacing.xs,
  },
  link: {
    fontSize: 22,
    color: palette.muted,
  },
  separator: {
    height: 1,
    backgroundColor: palette.border,
  },
});
