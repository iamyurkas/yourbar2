import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import { FloatingActionButton } from '@components/FloatingActionButton';
import { ingredientTabs } from '@data/tagCategories';
import { palette } from '@theme/colors';
import { IngredientsListTab } from './IngredientsListTab';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { IngredientsStackParamList } from './IngredientsNavigator';

const TopTabs = createMaterialTopTabNavigator();

type NavigationProp = NativeStackNavigationProp<IngredientsStackParamList>;

export const IngredientsHomeScreen: React.FC = () => {
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
        {ingredientTabs.map((tab) => (
          <TopTabs.Screen
            key={tab}
            name={tab}
            children={() => <IngredientsListTab filter={tab} />}
          />
        ))}
      </TopTabs.Navigator>
      <FloatingActionButton label="Add" onPress={() => navigation.navigate('AddIngredient')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
