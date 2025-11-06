import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { HeaderBar } from '@/components/ui/header-bar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInventory, type Ingredient } from '@/providers/inventory-provider';

type ShakerGroup = {
  key: string;
  label: string;
  color: string;
  ingredients: Ingredient[];
};

type Palette = (typeof Colors)['light'];

type GroupRowProps = {
  ingredient: Ingredient;
  isAvailable: boolean;
  isSelected: boolean;
  onToggle: () => void;
  theme: Palette;
};

export default function ShakerScreen() {
  const { ingredients, availableIngredientIds } = useInventory();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const groups = useMemo<ShakerGroup[]>(() => {
    const map = new Map<string, ShakerGroup>();
    ingredients.forEach((ingredient) => {
      const primaryTag = ingredient.tags?.[0];
      const key = primaryTag?.name ?? 'Untagged';
      const color = primaryTag?.color ?? theme.secondary;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: key,
          color,
          ingredients: [],
        });
      }
      map.get(key)!.ingredients.push(ingredient);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [ingredients, theme.secondary]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(groups.slice(0, 3).map((group) => group.key)));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <HeaderBar title="Shaker" actions={[{ icon: 'clock', accessibilityLabel: 'Open timers' }]} />

        <View style={styles.intro}> 
          <ThemedText type="subtitle">Group your mise en place</ThemedText>
          <ThemedText style={[styles.introBody, { color: theme.textMuted }]}>
            Expand a tag to prep ingredients and mark what you need for the next round.
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {groups.map((group) => {
            const expanded = expandedGroups.has(group.key);
            return (
              <View key={group.key} style={styles.groupSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => toggleGroup(group.key)}
                  style={({ pressed }) => [
                    styles.groupChip,
                    {
                      backgroundColor: group.color,
                    },
                    pressed && styles.chipPressed,
                  ]}
                  android_ripple={{ color: 'rgba(255,255,255,0.2)', radius: 160 }}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#FFFFFF"
                  />
                </Pressable>

                {expanded ? (
                  <View style={styles.groupList}>
                    {group.ingredients.map((ingredient) => {
                      const id = Number(ingredient.id ?? -1);
                      const isAvailable = id >= 0 && availableIngredientIds.has(id);
                      const isSelected = id >= 0 && selectedIds.has(id);
                      const handleToggle = () => {
                        if (id >= 0) {
                          toggleSelection(id);
                        }
                      };
                      return (
                        <GroupRow
                          key={String(ingredient.id ?? ingredient.name)}
                          ingredient={ingredient}
                          isAvailable={isAvailable}
                          isSelected={isSelected}
                          onToggle={handleToggle}
                          theme={theme}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function GroupRow({ ingredient, isAvailable, isSelected, onToggle, theme }: GroupRowProps) {
  const usageCount = ingredient.usageCount ?? 0;
  const availabilityLabel = isAvailable ? 'Ready' : 'Missing';

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onToggle}
      style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}
      android_ripple={{ color: theme.ripple, radius: 200 }}>
      <View
        style={[
          styles.row,
          {
            backgroundColor: isSelected ? 'rgba(76,195,138,0.12)' : theme.surface,
            borderColor: isSelected ? theme.success : theme.outline,
          },
        ]}>
        <View style={[styles.rowThumbnail, { backgroundColor: theme.tertiaryContainer }]}> 
          <Ionicons name="cube" size={20} color={theme.tertiary} />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {ingredient.name}
          </Text>
          <Text style={[styles.rowSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {usageCount > 0 ? `${usageCount} uses` : 'Not in recipes yet'}
          </Text>
        </View>
        <View
          style={[
            styles.rowBadge,
            {
              backgroundColor: isAvailable ? 'rgba(76,195,138,0.16)' : theme.surfaceVariant,
              borderColor: isAvailable ? theme.success : theme.outline,
            },
          ]}>
          <Text
            style={[
              styles.rowBadgeLabel,
              { color: isAvailable ? theme.success : theme.textMuted },
            ]}>
            {availabilityLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  intro: {
    gap: 6,
  },
  introBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  scrollContent: {
    paddingBottom: 120,
    gap: 16,
  },
  groupSection: {
    gap: 12,
  },
  groupChip: {
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  groupLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
  },
  groupList: {
    gap: 10,
  },
  rowPressable: {
    borderRadius: 18,
  },
  rowPressed: {
    transform: [{ scale: 0.99 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  rowThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
  },
  rowBadge: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rowBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
