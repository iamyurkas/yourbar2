import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import { CocktailsListTab } from './CocktailsListTab';
import { FloatingActionButton } from '@components/FloatingActionButton';
import { cocktailTabs } from '@data/tagCategories';
import { palette } from '@theme/colors';
import { CocktailsStackParamList } from './CocktailsNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const TopTabs = createMaterialTopTabNavigator();

type NavigationProp = NativeStackNavigationProp<CocktailsStackParamList>;

export const CocktailsHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <TopTabs.Navigator
        screenOptions={{
          tabBarIndicatorStyle: { backgroundColor: palette.primary },
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.muted,
          tabBarScrollEnabled: false,
        }}
      >
        {cocktailTabs.map((tab) => (
          <TopTabs.Screen
            key={tab}
            name={tab}
            children={() => <CocktailsListTab filter={tab} />}
          />
        ))}
      </TopTabs.Navigator>
      <FloatingActionButton label="Add" onPress={() => navigation.navigate('AddCocktail')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
