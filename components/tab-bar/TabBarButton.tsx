import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import type { DialogOptions } from '@/components/AppDialog';

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
};

export function TabBarButton({ onOpenDialog, ...props }: TabBarButtonProps) {
  return <HapticTab {...props} />;
}
