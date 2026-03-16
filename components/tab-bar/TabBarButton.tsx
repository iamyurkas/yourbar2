import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useSegments } from 'expo-router';
import React, { useCallback } from 'react';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import type { DialogOptions } from '@/components/AppDialog';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';
import { useI18n } from '@/libs/i18n/use-i18n';
import { useOnboardingTarget } from '@/providers/onboarding-provider';
import type { OnboardingTargetId } from '@/libs/onboarding-config';
import type { AppTabName } from '@/providers/unsaved-changes-provider';

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
  onboardingTargetId?: OnboardingTargetId;
};

type TabBarPressEvent = Parameters<NonNullable<BottomTabBarButtonProps['onPress']>>[0];

export function TabBarButton({ onOpenDialog, onboardingTargetId, ...props }: TabBarButtonProps) {
  const segments = useSegments();
  const { t } = useI18n();
  const {
    saveHandler,
    shouldBlockTabSwitch,
    resetUnsavedChanges,
  } = useUnsavedChanges();

  const activeTab = segments.find((segment): segment is AppTabName => (
    segment === 'cocktails' || segment === 'ingredients' || segment === 'shaker'
  )) ?? null;

  const handlePress = useCallback((event: TabBarPressEvent) => {
    const proceed = () => {
      resetUnsavedChanges();
      props.onPress?.(event);
    };

    if (shouldBlockTabSwitch(activeTab)) {
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
    activeTab,
    onOpenDialog,
    props,
    resetUnsavedChanges,
    saveHandler,
    shouldBlockTabSwitch,
    t,
  ]);

  const onboardingTargetProps = useOnboardingTarget(onboardingTargetId);

  return (
    <View {...onboardingTargetProps}>
      <HapticTab {...props} onPress={handlePress} />
    </View>
  );
}
