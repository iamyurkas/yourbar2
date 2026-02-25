import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React, { useCallback } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import type { DialogOptions } from '@/components/AppDialog';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';
import { useI18n } from '@/libs/i18n/use-i18n';

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
};

export function TabBarButton({ onOpenDialog, ...props }: TabBarButtonProps) {
  const { t } = useI18n();
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

  return <HapticTab {...props} onPress={handlePress} />;
}
