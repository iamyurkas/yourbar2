import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ImageSource } from "expo-image";
import { type ComponentProps } from "react";

import ShakerIcon from "@/assets/images/shaker.svg";

export type CocktailMethod = {
  id: CocktailMethodId;
  label: string;
  title: string;
  description: string;
};

export type MethodIcon =
  | {
      type: "icon";
      name: ComponentProps<typeof MaterialCommunityIcons>["name"];
    }
  | { type: "asset"; source: ImageSource };

export const COCKTAIL_METHODS: CocktailMethod[] = [
  {
    id: "blend",
    label: "Blend",
    title: "Blend",
    description: "Blend with crushed ice into a frozen texture.",
  },
  {
    id: "muddle",
    label: "Muddle",
    title: "Muddle",
    description: "Press fruit, berries, or herbs to release oils and juice.",
  },
  {
    id: "heat",
    label: "Heat",
    title: "Heat",
    description: "Warm ingredients gently to blend flavors without boiling.",
  },
  {
    id: "shake",
    label: "Shake",
    title: "Shake",
    description:
      "Shake with ice. Best for citrus, syrup, cream, or egg white to aerate and chill.",
  },
  {
    id: "stir",
    label: "Stir",
    title: "Stir",
    description:
      "Stir with a bar spoon in a mixing glass full of ice. Best for herbal mixers.",
  },
  {
    id: "throw",
    label: "Throw",
    title: "Throw",
    description:
      "Pour between tins from a distance to aerate without cloudiness.",
  },
  {
    id: "build",
    label: "Build",
    title: "Build",
    description: "Pour ingredients directly into the serving glass.",
  },
  {
    id: "layer",
    label: "Layer",
    title: "Layer",
    description:
      "Float ingredients in layers using a bar spoon for visual effect.",
  },
];

export function getCocktailMethods(): CocktailMethod[] {
  return COCKTAIL_METHODS;
}

export const METHOD_ICON_MAP = {
  blend: { type: "icon", name: "blender" },
  muddle: { type: "icon", name: "sign-pole" },
  shake: { type: "asset", source: ShakerIcon },
  stir: { type: "icon", name: "delete-variant" },
  throw: { type: "icon", name: "swap-horizontal" },
  build: { type: "icon", name: "beer" },
  layer: { type: "icon", name: "layers" },
  heat: { type: "icon", name: "fire" },
} as const satisfies Record<string, MethodIcon>;

export type CocktailMethodId = keyof typeof METHOD_ICON_MAP;

export function getCocktailMethodById(
  id?: string | null,
): CocktailMethod | undefined {
  if (!id) {
    return undefined;
  }
  return getCocktailMethods().find((method) => method.id === id);
}
