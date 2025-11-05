import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ListRow } from '@components/ListRow';
import { SearchBar } from '@components/SearchBar';
import { ingredients } from '@data/mockIngredients';
import { spacing } from '@theme/spacing';

interface IngredientsListTabProps {
  filter: string;
}

export const IngredientsListTab: React.FC<IngredientsListTabProps> = ({ filter }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const base = ingredients.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
    if (filter === 'Shopping') return base.filter((item) => item.status !== 'ready');
    if (filter === 'My') return base.filter((item) => item.status === 'ready');
    return base;
  }, [filter, query]);

  return (
    <View style={styles.container}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search ingredients" />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.cocktailCount} cocktails`}
            detail={item.category}
            status={item.status}
            isSelected={item.status === 'ready'}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
});
