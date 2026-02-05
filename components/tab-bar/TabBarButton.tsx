import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React, { useCallback } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import type { DialogOptions } from '@/components/AppDialog';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
};

export function TabBarButton({ onOpenDialog, ...props }: TabBarButtonProps) {
  const { isEditingScreen, setHasUnsavedChanges, requestSave } = useUnsavedChanges();

  const handlePress = useCallback(() => {
    const proceed = () => {
      setHasUnsavedChanges(false);
      props.onPress?.();
    };

    if (isEditingScreen) {
      onOpenDialog({
        title: 'Leave without saving?',
        message: 'Your changes will be lost if you leave this screen.',
        actions: [
          { label: 'Save', onPress: requestSave },
          { label: 'Stay', variant: 'secondary' },
          { label: 'Leave', variant: 'destructive', onPress: proceed },
        ],
      });
      return;
    }

    proceed();
  }, [
    isEditingScreen,
    onOpenDialog,
    props,
    requestSave,
    setHasUnsavedChanges,
  ]);

  return <HapticTab {...props} onPress={handlePress} />;
}
