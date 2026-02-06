import appJson from "./app.json";

const isDevelopmentProfile = process.env.EAS_BUILD_PROFILE === "development";
const basePlugins = appJson.expo.plugins ?? [];
const plugins = [
  ...basePlugins,
  ...(isDevelopmentProfile ? ["expo-dev-client"] : []),
];

export default {
  ...appJson.expo,
  plugins,
  extra: {
    ...appJson.expo.extra,
    buildTime: new Date().toISOString(),
  },
};
