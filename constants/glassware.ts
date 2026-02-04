import { glasswareUriById } from "@/assets/image-manifest";
import i18n from "@/libs/i18n";

export type GlasswareOption = {
  id: keyof typeof glasswareUriById;
  name: string;
  imageUri: string;
};

export function getGlassware(): GlasswareOption[] {
  return [
    { id: "bowl", name: i18n.t('glassware.bowl'), imageUri: glasswareUriById.bowl },
    {
      id: "champagne_flute",
      name: i18n.t('glassware.champagne_flute'),
      imageUri: glasswareUriById.champagne_flute,
    },
    {
      id: "martini",
      name: i18n.t('glassware.martini'),
      imageUri: glasswareUriById.martini,
    },
    {
      id: "collins_glass",
      name: i18n.t('glassware.collins_glass'),
      imageUri: glasswareUriById.collins_glass,
    },
    {
      id: "copper_mug",
      name: i18n.t('glassware.copper_mug'),
      imageUri: glasswareUriById.copper_mug,
    },
    { id: "coupe", name: i18n.t('glassware.coupe'), imageUri: glasswareUriById.coupe },
    { id: "cup", name: i18n.t('glassware.cup'), imageUri: glasswareUriById.cup },
    { id: "goblet", name: i18n.t('glassware.goblet'), imageUri: glasswareUriById.goblet },
    {
      id: "highball_glass",
      name: i18n.t('glassware.highball_glass'),
      imageUri: glasswareUriById.highball_glass,
    },
    {
      id: "hurricane_glass",
      name: i18n.t('glassware.hurricane_glass'),
      imageUri: glasswareUriById.hurricane_glass,
    },
    {
      id: "irish_coffee_glass",
      name: i18n.t('glassware.irish_coffee_glass'),
      imageUri: glasswareUriById.irish_coffee_glass,
    },
    {
      id: "margarita_glass",
      name: i18n.t('glassware.margarita_glass'),
      imageUri: glasswareUriById.margarita_glass,
    },
    {
      id: "nick_and_nora",
      name: i18n.t('glassware.nick_and_nora'),
      imageUri: glasswareUriById.nick_and_nora,
    },
    { id: "pitcher", name: i18n.t('glassware.pitcher'), imageUri: glasswareUriById.pitcher },
    { id: "pub_glass", name: i18n.t('glassware.pub_glass'), imageUri: glasswareUriById.pub_glass },
    {
      id: "rocks_glass",
      name: i18n.t('glassware.rocks_glass'),
      imageUri: glasswareUriById.rocks_glass,
    },
    { id: "shooter", name: i18n.t('glassware.shooter'), imageUri: glasswareUriById.shooter },
    { id: "snifter", name: i18n.t('glassware.snifter'), imageUri: glasswareUriById.snifter },
    { id: "tiki", name: i18n.t('glassware.tiki'), imageUri: glasswareUriById.tiki },
    {
      id: "wine_glass",
      name: i18n.t('glassware.wine_glass'),
      imageUri: glasswareUriById.wine_glass,
    },
  ];
}
