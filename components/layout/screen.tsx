import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';

type ScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
};

export function Screen({ children, style, edges }: ScreenProps) {
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor }, style]} edges={edges ?? ['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}
