import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlatList, ListRenderItemInfo, StyleSheet, View } from 'react-native';

import { Tag } from '@/components/ui/tag';
import { EntityRow } from '@/features/shared/components/entity-row';

export type CocktailListItem = {
  id: string;
  name: string;
  missing?: string;
  detail?: string;
  accentColor?: string;
  badgeColor?: string;
  isFavorite?: boolean;
  tags: { label: string; color?: string }[];
};

type Props = {
  data: CocktailListItem[];
};

export function CocktailList({ data }: Props) {
  const renderItem = ({ item }: ListRenderItemInfo<CocktailListItem>) => (
    <EntityRow
      title={item.name}
      subtitle={item.missing}
      detail={item.detail}
      thumbnailColor={item.accentColor}
      statusColor={item.badgeColor}
      rightAccessory={
        item.isFavorite ? (
          <MaterialCommunityIcons name="star" size={20} color="#F5B301" />
        ) : undefined
      }
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
});
