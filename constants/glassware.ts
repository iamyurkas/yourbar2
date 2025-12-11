const glassImages = {
  bowl: require('../assets/glassware/bowl.jpg'),
  champagne_flute: require('../assets/glassware/champagne.jpg'),
  cocktail_glass: require('../assets/glassware/cocktail.jpg'),
  collins_glass: require('../assets/glassware/collins.jpg'),
  copper_mug: require('../assets/glassware/copper.jpg'),
  coupe: require('../assets/glassware/coupe.jpg'),
  cup: require('../assets/glassware/cup.jpg'),
  goblet: require('../assets/glassware/goblet.jpg'),
  highball_glass: require('../assets/glassware/highball.jpg'),
  hurricane_glass: require('../assets/glassware/hurricane.jpg'),
  irish_coffee_glass: require('../assets/glassware/irish.jpg'),
  margarita_glass: require('../assets/glassware/margarita.jpg'),
  nick_and_nora: require('../assets/glassware/nick.jpg'),
  pitcher: require('../assets/glassware/pitcher.jpg'),
  pub_glass: require('../assets/glassware/pub.jpg'),
  rocks_glass: require('../assets/glassware/rocks.jpg'),
  shooter: require('../assets/glassware/shooter.jpg'),
  snifter: require('../assets/glassware/snifter.jpg'),
  tiki: require('../assets/glassware/tiki.jpg'),
  wine_glass: require('../assets/glassware/wine.jpg'),
};

export const GLASSWARE = [
  { id: 'bowl', name: 'Bowl', image: glassImages.bowl },
  {
    id: 'champagne_flute',
    name: 'Champagne Flute',
    image: glassImages.champagne_flute,
  },
  {
    id: 'cocktail_glass',
    name: 'Cocktail glass',
    image: glassImages.cocktail_glass,
  },
  {
    id: 'collins_glass',
    name: 'Collins glass',
    image: glassImages.collins_glass,
  },
  { id: 'copper_mug', name: 'Copper mug', image: glassImages.copper_mug },
  { id: 'coupe', name: 'Coupe', image: glassImages.coupe },
  { id: 'cup', name: 'Cup', image: glassImages.cup },
  { id: 'goblet', name: 'Goblet', image: glassImages.goblet },
  {
    id: 'highball_glass',
    name: 'Highball glass',
    image: glassImages.highball_glass,
  },
  {
    id: 'hurricane_glass',
    name: 'Hurricane glass',
    image: glassImages.hurricane_glass,
  },
  {
    id: 'irish_coffee_glass',
    name: 'Irish Coffee glass',
    image: glassImages.irish_coffee_glass,
  },
  {
    id: 'margarita_glass',
    name: 'Margarita glass',
    image: glassImages.margarita_glass,
  },
  {
    id: 'nick_and_nora',
    name: 'Nick and Nora',
    image: glassImages.nick_and_nora,
  },
  { id: 'pitcher', name: 'Pitcher', image: glassImages.pitcher },
  { id: 'pub_glass', name: 'Pub glass', image: glassImages.pub_glass },
  { id: 'rocks_glass', name: 'Rocks glass', image: glassImages.rocks_glass },
  { id: 'shooter', name: 'Shooter', image: glassImages.shooter },
  { id: 'snifter', name: 'Snifter', image: glassImages.snifter },
  { id: 'tiki', name: 'Tiki', image: glassImages.tiki },
  { id: 'wine_glass', name: 'Wine glass', image: glassImages.wine_glass },
] as const;

export type GlasswareOption = (typeof GLASSWARE)[number];
