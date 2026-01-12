import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import type { DialogOptions } from '@/components/AppDialog';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';

const EDITING_PATH_PATTERN = /^\/(cocktails\/create|ingredients\/create|ingredients\/[^/]+\/edit)(\/|$)/;

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
};

export function TabBarButton({ onOpenDialog, ...props }: TabBarButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const isEditingRoute = EDITING_PATH_PATTERN.test(pathname);

  const handlePress = useCallback(() => {
    const proceed = () => {
      if (isEditingRoute) {
        if (pathname.startsWith('/cocktails')) {
          router.replace('/cocktails');
        } else if (pathname.startsWith('/ingredients')) {
          router.replace('/ingredients');
        } else if (pathname.startsWith('/shaker')) {
          router.replace('/shaker');
        }
      }
      setHasUnsavedChanges(false);
      props.onPress?.();
    };

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
  }, [hasUnsavedChanges, isEditingRoute, onOpenDialog, pathname, props, router, setHasUnsavedChanges]);

  return <HapticTab {...props} onPress={handlePress} />;
}
