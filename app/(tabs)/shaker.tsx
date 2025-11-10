import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionHeader } from '@/components/CollectionHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SideMenu, type SideMenuItem } from '@/components/SideMenu';
import { Colors } from '@/constants/theme';
import { palette } from '@/theme/theme';
import { useRouter } from 'expo-router';

type ActionCardProps = {
  title: string;
  description: string;
  icon: 'wineglass.fill' | 'shaker.fill' | 'shopping.basket.fill';
};

export default function ShakerScreen() {
  const [query, setQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const paletteColors = Colors;
  const router = useRouter();

  const menuItems = useMemo<SideMenuItem[]>(
    () => [
      {
        key: 'cocktails',
        label: 'Cocktails',
        icon: 'glass-cocktail',
        badgeColorKey: 'pink',
        onPress: () => router.push('/(tabs)/cocktails'),
      },
      {
        key: 'shaker',
        label: 'Shaker',
        icon: 'shaker-outline',
        badgeColorKey: 'teal',
        onPress: () => router.push('/(tabs)/shaker'),
      },
      {
        key: 'ingredients',
        label: 'Ingredients',
        icon: 'basket-outline',
        badgeColorKey: 'orange',
        onPress: () => router.push('/(tabs)/ingredients'),
      },
      { key: 'settings', label: 'Settings', icon: 'cog-outline', badgeColorKey: 'purple' },
    ],
    [router],
  );

  const handleMenuPress = () => setMenuVisible(true);
  const handleMenuClose = () => setMenuVisible(false);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: paletteColors.background }]}
      edges={['top', 'left', 'right']}>
      <ThemedView style={[styles.screen, { backgroundColor: paletteColors.background }]}>
        <CollectionHeader
          searchValue={query}
          onSearchChange={setQuery}
          placeholder="Search"
          onMenuPress={handleMenuPress}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="title">Shaker</ThemedText>
            <Text style={[styles.subtitle, { color: paletteColors.onSurfaceVariant }]}>
              Jump into service mode with timers, prep reminders and a live checklist for the bar team.
            </Text>
          </View>

          <ActionCard
            title="Service rounds"
            description="Start a round, track tickets and sync progress with the floor in real time."
            icon="shaker.fill"
          />
          <ActionCard
            title="Build a new recipe"
            description="Capture specs, tasting notes and garnish instructions before saving to Cocktails."
            icon="wineglass.fill"
          />
          <ActionCard
            title="Restock checklist"
            description="Create a closing checklist and share it with the team before the next shift."
            icon="shopping.basket.fill"
          />
        </View>
      </ThemedView>
      <SideMenu visible={menuVisible} onClose={handleMenuClose} items={menuItems} />
    </SafeAreaView>
  );
}

function ActionCard({ title, description, icon }: ActionCardProps) {
  const paletteColors = Colors;
  const tint = paletteColors.tint;
  const backgroundColor = palette.surface;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      android_ripple={{ color: `${palette.tertiary}59` }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor,
          borderColor: `${palette.outline}66`,
          shadowColor: palette.shadow,
        },
        pressed && styles.cardPressed,
      ]}>
      <View style={[styles.iconBadge, { backgroundColor: `${tint}1A`, borderColor: `${tint}33` }]}>
        <IconSymbol name={icon} size={28} color={tint} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: paletteColors.text }]}>{title}</Text>
        <Text style={[styles.cardDescription, { color: paletteColors.onSurfaceVariant }]}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 20,
    backgroundColor: palette.surfaceVariant,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardText: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
});
