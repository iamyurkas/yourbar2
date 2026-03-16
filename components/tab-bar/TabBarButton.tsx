import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useCallback } from 'react';
import { View } from 'react-native';

import type { DialogOptions } from '@/components/AppDialog';
import { HapticTab } from '@/components/haptic-tab';
import { useI18n } from '@/libs/i18n/use-i18n';
import type { OnboardingTargetId } from '@/libs/onboarding-config';
import { useOnboardingTarget } from '@/providers/onboarding-provider';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';

type TabBarButtonProps = BottomTabBarButtonProps & {
  onOpenDialog: (options: DialogOptions) => void;
  onboardingTargetId?: OnboardingTargetId;
};

type TabBarPressEvent = Parameters<NonNullable<BottomTabBarButtonProps['onPress']>>[0];

export function TabBarButton({ onOpenDialog, onboardingTargetId, ...props }: TabBarButtonProps) {
  const { t } = useI18n();
  const {
    hasUnsavedChanges,
    requireLeaveConfirmation,
    saveHandler,
    setHasUnsavedChanges,
    setRequireLeaveConfirmation,
    markSkipNextLeaveConfirmation,
  } = useUnsavedChanges();
  const handlePress = useCallback((event: TabBarPressEvent) => {
    const proceed = () => {
      markSkipNextLeaveConfirmation();
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
    markSkipNextLeaveConfirmation,
    setHasUnsavedChanges,
    setRequireLeaveConfirmation,
    t,
  ]);

  const onboardingTargetProps = useOnboardingTarget(onboardingTargetId);

  return (
    <View {...onboardingTargetProps}>
      <HapticTab {...props} onPress={handlePress} />
    </View>
  );
}
