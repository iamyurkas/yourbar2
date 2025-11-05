import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TagPill } from '@components/TagPill';
import { cocktailTagPalette } from '@data/tagCategories';
import { palette } from '@theme/colors';
import { radius, spacing } from '@theme/spacing';

const defaultTags = ['IBA Official', 'Unforgettables', 'New Era', 'strong', 'moderate', 'soft', 'long', 'shooter', 'non-alcoholic'];

export const AddCocktailScreen: React.FC = () => {
  const [selectedTags, setSelectedTags] = useState<string[]>(['custom']);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Name</Text>
      <TextInput placeholder="e.g. Margarita" style={styles.input} placeholderTextColor={palette.muted} />

      <View style={styles.row}>
        <View style={styles.photoCard}>
          <Text style={styles.photoLabel}>Glass</Text>
          <TouchableOpacity style={styles.photoPlaceholder}>
            <Text style={styles.photoText}>Tap to select image</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.photoCard}>
          <Text style={styles.photoLabel}>Photo</Text>
          <TouchableOpacity style={styles.photoPlaceholder}>
            <Text style={styles.photoText}>Tap to select image</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>Tags</Text>
      <TagPill label="custom" selected style={styles.tag} />

      <Text style={styles.label}>Add Tag</Text>
      <View style={styles.tagsContainer}>
        {defaultTags.map((tag, index) => (
          <TagPill
            key={tag}
            label={tag}
            color={cocktailTagPalette[index % cocktailTagPalette.length]}
            selected={selectedTags.includes(tag)}
            onPress={() => toggleTag(tag)}
          />
        ))}
        <TagPill label="+Add" />
      </View>

      <TouchableOpacity>
        <Text style={styles.manageTags}>Manage tags</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: palette.text,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    columnGap: spacing.sm,
  },
  photoCard: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: spacing.xs,
  },
  photoPlaceholder: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  photoText: {
    textAlign: 'center',
    color: palette.muted,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  tag: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  manageTags: {
    color: palette.primary,
    fontSize: 16,
    marginTop: spacing.sm,
  },
});
