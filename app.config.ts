import appJson from "./app.json";

const isDevelopmentProfile = process.env.EAS_BUILD_PROFILE === "development";

const plugins = [...(appJson.expo.plugins ?? [])];

if (isDevelopmentProfile) {
  plugins.push("expo-dev-client");
}

plugins.push("@sentry/react-native");

export default {
  ...appJson.expo,

  plugins,

  extra: {
    ...appJson.expo.extra,
    buildTime: new Date().toISOString(),
  },
};
