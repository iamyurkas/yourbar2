import React from 'react';
import { FlatList, type FlatListProps } from 'react-native';

export type FlashListProps<ItemT> = FlatListProps<ItemT> & {
  estimatedItemSize?: number;
};

export function FlashList<ItemT>(props: FlashListProps<ItemT>) {
  const { estimatedItemSize: _estimated, ...rest } = props;
  return <FlatList {...rest} />;
}
