import { glasswareUriById } from "@/assets/image-manifest";

export type GlasswareId = keyof typeof glasswareUriById;

export type GlasswareOption = {
  id: GlasswareId;
  name: string;
  imageUri: string;
};

const GLASSWARE_DEFINITIONS: Array<Pick<GlasswareOption, "id" | "name">> = [
  { id: "bowl", name: "Bowl" },
  { id: "flute_glass", name: "Flute glass" },
  { id: "martini", name: "Martini glass" },
  { id: "collins_glass", name: "Collins glass" },
  { id: "copper_mug", name: "Copper mug" },
  { id: "coupe", name: "Coupe glass" },
  { id: "cup", name: "Cup" },
  { id: "goblet", name: "Goblet" },
  { id: "highball_glass", name: "Highball glass" },
  { id: "hurricane_glass", name: "Hurricane glass" },
  { id: "toddy_glass", name: "Toddy glass" },
  { id: "margarita_glass", name: "Margarita glass" },
  { id: "nick_and_nora", name: "Nick & Nora" },
  { id: "pitcher", name: "Pitcher" },
  { id: "pub_glass", name: "Pub glass" },
  { id: "rocks_glass", name: "Rocks glass" },
  { id: "shooter", name: "Shooter" },
  { id: "snifter", name: "Snifter" },
  { id: "tiki_glass", name: "Tiki glass" },
  { id: "wine_glass", name: "Wine glass" },
];

export const GLASSWARE: GlasswareOption[] = GLASSWARE_DEFINITIONS.map(
  ({ id, name }) => ({
    id,
    name,
    imageUri: glasswareUriById[id],
  }),
);
