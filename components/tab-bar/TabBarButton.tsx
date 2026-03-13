import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React, { useCallback } from 'react';

import { PlatformPressable } from '@react-navigation/elements';
import type { DialogOptions } from '@/components/AppDialog';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';
import { useI18n } from '@/libs/i18n/use-i18n';

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
};

type TabBarPressEvent = Parameters<NonNullable<BottomTabBarButtonProps['onPress']>>[0];

export function TabBarButton({ onOpenDialog, ...props }: TabBarButtonProps) {
  const { t } = useI18n();
  const {
    hasUnsavedChanges,
    requireLeaveConfirmation,
    saveHandler,
    setHasUnsavedChanges,
    setRequireLeaveConfirmation,
  } = useUnsavedChanges();
  const handlePress = useCallback((event: TabBarPressEvent) => {
    const proceed = () => {
      setHasUnsavedChanges(false);
      setRequireLeaveConfirmation(false);
      props.onPress?.(event);
    };

    if (hasUnsavedChanges || requireLeaveConfirmation) {
      onOpenDialog({
        title: t("tabBar.leaveWithoutSavingTitle"),
        message: t("tabBar.leaveWithoutSavingMessage"),
        actions: [
          { label: t("common.save"), variant: "primary", onPress: saveHandler ?? undefined },
          { label: t("ingredientForm.stay"), variant: "secondary" },
          { label: t("ingredientForm.leave"), variant: "destructive", onPress: proceed },
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
    t,
  ]);

  return <PlatformPressable {...props} onPress={handlePress} pressOpacity={0.7} android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: false }} />;
}
