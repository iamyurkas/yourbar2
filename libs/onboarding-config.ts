export type OnboardingTargetId =
  | 'tab-ingredients'
  | 'ingredients-tab-all'
  | 'ingredients-tab-my'
  | 'tab-cocktails'
  | 'cocktails-tab-my'
  | 'tab-shaker'
  | 'shaker-availability-toggle';

export type OnboardingStepConfig = {
  stepId: number;
  messageId: string;
  ctaLabelKey: 'onboarding.start' | 'onboarding.next' | 'onboarding.finish';
  targetId?: OnboardingTargetId;
  navigateTo?: '/ingredients' | '/cocktails' | '/shaker';
  activateControl?: 'ingredients-all' | 'ingredients-my' | 'cocktails-my' | 'shaker-in-stock' | 'shaker-in-stock-on';
};

export const ONBOARDING_STARTER_INGREDIENT_IDS = [196, 161, 352, 114, 316, 339, 219, 227] as const;

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { stepId: 1, messageId: 'onboarding.step1.message', ctaLabelKey: 'onboarding.start' },
  {
    stepId: 2,
    messageId: 'onboarding.step2.message',
    ctaLabelKey: 'onboarding.next',
    targetId: 'tab-ingredients',
    navigateTo: '/ingredients',
  },
  {
    stepId: 3,
    messageId: 'onboarding.step3.message',
    ctaLabelKey: 'onboarding.next',
    targetId: 'ingredients-tab-all',
    navigateTo: '/ingredients',
    activateControl: 'ingredients-all',
  },
  {
    stepId: 4,
    messageId: 'onboarding.step4.message',
    ctaLabelKey: 'onboarding.next',
    targetId: 'ingredients-tab-my',
    navigateTo: '/ingredients',
    activateControl: 'ingredients-my',
  },
  {
    stepId: 5,
    messageId: 'onboarding.step5.message',
    ctaLabelKey: 'onboarding.next',
    targetId: 'tab-cocktails',
    navigateTo: '/cocktails',
  },
  {
    stepId: 6,
    messageId: 'onboarding.step6.message',
    ctaLabelKey: 'onboarding.next',
    targetId: 'cocktails-tab-my',
    navigateTo: '/cocktails',
    activateControl: 'cocktails-my',
  },
  {
    stepId: 7,
    messageId: 'onboarding.step7.message',
    ctaLabelKey: 'onboarding.next',
    targetId: 'tab-shaker',
    navigateTo: '/shaker',
  },
  { stepId: 8, messageId: 'onboarding.step8.message', ctaLabelKey: 'onboarding.next', navigateTo: '/shaker' },
  {
    stepId: 9,
    messageId: 'onboarding.step9.message',
    ctaLabelKey: 'onboarding.next',
    targetId: 'shaker-availability-toggle',
    navigateTo: '/shaker',
  },
  { stepId: 10, messageId: 'onboarding.step10.message', ctaLabelKey: 'onboarding.next', navigateTo: '/shaker' },
  {
    stepId: 11,
    messageId: 'onboarding.step11.message',
    ctaLabelKey: 'onboarding.finish',
    targetId: 'ingredients-tab-all',
    navigateTo: '/ingredients',
    activateControl: 'ingredients-all',
  },
];
