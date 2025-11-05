import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TagPill } from '@components/TagPill';
import { ingredientTagPalette } from '@data/tagCategories';
import { palette } from '@theme/colors';
import { radius, spacing } from '@theme/spacing';

const defaultTags = ['strong alcohol', 'soft alcohol', 'beverage', 'syrup', 'juice', 'fruit', 'herb', 'spice', 'dairy'];

export const AddIngredientScreen: React.FC = () => {
  const [selectedTags, setSelectedTags] = useState<string[]>(['other']);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Name</Text>
      <TextInput placeholder="e.g. Lemon juice" style={styles.input} placeholderTextColor={palette.muted} />

      <Text style={styles.label}>Photo</Text>
      <TouchableOpacity style={[styles.photoPlaceholder, styles.photoCard]}>
        <Text style={styles.photoText}>Tap to select image</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Tags</Text>
      <TagPill label="other" selected style={styles.tag} />

      <Text style={styles.label}>Add Tag</Text>
      <View style={styles.tagsContainer}>
        {defaultTags.map((tag, index) => (
          <TagPill
            key={tag}
            label={tag}
            color={ingredientTagPalette[index % ingredientTagPalette.length]}
            selected={selectedTags.includes(tag)}
            onPress={() => toggleTag(tag)}
          />
        ))}
        <TagPill label="+Add" />
      </View>

      <TouchableOpacity>
        <Text style={styles.manageTags}>Manage tags</Text>
      </TouchableOpacity>

      <Text style={[styles.label, styles.baseLabel]}>Base Ingredient</Text>
      <TouchableOpacity style={styles.baseSelector}>
        <Text style={styles.baseSelectorText}>Select base ingredient</Text>
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
  baseLabel: {
    marginTop: spacing.lg,
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
  photoCard: {
    marginBottom: spacing.lg,
  },
  photoPlaceholder: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    height: 160,
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
  baseSelector: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  baseSelectorText: {
    color: palette.muted,
    fontSize: 16,
  },
});
