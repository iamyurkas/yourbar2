import React from 'react';
import { View } from 'react-native';

import type { OnboardingTargetId } from '@/libs/onboarding-config';
import { useOnboardingTarget } from '@/providers/onboarding-provider';

export function OnboardingTarget({ targetId, children }: { targetId?: OnboardingTargetId; children: React.ReactNode }) {
  const targetProps = useOnboardingTarget(targetId);

  if (!targetId) {
    return <>{children}</>;
  }

  return <View {...targetProps}>{children}</View>;
}
