import { glasswareUriById } from "@/assets/image-manifest";

export type GlasswareOption = {
  id: keyof typeof glasswareUriById;
  name: string;
  imageUri: string;
};

export const GLASSWARE: GlasswareOption[] = [
  { id: "bowl", name: "Bowl", imageUri: glasswareUriById.bowl },
  {
    id: "flute_glass",
    name: "Flute glass",
    imageUri: glasswareUriById.flute_glass,
  },
  {
    id: "martini",
    name: "Martini glass",
    imageUri: glasswareUriById.martini,
  },
  {
    id: "collins_glass",
    name: "Collins glass",
    imageUri: glasswareUriById.collins_glass,
  },
  {
    id: "copper_mug",
    name: "Copper mug",
    imageUri: glasswareUriById.copper_mug,
  },
  { id: "coupe", name: "Coupe", imageUri: glasswareUriById.coupe },
  { id: "cup", name: "Cup", imageUri: glasswareUriById.cup },
  { id: "goblet", name: "Goblet", imageUri: glasswareUriById.goblet },
  {
    id: "highball_glass",
    name: "Highball glass",
    imageUri: glasswareUriById.highball_glass,
  },
  {
    id: "hurricane_glass",
    name: "Hurricane glass",
    imageUri: glasswareUriById.hurricane_glass,
  },
  {
    id: "toddy_glass",
    name: "Toddy glass",
    imageUri: glasswareUriById.toddy_glass,
  },
  {
    id: "margarita_glass",
    name: "Margarita glass",
    imageUri: glasswareUriById.margarita_glass,
  },
  {
    id: "nick_and_nora",
    name: "Nick and Nora",
    imageUri: glasswareUriById.nick_and_nora,
  },
  { id: "pitcher", name: "Pitcher", imageUri: glasswareUriById.pitcher },
  { id: "pub_glass", name: "Pub glass", imageUri: glasswareUriById.pub_glass },
  {
    id: "rocks_glass",
    name: "Rocks glass",
    imageUri: glasswareUriById.rocks_glass,
  },
  { id: "shooter", name: "Shooter", imageUri: glasswareUriById.shooter },
  { id: "snifter", name: "Snifter", imageUri: glasswareUriById.snifter },
  { id: "tiki", name: "Tiki", imageUri: glasswareUriById.tiki },
  {
    id: "wine_glass",
    name: "Wine glass",
    imageUri: glasswareUriById.wine_glass,
  },
];
