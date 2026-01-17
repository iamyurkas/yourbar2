import type { useInventory } from '@/providers/inventory-provider';

export type OnboardingContext = {
  router: {
    replace: (href: string) => void;
    push: (href: string) => void;
  };
  inventory: ReturnType<typeof useInventory>;
};

export type OnboardingStep = {
  id: string;
  targetId: string;
  title?: string;
  description: string;
  nextLabel?: string;
  backLabel?: string;
  onEnter?: (context: OnboardingContext) => void | Promise<void>;
  onNext?: (context: OnboardingContext) => void | Promise<void>;
};
