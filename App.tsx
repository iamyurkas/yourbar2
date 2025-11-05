import React from 'react';
import { StatusBar } from 'react-native';
import { RootNavigator } from '@navigation/RootNavigator';
import 'react-native-gesture-handler';

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <RootNavigator />
    </>
  );
}
