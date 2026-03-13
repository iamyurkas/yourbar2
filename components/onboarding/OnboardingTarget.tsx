import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { OnboardingTargetId } from '@/libs/onboarding-config';
import { useOnboardingTarget } from '@/providers/onboarding-provider';

export function OnboardingTarget({
  targetId,
  children,
  style,
}: {
  targetId?: OnboardingTargetId;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const targetProps = useOnboardingTarget(targetId);

  if (!targetId) {
    return <>{children}</>;
  }

  return <View {...targetProps} style={style}>{children}</View>;
}
