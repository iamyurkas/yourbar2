import { ReactNode, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  PressableStateCallbackType,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type SlidingTabConfig = {
  key: string;
  title: string;
  render: () => ReactNode;
};

type SlidingTabsProps = {
  tabs: SlidingTabConfig[];
};

export function SlidingTabs({ tabs }: SlidingTabsProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);
  const [tabLayouts, setTabLayouts] = useState<Record<number, { x: number; width: number }>>({});

  const tabBackground = useThemeColor({ light: '#F2F4F7', dark: '#1F2933' }, 'background');
  const activeColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    scrollRef.current?.scrollTo({ x: index * containerWidth, animated: true });
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!containerWidth) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const indicatorStyle = useMemo(() => {
    const layout = tabLayouts[activeIndex];
    if (!layout) return undefined;
    return {
      left: layout.x,
      width: layout.width,
    };
  }, [activeIndex, tabLayouts]);

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <View style={[styles.tabBar, { backgroundColor: tabBackground }]}> 
        {tabs.map((tab, index) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            onPress={() => handleTabPress(index)}
            style={({ pressed }: PressableStateCallbackType) => [
              styles.tabButtonWrapper,
              pressed && styles.tabButtonPressed,
            ]}
            onLayout={(event) => {
              setTabLayouts((layouts) => ({
                ...layouts,
                [index]: {
                  x: event.nativeEvent.layout.x,
                  width: event.nativeEvent.layout.width,
                },
              }));
            }}
          >
            <ThemedText
              type="defaultSemiBold"
              style={[
                styles.tabButton,
                { color: index === activeIndex ? activeColor : textColor },
              ]}
            >
              {tab.title}
            </ThemedText>
          </Pressable>
        ))}
        <View style={[styles.indicator, indicatorStyle, { backgroundColor: activeColor }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.pager}
      >
        {tabs.map((tab) => (
          <View key={tab.key} style={[styles.page, { width: containerWidth }]}> 
            {tab.render()}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    position: 'relative',
    borderRadius: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 4,
    overflow: 'hidden',
  },
  tabButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabButtonPressed: {
    opacity: 0.7,
  },
  tabButton: {
    fontSize: 16,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 12,
    zIndex: -1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
