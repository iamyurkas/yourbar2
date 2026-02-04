import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ImageSource } from "expo-image";
import { type ComponentProps } from "react";

import ShakerIcon from "@/assets/images/shaker.svg";
import i18n from "@/libs/i18n";

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

export function getCocktailMethods(): CocktailMethod[] {
  return [
    {
      id: "blend",
      label: i18n.t("methods.blend"),
      title: i18n.t("methods.blend"),
      description: i18n.t("methods.blend_desc"),
    },
    {
      id: "muddle",
      label: i18n.t("methods.muddle"),
      title: i18n.t("methods.muddle"),
      description: i18n.t("methods.muddle_desc"),
    },
    {
      id: "heat",
      label: i18n.t("methods.heat"),
      title: i18n.t("methods.heat"),
      description: i18n.t("methods.heat_desc"),
    },
    {
      id: "shake",
      label: i18n.t("methods.shake"),
      title: i18n.t("methods.shake"),
      description: i18n.t("methods.shake_desc"),
    },
    {
      id: "stir",
      label: i18n.t("methods.stir"),
      title: i18n.t("methods.stir"),
      description: i18n.t("methods.stir_desc"),
    },
    {
      id: "throw",
      label: i18n.t("methods.throw"),
      title: i18n.t("methods.throw"),
      description: i18n.t("methods.throw_desc"),
    },
    {
      id: "build",
      label: i18n.t("methods.build"),
      title: i18n.t("methods.build"),
      description: i18n.t("methods.build_desc"),
    },
    {
      id: "layer",
      label: i18n.t("methods.layer"),
      title: i18n.t("methods.layer"),
      description: i18n.t("methods.layer_desc"),
    },
  ];
}

export const METHOD_ICON_MAP = {
  blend: { type: "icon", name: "blender" },
  muddle: { type: "icon", name: "sign-pole" },
  shake: { type: "asset", source: ShakerIcon },
  stir: { type: "icon", name: "delete-variant" },
  throw: { type: "icon", name: "swap-vertical" },
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
