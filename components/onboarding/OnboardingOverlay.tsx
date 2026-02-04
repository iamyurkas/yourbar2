import { useAppColors } from '@/constants/theme';
import { useInventory } from '@/providers/inventory-provider';
import { usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useOnboardingAnchors } from './OnboardingContext';

type StepDef = {
  id: number;
  message: string;
  anchorName?: string;
  autoNext?: (inventory: any, pathname: string) => boolean;
  buttonLabel?: string;
  onNext?: (inventory: any, requestTabChange: (screen: 'ingredients' | 'cocktails', tab: string) => void) => void;
  onEnter?: (inventory: any, requestTabChange: (screen: 'ingredients' | 'cocktails', tab: string) => void) => void;
};

const renderFormattedMessage = (message: string) => {
  const segments: Array<{ text: string; bold: boolean; italic: boolean }> = [];
  let buffer = '';
  let bold = false;
  let italic = false;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      segments.push({ text: buffer, bold, italic });
      buffer = '';
    }
  };

  for (let i = 0; i < message.length; i += 1) {
    if (message.startsWith('**', i)) {
      flushBuffer();
      bold = !bold;
      i += 1;
      continue;
    }

    if (message[i] === '*') {
      flushBuffer();
      italic = !italic;
      continue;
    }

    buffer += message[i];
  }

  flushBuffer();

  return segments.map((segment, index) => (
    <Text
      key={`${segment.text}-${index}`}
      style={[
        segment.bold && styles.boldText,
        segment.italic && styles.italicText,
      ]}
    >
      {segment.text}
    </Text>
  ));
};

export function OnboardingOverlay() {
  const { onboardingStep, setOnboardingStep, completeOnboarding, onboardingCompleted, ...inventory } = useInventory();
  const { anchors, requestTabChange } = useOnboardingAnchors();
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
      message: '**Welcome!**\nLet’s set up your bar by adding a few ingredients.',
      buttonLabel: 'Start',
    },
    {
      id: 2,
      message: 'Head to the **Ingredients** screen to begin.',
      anchorName: 'tab-ingredients',
      autoNext: (_, path) => path.startsWith('/ingredients'),
      onEnter: (inv) => {
        const availableIds = inv.availableIngredientIds as Set<number> | undefined;
        const idsToSeed = [193, 159, 343, 111, 333, 214, 222];
        const hasAll =
          availableIds && idsToSeed.every((id) => availableIds.has(id));
        if (hasAll) {
          return;
        }

        inv.setIngredientAvailability(193, true); // Ice
        inv.setIngredientAvailability(159, true); // Gin
        inv.setIngredientAvailability(343, true); // Whiskey
        inv.setIngredientAvailability(111, true); // Cola
        inv.setIngredientAvailability(333, true); // Tonic
        inv.setIngredientAvailability(214, true); // Lemon
        inv.setIngredientAvailability(222, true); // Lime
      },
    },
    {
      id: 3,
      message: 'This is the full ingredients list.\nWe’ve already marked a few common ones for you.',
      anchorName: 'ingredients-tab-all',
      buttonLabel: 'Next',
    },
    {
      id: 4,
      message: '**My ingredients** shows what you have.\nYou’ll also see in how many cocktails each ingredient is used.',
      anchorName: 'ingredients-tab-my',
      buttonLabel: 'Next',
      onEnter: (_, requestTab) => {
        requestTab('ingredients', 'my');
      },
    },
    {
      id: 5,
      message: 'Now let’s check the cocktails.\nOpen the **Cocktails** screen.',
      anchorName: 'tab-cocktails',
      autoNext: (_, path) => path.startsWith('/cocktails'),
    },
    {
      id: 6,
      message: 'Drinks you can make right now are on the top of **My cocktails** .\n\nCocktails missing just one ingredient are below.',
      buttonLabel: 'Next',
      onEnter: (_, requestTab) => {
        requestTab('cocktails', 'my');
      },
    },
    {
      id: 7,
      message: 'Finally, meet the **Shaker**.\nIt helps you find cocktails based on selected ingredients.',
      anchorName: 'tab-shaker',
      autoNext: (_, path) => path.startsWith('/shaker'),
    },
    {
      id: 8,
      message: '**Shaker logic**\nIngredients in the same category can replace each other (*OR*).\nIngredients from different categories are required together (*AND*).\n\n**Example**\n(Gin *OR* Whiskey) AND (Cola *OR* Tonic) AND (Lemon *OR* Lime).',
      buttonLabel: 'Next',
    },
    {
      id: 9,
      message: 'This toggle filters ingredients by availability.',
      anchorName: 'shaker-availability-toggle',
      buttonLabel: 'Next',
    },
    {
      id: 10,
      message: 'Select the ingredients you want to use, then tap **Show** to see matching cocktails.\n\nCheers! 🍸',
      buttonLabel: 'Finish',
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
    currentStep.onEnter(inventory, requestTabChange);
  }, [onboardingStep, onboardingCompleted, currentStep, inventory, requestTabChange]);

  if (onboardingCompleted || !onboardingStep || onboardingStep <= 0 || !currentStep) return null;

  const anchor = currentStep.anchorName ? anchors[currentStep.anchorName] : null;
  const isShakerTabHighlight = currentStep.anchorName === 'tab-shaker';
  const highlightPaddingX = isShakerTabHighlight ? 14 : 4;
  const highlightPaddingY = 4;
  const highlightRadius = isShakerTabHighlight ? 0 : 8;
  const adjustedAnchor = anchor ? {
    ...anchor,
    x: anchor.x - overlayOffset.x,
    y: anchor.y - overlayOffset.y,
  } : null;

  const handleNext = () => {
    if (currentStep?.onNext) {
      currentStep.onNext(inventory, requestTabChange);
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
  const adjustedTooltipTop = tooltipTop - 20;

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
                x={adjustedAnchor.x - highlightPaddingX}
                y={adjustedAnchor.y - highlightPaddingY}
                width={adjustedAnchor.width + highlightPaddingX * 2}
                height={adjustedAnchor.height + highlightPaddingY * 2}
                rx={highlightRadius}
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

      <View style={[styles.tooltip, { top: adjustedTooltipTop, backgroundColor: Colors.surface, borderColor: Colors.outline }]}>
        <Text style={[styles.message, { color: Colors.onSurface }]}>
          {renderFormattedMessage(currentStep.message)}
        </Text>
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
  boldText: {
    fontWeight: '700',
  },
  italicText: {
    fontStyle: 'italic',
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
