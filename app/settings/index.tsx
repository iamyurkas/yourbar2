import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReactNode, useState } from 'react';
import { Pressable, PressableStateCallbackType, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type ToggleKey =
  | 'ignoreGarnishes'
  | 'allowSubstitutes'
  | 'metricSystem'
  | 'keepAwake'
  | 'tabsOnTop';

export default function SettingsScreen() {
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    ignoreGarnishes: true,
    allowSubstitutes: true,
    metricSystem: false,
    keepAwake: true,
    tabsOnTop: true,
  });

  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const background = useThemeColor({ light: '#F9FAFB', dark: '#111827' }, 'background');

  const handleToggle = (key: ToggleKey) => {
    setToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} style={{ backgroundColor: background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <SettingsSection title="General">
          <SettingToggle
            label="Ignore garnishes"
            description="All garnishes are optional."
            value={toggles.ignoreGarnishes}
            onChange={() => handleToggle('ignoreGarnishes')}
          />
          <SettingToggle
            label="Always allow substitutes"
            description="Use base or branded alternatives regardless of recipe."
            value={toggles.allowSubstitutes}
            onChange={() => handleToggle('allowSubstitutes')}
          />
          <SettingToggle
            label="Use metric system"
            description="Switch to use U.S. units."
            value={toggles.metricSystem}
            onChange={() => handleToggle('metricSystem')}
          />
          <SettingToggle
            label="Keep screen awake"
            description="Prevent the phone from sleeping while viewing cocktail details."
            value={toggles.keepAwake}
            onChange={() => handleToggle('keepAwake')}
          />
          <SettingToggle
            label="Tabs on top"
            description="Uncheck to show tabs at bottom."
            value={toggles.tabsOnTop}
            onChange={() => handleToggle('tabsOnTop')}
          />
        </SettingsSection>

        <SettingsSection title="Navigation">
          <SettingAction label="Favorites rating" description="Show all favorite cocktails" />
          <SettingAction label="Start screen" description="Cocktails · My" />
          <SettingAction label="Ingredient tags" description="Create, edit or remove ingredient tags" />
          <SettingAction label="Cocktail tags" description="Create, edit or remove cocktail tags" />
        </SettingsSection>
      </ScrollView>
    </Screen>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const textColor = useThemeColor({}, 'text');
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={[styles.sectionTitle, { color: textColor }]}>
        {title}
      </ThemedText>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SettingToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
}) {
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText type="defaultSemiBold" style={[styles.rowLabel, { color: textColor }]}>
          {label}
        </ThemedText>
        <ThemedText style={styles.rowDescription}>{description}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: tint, false: '#D1D5DB' }}
        thumbColor="#fff"
      />
    </View>
  );
}

function SettingAction({ label, description }: { label: string; description: string }) {
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  return (
    <Pressable
      style={({ pressed }: PressableStateCallbackType) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowText}>
        <ThemedText type="defaultSemiBold" style={[styles.rowLabel, { color: textColor }]}>
          {label}
        </ThemedText>
        <ThemedText style={styles.rowDescription}>{description}</ThemedText>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    gap: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 25,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
});
