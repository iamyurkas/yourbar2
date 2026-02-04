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
  const { height } = useWindowDimensions();

  const steps = useMemo<StepDef[]>(() => [
    {
      id: 1,
      message: 'Ласкаво просимо! Давайте познайомимося з додатком. Спочатку додамо інгредієнти.',
      buttonLabel: 'Почати',
    },
    {
      id: 2,
      message: 'Перейдіть на вкладку Інгредієнти.',
      anchorName: 'tab-ingredients',
      autoNext: (_, path) => path.startsWith('/ingredients'),
    },
    {
      id: 3,
      message: 'Виберіть вкладку "Усі", щоб побачити доступні інгредієнти.',
      anchorName: 'ingredients-tab-all',
      buttonLabel: 'Далі',
    },
    {
      id: 4,
      message: 'Натисніть на галочку, щоб додату Cola до вашого бару.',
      anchorName: 'ingredient-111',
      autoNext: (inv) => inv.availableIngredientIds.has(111),
    },
    {
      id: 5,
      message: 'Тепер додайте Ice.',
      anchorName: 'ingredient-193',
      autoNext: (inv) => inv.availableIngredientIds.has(193),
    },
    {
      id: 6,
      message: 'І Spiced Rum.',
      anchorName: 'ingredient-315',
      autoNext: (inv) => inv.availableIngredientIds.has(315),
    },
    {
      id: 7,
      message: 'Чудово! Тепер перейдіть на вкладку "Мої", щоб побачити ваш інвентар.',
      anchorName: 'ingredients-tab-my',
      buttonLabel: 'Далі',
    },
    {
      id: 8,
      message: 'Тут відображаються ваші інгредієнти. Також видно, скільки коктейлів можна приготувати з кожним із них.',
      buttonLabel: 'Далі',
    },
    {
      id: 9,
      message: 'Тепер поглянемо на коктейлі. Перейдіть на вкладку Коктейлі.',
      anchorName: 'tab-cocktails',
      autoNext: (_, path) => path.startsWith('/cocktails'),
    },
    {
      id: 10,
      message: 'Перейдіть на вкладку "Мої".',
      anchorName: 'cocktails-tab-my',
      buttonLabel: 'Далі',
    },
    {
      id: 11,
      message: 'Коктейлі, які ви можете приготувати прямо зараз, відображаються вгорі.',
      buttonLabel: 'Далі',
    },
    {
      id: 12,
      message: 'Нижче ви знайдете коктейлі, для яких не вистачає лише одного інгредієнта.',
      buttonLabel: 'Далі',
    },
    {
      id: 13,
      message: 'Нарешті, поглянемо на Шейкер. Він допомагає підібрати рецепти за вибраними інгредієнтами.',
      anchorName: 'tab-shaker',
      autoNext: (_, path) => path.startsWith('/shaker'),
    },
    {
      id: 14,
      message: 'Принцип роботи Шейкера: інгредієнти в межах однієї категорії взаємозамінні (OR), з різних категорій — обов’язкові (AND). Приклад: (Gin OR Whiskey) AND (Cola OR Tonic).',
      buttonLabel: 'Далі',
    },
    {
      id: 15,
      message: 'Цей перемикач фільтрує інгредієнти за вашою наявністю.',
      anchorName: 'shaker-availability-toggle',
      buttonLabel: 'Далі',
    },
    {
      id: 16,
      message: 'Ви готові! Насолоджуйтесь вашими коктейлями!',
      buttonLabel: 'Завершити',
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

  const handleNext = () => {
    if (onboardingStep >= steps.length) {
      completeOnboarding();
    } else {
      setOnboardingStep(onboardingStep + 1);
    }
  };

  const tooltipTop = anchor
    ? (anchor.y + anchor.height + 20 > height - 150 ? anchor.y - 120 : anchor.y + anchor.height + 10)
    : height / 2 - 50;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="mask">
            <Rect height="100%" width="100%" fill="white" />
            {anchor && (
              <Rect
                x={anchor.x - 4}
                y={anchor.y - 4}
                width={anchor.width + 8}
                height={anchor.height + 8}
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
