import { FlatList, ListRenderItemInfo, StyleSheet, View } from 'react-native';

import { Tag } from '@/components/ui/tag';
import { EntityRow } from '@/features/shared/components/entity-row';

export type IngredientListItem = {
  id: string;
  name: string;
  cocktailCount: number;
  detail?: string;
  accentColor?: string;
  statusColor?: string;
  selected?: boolean;
  tags: { label: string; color?: string }[];
};

type Props = {
  data: IngredientListItem[];
  showSelection?: boolean;
};

export function IngredientList({ data, showSelection = true }: Props) {
  const renderItem = ({ item }: ListRenderItemInfo<IngredientListItem>) => (
    <EntityRow
      title={item.name}
      subtitle={`${item.cocktailCount} cocktails`}
      detail={item.detail}
      thumbnailColor={item.accentColor}
      statusColor={item.statusColor}
      rightAccessory={showSelection ? <SelectionIndicator selected={item.selected} /> : undefined}
    >
      {item.tags.map((tag) => (
        <Tag
          key={`${item.id}-${tag.label}`}
          label={tag.label}
          color={tag.color}
          textStyle={tag.color ? styles.coloredTagText : undefined}
        />
      ))}
    </EntityRow>
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.content}
    />
  );
}

function SelectionIndicator({ selected }: { selected?: boolean }) {
  return (
    <View style={[styles.selection, selected ? styles.selectionActive : undefined]}>
      {selected ? <View style={styles.selectionDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  separator: {
    height: 12,
  },
  coloredTagText: {
    color: '#fff',
  },
  selection: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#CBD5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionActive: {
    borderColor: '#2563EB',
  },
  selectionDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563EB',
  },
});
