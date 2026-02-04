import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useInventory } from '@/providers/inventory-provider';
import { useOnboardingAnchors } from './OnboardingContext';
import { useAppColors } from '@/constants/theme';
import { usePathname } from 'expo-router';

type StepDef = {
  id: number;
  message: string;
  anchorName?: string;
  autoNext?: (inventory: any, pathname: string) => boolean;
  buttonLabel?: string;
  onNext?: (inventory: any, requestTabChange: (screen: 'ingredients' | 'cocktails', tab: string) => void, requestShakerChange: (action: 'set-in-stock' | 'expand-all', value: boolean) => void) => void;
  onEnter?: (inventory: any, requestTabChange: (screen: 'ingredients' | 'cocktails', tab: string) => void, requestShakerChange: (action: 'set-in-stock' | 'expand-all', value: boolean) => void) => void;
  highlightPadding?: { x: number; y: number };
};

export function OnboardingOverlay() {
  const { onboardingStep, setOnboardingStep, completeOnboarding, onboardingCompleted, ...inventory } = useInventory();
  const { anchors, requestTabChange, requestShakerChange } = useOnboardingAnchors();
  const Colors = useAppColors();
  const pathname = usePathname();
  const { height: screenHeight } = useWindowDimensions();
  const [overlayOffset, setOverlayOffset] = React.useState({ x: 0, y: 0 });
  const overlayRef = React.useRef<View>(null);

  const handleLayout = () => {
    overlayRef.current?.measureInWindow((x, y) => {
      if (x !== overlayOffset.x || y !== overlayOffset.y) {
        setOverlayOffset({ x, y });
      }
    });
  };

  const steps = useMemo<StepDef[]>(() => [
    {
      id: 1,
      message: "Welcome! Let's learn how to use the app. First, let's add some ingredients.",
      buttonLabel: 'Start',
    },
    {
      id: 2,
      message: 'Head to the "Ingredients" tab to begin.',
      anchorName: 'tab-ingredients',
      autoNext: (_, path) => path.startsWith('/ingredients'),
    },
    {
      id: 3,
      message: "Here’s the full ingredient list. We already marked a few ingredients as available.",
      anchorName: 'ingredients-tab-all',
      buttonLabel: 'Next',
      onNext: (inv, requestTab) => {
        inv.setIngredientAvailability(193, true); // Ice
        inv.setIngredientAvailability(159, true); // Gin
        inv.setIngredientAvailability(315, true); // Spiced Rum
        inv.setIngredientAvailability(111, true); // Cola
        inv.setIngredientAvailability(333, true); // Tonic
        inv.setIngredientAvailability(214, true); // Lemon
        inv.setIngredientAvailability(222, true); // Lime
        requestTab('ingredients', 'my');
      },
    },
    {
      id: 4,
      message: "Here are the ingredients you have. You’ll also see how many cocktails each one can be used in.",
      anchorName: 'ingredients-tab-my',
      buttonLabel: 'Next',
    },
    {
      id: 5,
      message: 'Now let’s check the cocktails. Open the "Cocktails" tab.',
      anchorName: 'tab-cocktails',
      autoNext: (_, path) => path.startsWith('/cocktails'),
    },
    {
      id: 6,
      message: "Cocktails you can make right now appear at the top of My cocktails.",
      anchorName: 'cocktails-tab-my',
      buttonLabel: 'Next',
      onEnter: (_, requestTab) => {
        requestTab('cocktails', 'my');
      },
    },
    {
      id: 7,
      message: "Below are cocktails missing just one ingredient.",
      buttonLabel: 'Next',
    },
    {
      id: 8,
      message: 'Finally, meet the "Shaker" — it helps you find cocktails based on selected ingredients.',
      anchorName: 'tab-shaker',
      buttonLabel: 'Finish',
      autoNext: (_, path) => path.startsWith('/shaker'),
      highlightPadding: { x: 20, y: 0 },
    },
  ], []);

  const currentStep = steps.find(s => s.id === onboardingStep);

  const countableSteps = useMemo(() => steps.filter(s => !!s.buttonLabel), [steps]);
  const totalCount = countableSteps.length;
  const currentStepIndex = countableSteps.findIndex(s => s.id === onboardingStep) + 1;

  // Auto-advance logic
  React.useEffect(() => {
    if (onboardingCompleted || !currentStep?.autoNext) return;
    if (currentStep.autoNext(inventory, pathname)) {
      const currentIndex = steps.findIndex(s => s.id === onboardingStep);
      if (currentIndex >= 0 && currentIndex < steps.length - 1) {
        setOnboardingStep(steps[currentIndex + 1].id);
      } else {
        completeOnboarding();
      }
    }
  }, [currentStep, inventory, pathname, onboardingStep, setOnboardingStep, onboardingCompleted, steps, completeOnboarding]);

  // Handle onEnter actions
  React.useEffect(() => {
    if (onboardingCompleted || !currentStep?.onEnter) return;
    currentStep.onEnter(inventory, requestTabChange, requestShakerChange);
  }, [onboardingStep, onboardingCompleted, currentStep, inventory, requestTabChange, requestShakerChange]);

  if (onboardingCompleted || !onboardingStep || onboardingStep <= 0 || !currentStep) return null;

  const anchor = currentStep.anchorName ? anchors[currentStep.anchorName] : null;
  const adjustedAnchor = anchor ? {
    ...anchor,
    x: anchor.x - overlayOffset.x,
    y: anchor.y - overlayOffset.y,
  } : null;

  const handleNext = () => {
    if (currentStep?.onNext) {
      currentStep.onNext(inventory, requestTabChange, requestShakerChange);
    }

    if (onboardingStep >= steps[steps.length - 1].id) {
      completeOnboarding();
    } else {
      // Find the next step in the array (skipping gaps if any)
      const currentIndex = steps.findIndex(s => s.id === onboardingStep);
      if (currentIndex >= 0 && currentIndex < steps.length - 1) {
        setOnboardingStep(steps[currentIndex + 1].id);
      } else {
        completeOnboarding();
      }
    }
  };

  const tooltipTop = adjustedAnchor
    ? (adjustedAnchor.y + adjustedAnchor.height + 20 > screenHeight - 150 ? adjustedAnchor.y - 120 : adjustedAnchor.y + adjustedAnchor.height + 10)
    : screenHeight / 2 - 100;

  return (
    <View
      ref={overlayRef}
      onLayout={handleLayout}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      collapsable={false}
    >
      <Svg
        height="100%"
        width="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <Mask id="mask">
            <Rect height="100%" width="100%" fill="white" />
            {adjustedAnchor && (
              <Rect
                x={adjustedAnchor.x - 4 - (currentStep.highlightPadding?.x ?? 0)}
                y={adjustedAnchor.y - 4 - (currentStep.highlightPadding?.y ?? 0)}
                width={adjustedAnchor.width + 8 + (currentStep.highlightPadding?.x ?? 0) * 2}
                height={adjustedAnchor.height + 8 + (currentStep.highlightPadding?.y ?? 0) * 2}
                rx={currentStep.highlightPadding ? 4 : 8}
                fill="black"
              />
            )}
          </Mask>
        </Defs>
        <Rect
          height="100%"
          width="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#mask)"
          pointerEvents="none"
        />
      </Svg>

      <View style={[styles.tooltip, { top: tooltipTop, backgroundColor: Colors.surface, borderColor: Colors.outline }]}>
        <Text style={[styles.message, { color: Colors.onSurface }]}>{currentStep.message}</Text>
        {currentStep.buttonLabel && (
          <>
            <Pressable
              style={[styles.button, { backgroundColor: Colors.primary }]}
              onPress={handleNext}
            >
              <Text style={[styles.buttonText, { color: Colors.onPrimary }]}>{currentStep.buttonLabel}</Text>
            </Pressable>
            <Text style={[styles.stepCounter, { color: Colors.onSurfaceVariant }]}>
              {currentStepIndex} of {totalCount}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    left: 20,
    right: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepCounter: {
    fontSize: 12,
    marginTop: 8,
    opacity: 0.8,
  },
});
