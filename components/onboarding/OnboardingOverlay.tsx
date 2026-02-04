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
};

export function OnboardingOverlay() {
  const { onboardingStep, setOnboardingStep, completeOnboarding, ...inventory } = useInventory();
  const { anchors } = useOnboardingAnchors();
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
      message: 'Welcome! Let\'s learn how to use the app. First, let\'s add some ingredients.',
      buttonLabel: 'Start',
    },
    {
      id: 2,
      message: 'Go to the Ingredients tab.',
      anchorName: 'tab-ingredients',
      autoNext: (_, path) => path.startsWith('/ingredients'),
    },
    {
      id: 3,
      message: 'Select the "All" tab to see all available ingredients.',
      anchorName: 'ingredients-tab-all',
      buttonLabel: 'Next',
    },
    {
      id: 4,
      message: 'Tap the checkmark to add Cola to your inventory.',
      anchorName: 'ingredient-111',
      autoNext: (inv) => inv.availableIngredientIds.has(111),
    },
    {
      id: 5,
      message: 'Now add some Ice.',
      anchorName: 'ingredient-193',
      autoNext: (inv) => inv.availableIngredientIds.has(193),
    },
    {
      id: 6,
      message: 'And some Spiced Rum.',
      anchorName: 'ingredient-315',
      autoNext: (inv) => inv.availableIngredientIds.has(315),
    },
    {
      id: 7,
      message: 'Great! Now go to the "My" tab to see your inventory.',
      anchorName: 'ingredients-tab-my',
      buttonLabel: 'Next',
    },
    {
      id: 8,
      message: 'Here you can see the ingredients you have. You can also see how many cocktails can be made with each.',
      buttonLabel: 'Next',
    },
    {
      id: 9,
      message: 'Now let\'s check the cocktails. Go to the Cocktails tab.',
      anchorName: 'tab-cocktails',
      autoNext: (_, path) => path.startsWith('/cocktails'),
    },
    {
      id: 10,
      message: 'Go to the "My" tab.',
      anchorName: 'cocktails-tab-my',
      buttonLabel: 'Next',
    },
    {
      id: 11,
      message: 'Cocktails you can make right now are shown at the top.',
      buttonLabel: 'Next',
    },
    {
      id: 12,
      message: 'Below you will find cocktails where you are missing just one ingredient.',
      buttonLabel: 'Next',
    },
    {
      id: 13,
      message: 'Finally, let\'s look at the Shaker. It helps you find recipes based on selected ingredients.',
      anchorName: 'tab-shaker',
      autoNext: (_, path) => path.startsWith('/shaker'),
    },
    {
      id: 14,
      message: 'Shaker logic: ingredients within one category are interchangeable (OR), from different categories — mandatory (AND). Example: (Gin OR Whiskey) AND (Cola OR Tonic) AND (Lemon OR Lime).',
      buttonLabel: 'Next',
    },
    {
      id: 15,
      message: 'This toggle filters ingredients by your availability.',
      anchorName: 'shaker-availability-toggle',
      buttonLabel: 'Next',
    },
    {
      id: 16,
      message: 'You\'re ready! Enjoy your cocktails!',
      buttonLabel: 'Finish',
    },
  ], []);

  const currentStep = steps.find(s => s.id === onboardingStep);

  // Auto-advance logic
  React.useEffect(() => {
    if (currentStep?.autoNext?.(inventory, pathname)) {
      setOnboardingStep(onboardingStep + 1);
    }
  }, [currentStep, inventory, pathname, onboardingStep, setOnboardingStep]);

  if (!onboardingStep || onboardingStep <= 0 || !currentStep) return null;

  const anchor = currentStep.anchorName ? anchors[currentStep.anchorName] : null;
  const adjustedAnchor = anchor ? {
    ...anchor,
    x: anchor.x - overlayOffset.x,
    y: anchor.y - overlayOffset.y,
  } : null;

  const handleNext = () => {
    if (onboardingStep >= steps.length) {
      completeOnboarding();
    } else {
      setOnboardingStep(onboardingStep + 1);
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
                x={adjustedAnchor.x - 4}
                y={adjustedAnchor.y - 4}
                width={adjustedAnchor.width + 8}
                height={adjustedAnchor.height + 8}
                rx={8}
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
          <Pressable
            style={[styles.button, { backgroundColor: Colors.primary }]}
            onPress={handleNext}
          >
            <Text style={[styles.buttonText, { color: Colors.onPrimary }]}>{currentStep.buttonLabel}</Text>
          </Pressable>
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
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
