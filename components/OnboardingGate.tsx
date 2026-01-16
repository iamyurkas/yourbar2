import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';

import { useOnboarding } from '@/providers/onboarding-provider';

export function OnboardingGate() {
  const { isOnboardingActive } = useOnboarding();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isOnboardingActive) {
      return;
    }

    if (pathname !== '/onboarding') {
      router.push('/onboarding');
    }
  }, [isOnboardingActive, pathname, router]);

  return null;
}
