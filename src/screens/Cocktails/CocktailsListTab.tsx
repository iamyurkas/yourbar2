import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ListRow } from '@components/ListRow';
import { SearchBar } from '@components/SearchBar';
import { cocktails } from '@data/mockCocktails';
import { spacing } from '@theme/spacing';

interface CocktailsListTabProps {
  filter: string;
}

export const CocktailsListTab: React.FC<CocktailsListTabProps> = ({ filter }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const base = cocktails.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
    if (filter === 'All') return base;
    if (filter === 'My') return base.filter((item) => Number(item.id) % 2 === 1);
    if (filter === 'Favorites') return base.filter((item) => Number(item.id) % 2 === 0);
    return base;
  }, [filter, query]);

  return (
    <View style={styles.container}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search cocktails" />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.missingIngredients} missing ingredients`}
            detail={item.description}
            status={item.status}
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
