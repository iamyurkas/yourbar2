import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React, { useCallback } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import type { DialogOptions } from '@/components/AppDialog';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
};

export function TabBarButton({ onOpenDialog, ...props }: TabBarButtonProps) {
  const {
    hasUnsavedChanges,
    requireLeaveConfirmation,
    saveHandler,
    setHasUnsavedChanges,
    setRequireLeaveConfirmation,
  } = useUnsavedChanges();
  const handlePress = useCallback(() => {
    const proceed = () => {
      setHasUnsavedChanges(false);
      setRequireLeaveConfirmation(false);
      props.onPress?.();
    };

    if (hasUnsavedChanges || requireLeaveConfirmation) {
      onOpenDialog({
        title: 'Leave without saving?',
        message: 'Your changes will be lost if you leave this screen.',
        actions: [
          { label: 'Save', variant: 'primary', onPress: saveHandler ?? undefined },
          { label: 'Stay', variant: 'secondary' },
          { label: 'Leave', variant: 'destructive', onPress: proceed },
        ],
      });
      return;
    }

    proceed();
  }, [
    hasUnsavedChanges,
    onOpenDialog,
    props,
    requireLeaveConfirmation,
    saveHandler,
    setHasUnsavedChanges,
    setRequireLeaveConfirmation,
  ]);

  return <HapticTab {...props} onPress={handlePress} />;
}
