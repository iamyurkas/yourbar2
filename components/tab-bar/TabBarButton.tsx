import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import type { DialogOptions } from '@/components/AppDialog';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
};

export function TabBarButton({ onOpenDialog, ...props }: TabBarButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasUnsavedChanges, isEditing, requestSave, setHasUnsavedChanges } = useUnsavedChanges();

  const handlePress = useCallback(() => {
    const rootSegment = pathname.split('/').filter(Boolean)[0];
    const rootPath = rootSegment ? `/${rootSegment}` : '/';

    const proceed = () => {
      if (isEditing) {
        router.replace(rootPath);
      }
      setHasUnsavedChanges(false);
      props.onPress?.();
    };

    if (isEditing) {
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

    if (hasUnsavedChanges) {
      onOpenDialog({
        title: 'Leave without saving?',
        message: 'Your changes will be lost if you leave this screen.',
        actions: [
          { label: 'Stay', variant: 'secondary' },
          { label: 'Leave', variant: 'destructive', onPress: proceed },
        ],
      });
      return;
    }

    proceed();
  }, [
    hasUnsavedChanges,
    isEditing,
    onOpenDialog,
    pathname,
    props,
    requestSave,
    router,
    setHasUnsavedChanges,
  ]);

  return <HapticTab {...props} onPress={handlePress} />;
}
